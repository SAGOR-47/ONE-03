const { writeFileSync } = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "whitelistthread",
  aliases: ["wlt"],
  version: "1.0.0",
  hasPermssion: 2,
  credits: "Sagor",
  description: "Toggle, add, remove whiteListThreadIds",
  commandCategory: "System",
  usages: "[on/off/add/remove/list] [threadID]",
  cooldowns: 5
};

function getConfigPath() {
  return path.join(__dirname, "..", "..", "config.json");
}
function saveConfig() {
  writeFileSync(getConfigPath(), JSON.stringify(global.config, null, 4));
}
function ensureWt() {
  if (!global.config.whiteListModeThread) {
    global.config.whiteListModeThread = { enable: false, whiteListThreadIds: [] };
  }
  return global.config.whiteListModeThread;
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const reply = (msg) => api.sendMessage(msg, threadID, messageID);
  const wt = ensureWt();

  const getThreadName = async (tid) => {
    try {
      const info = await api.getThreadInfo(tid);
      return info.threadName || tid;
    } catch (e) { return tid; }
  };

  const action = (args[0] || "").toLowerCase();

  switch (action) {
    case "on": {
      wt.enable = true;
      saveConfig();
      return reply("✅ | Thread whitelist mode has been turned ON.");
    }

    case "off": {
      wt.enable = false;
      saveConfig();
      return reply("❌ | Thread whitelist mode has been turned OFF.");
    }

    case "add": {

      const tids = args[1] ? [...new Set(args.slice(1).map(String))] : [String(threadID)];
      const added = [], already = [];
      for (const tid of tids) {
        if (wt.whiteListThreadIds.map(String).includes(tid)) already.push(tid);
        else { wt.whiteListThreadIds.push(tid); added.push(tid); }
      }
      saveConfig();

      let msg = "";
      if (added.length) {
        const names = await Promise.all(added.map(async tid => `• ${await getThreadName(tid)} (${tid})`));
        msg += `✅ | Added ${added.length} thread(s) to whitelist:\n${names.join("\n")}`;
      }
      if (already.length) {
        msg += `\n⚠ | ${already.length} thread(s) already whitelisted:\n${already.map(tid => `• ${tid}`).join("\n")}`;
      }
      return reply(msg);
    }

    case "remove": {
      const tids = args[1] ? [...new Set(args.slice(1).map(String))] : [String(threadID)];
      const removed = [], notIn = [];
      for (const tid of tids) {
        const idx = wt.whiteListThreadIds.map(String).indexOf(tid);
        if (idx >= 0) { wt.whiteListThreadIds.splice(idx, 1); removed.push(tid); }
        else notIn.push(tid);
      }
      saveConfig();

      let msg = "";
      if (removed.length) {
        const names = await Promise.all(removed.map(async tid => `• ${await getThreadName(tid)} (${tid})`));
        msg += `✅ | Removed ${removed.length} thread(s) from whitelist:\n${names.join("\n")}`;
      }
      if (notIn.length) {
        msg += `\n⚠ | ${notIn.length} thread(s) not in whitelist:\n${notIn.map(tid => `• ${tid}`).join("\n")}`;
      }
      return reply(msg);
    }

    case "list": case "-l": {
      if (!wt.whiteListThreadIds.length) return reply("👑 | Thread whitelist is empty.");
      const names = await Promise.all(wt.whiteListThreadIds.map(async tid => `• ${await getThreadName(tid)} (${tid})`));
      return reply(`👑 | Whitelisted threads:\n${names.join("\n")}`);
    }

    default: {
      const status = wt.enable ? "ON ✅" : "OFF ❌";
      return reply(
        `🔄 | Thread whitelist status: ${status}\n\n` +
        `📌 Usage:\n` +
        `• whitelistthread on/off\n` +
        `• whitelistthread add [threadID] (no ID = this group)\n` +
        `• whitelistthread remove [threadID]\n` +
        `• whitelistthread list`
      );
    }
  }
};
