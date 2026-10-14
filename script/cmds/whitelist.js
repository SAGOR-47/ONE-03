const { writeFileSync, readFileSync } = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "whitelist",
  aliases: ["wl"],
  version: "1.6",
  hasPermssion: 2,
  credits: "Sagor",
  description: "Toggle, add, remove whiteListIds",
  commandCategory: "System",
  usages: "[on/off/add/remove/list] [uid/@tag]",
  cooldowns: 5
};


function getConfigPath() {
  return path.join(__dirname, "..", "..", "config.json");
}
function saveConfig() {
  writeFileSync(getConfigPath(), JSON.stringify(global.config, null, 4));
}
function ensureWl() {
  if (!global.config.whiteListMode) {
    global.config.whiteListMode = { enable: false, whiteListIds: [] };
  }
  return global.config.whiteListMode;
}

module.exports.run = async function ({ api, event, args, Users }) {
  const { threadID, messageID } = event;
  const reply = (msg) => api.sendMessage(msg, threadID, messageID);
  const wl = ensureWl();

  const getName = async (uid) => {
    try { return await Users.getNameUser(uid) || uid; }
    catch (e) { return uid; }
  };

  const action = (args[0] || "").toLowerCase();

  switch (action) {
    case "on": {
      wl.enable = true;
      saveConfig();
      return reply("✅ | Whitelist mode has been turned ON.");
    }

    case "off": {
      wl.enable = false;
      saveConfig();
      return reply("❌ | Whitelist mode has been turned OFF.");
    }

    case "add": case "-a": case "+": {
      if (!args[1] && !Object.keys(event.mentions || {}).length && !event.messageReply)
        return reply("⚠ | Please enter ID or tag a user to add.");
      let uids = Object.keys(event.mentions || {}).length
        ? Object.keys(event.mentions)
        : event.messageReply
          ? [event.messageReply.senderID]
          : args.filter(arg => !isNaN(arg));
      uids = [...new Set(uids.map(String))];
      if (!uids.length) return reply("⚠ | Please enter ID or tag a user to add.");

      const added = [], already = [];
      for (const uid of uids) {
        if (wl.whiteListIds.map(String).includes(uid)) already.push(uid);
        else { wl.whiteListIds.push(uid); added.push(uid); }
      }
      saveConfig();

      let msg = "";
      if (added.length) {
        const names = await Promise.all(added.map(async uid => `• ${await getName(uid)} (${uid})`));
        msg += `✅ | Added whitelist role for ${added.length} user(s):\n${names.join("\n")}`;
      }
      if (already.length) {
        msg += `\n⚠ | ${already.length} user(s) already whitelisted:\n${already.map(uid => `• ${uid}`).join("\n")}`;
      }
      return reply(msg);
    }

    case "remove": case "-r": case "-": {
      if (!args[1] && !Object.keys(event.mentions || {}).length && !event.messageReply)
        return reply("⚠ | Please enter ID or tag a user to remove.");
      let uids = Object.keys(event.mentions || {}).length
        ? Object.keys(event.mentions)
        : event.messageReply
          ? [event.messageReply.senderID]
          : args.filter(arg => !isNaN(arg));
      uids = [...new Set(uids.map(String))];
      if (!uids.length) return reply("⚠ | Please enter ID or tag a user to remove.");

      const removed = [], notIn = [];
      for (const uid of uids) {
        const idx = wl.whiteListIds.map(String).indexOf(uid);
        if (idx >= 0) { wl.whiteListIds.splice(idx, 1); removed.push(uid); }
        else notIn.push(uid);
      }
      saveConfig();

      let msg = "";
      if (removed.length) {
        const names = await Promise.all(removed.map(async uid => `• ${await getName(uid)} (${uid})`));
        msg += `✅ | Removed whitelist role of ${removed.length} user(s):\n${names.join("\n")}`;
      }
      if (notIn.length) {
        msg += `\n⚠ | ${notIn.length} user(s) not in whitelist:\n${notIn.map(uid => `• ${uid}`).join("\n")}`;
      }
      return reply(msg);
    }

    case "list": case "-l": {
      if (!wl.whiteListIds.length) return reply("👑 | Whitelist is empty.");
      const names = await Promise.all(wl.whiteListIds.map(async uid => `• ${await getName(uid)} (${uid})`));
      return reply(`👑 | Whitelisted IDs:\n${names.join("\n")}`);
    }

    default: {
      const status = wl.enable ? "ON ✅" : "OFF ❌";
      return reply(
        `🔄 | Whitelist status: ${status}\n\n` +
        `📌 Usage:\n` +
        `• whitelist on/off\n` +
        `• whitelist add <uid/@tag>\n` +
        `• whitelist remove <uid/@tag>\n` +
        `• whitelist list`
      );
    }
  }
};
