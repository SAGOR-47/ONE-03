const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "approve",
  version: "3.0.0",
  permission: 0,
  credits: "Sagor",
  description: "approve thread using thread id",
  prefix: false,
  category: "admin",
  premium: false,
  usages: "approve [list/add/remove] [threadid]",
  cooldowns: 5,
};

// language-independent strings (config.language is "en")
const STR = {
  listHeader: "approved groups (%1):",
  listEmpty: "no approved groups yet",
  added: "✅ approved group %1",
  removed: "✅ removed group %1 from the approved list",
  notApproved: "❎ group %1 is not in the approved list",
  already: "❎ group %1 is already approved",
  invalidId: "❎ please provide a valid thread id",
  noPermission: 'you have no permission to use "%1"',
  usage: "usage:\n{pn} list\n{pn} add <threadID>\n{pn} remove <threadID>"
};
const t = (key, ...v) => v.reduce((s, x, i) => s.replace(new RegExp("%" + (i + 1), "g"), x), STR[key] || key);
module.exports.languages = { en: STR, english: STR, bangla: STR };

// shared approval store used by listen.js (publicMode gate) and duyet.js
const dataPath = path.resolve(__dirname, "../../core/utils/data/approvedThreads.json");

function readApproved() {
  try { return JSON.parse(fs.readFileSync(dataPath, "utf8")) || []; }
  catch (e) { return []; }
}
function writeApproved(list) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(list, null, 2));
}

module.exports.run = async function ({ api, event, args, Threads, Users, permssion }) {
  const { threadID, messageID } = event;
  const cmdName = module.exports.config.name;
  const reply = (msg) => api.sendMessage(msg, threadID, messageID);
  const approved = readApproved();
  const action = (args[0] || "list").toLowerCase();

  const getName = async (id) => {
    try {
      const info = ((await Threads.getData(String(id))) || {}).threadInfo || {};
      return info.threadName || (await Users.getNameUser(id)) || String(id);
    } catch (e) { return String(id); }
  };

  switch (action) {
    case "list":
    case "all":
    case "-a":
    case "l": {
      if (!approved.length) return reply(t("listEmpty"));
      const lines = [];
      for (const id of approved) lines.push(`• ${await getName(id)} (${id})`);
      return reply(`${t("listHeader", approved.length)}\n${lines.join("\n")}`);
    }

    case "add":
    case "box": {
      if (permssion < 2) return reply(t("noPermission", cmdName));
      const id = String(args[1] || "").replace(/[^0-9]/g, "");
      if (!id) return reply(t("invalidId"));
      if (approved.includes(id)) return reply(t("already", id));
      approved.push(id);
      writeApproved(approved);
      api.sendMessage("✅ this group has been approved, you can now use the bot", id, () => {});
      return reply(t("added", id));
    }

    case "remove":
    case "rm":
    case "delete":
    case "del": {
      if (permssion < 2) return reply(t("noPermission", cmdName));
      const id = String(args[1] || "").replace(/[^0-9]/g, "");
      if (!id) return reply(t("invalidId"));
      const index = approved.indexOf(id);
      if (index === -1) return reply(t("notApproved", id));
      approved.splice(index, 1);
      writeApproved(approved);
      return reply(t("removed", id));
    }

    default: {
      return reply(t("usage").replace("{pn}", (global.config.PREFIX || ".") + cmdName));
    }
  }
};
