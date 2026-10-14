module.exports.config = {
  name: "ban",
  aliases: [],
  version: "1.0.0",
  hasPermssion: 2,
  credits: "Sagor",
  description: "Ban or unban users from using the bot",
  commandCategory: "System",
  usages: "[@tag/uid + reply] | ban list | ban unban [@tag/uid + reply]",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args, Users }) {
  const { threadID, messageID, mentions, messageReply } = event;
  const reply = (msg) => api.sendMessage(msg, threadID, messageID);
  const banMgr = require("../../core/banManager.js");
  const admins = (global.config.ADMINBOT || []).map(String);

  const getName = async (id) => {
    try { return await Users.getNameUser(id) || id; } catch (e) { return id; }
  };


  const getTargets = (idArgs) => {
    const ids = new Set();
    if (mentions) for (const id of Object.keys(mentions)) ids.add(String(id));
    if (messageReply && messageReply.senderID) ids.add(String(messageReply.senderID));
    for (const a of idArgs) {
      const id = String(a).replace(/[^0-9]/g, "");
      if (id) ids.add(id);
    }
    return [...ids];
  };

  const action = (args[0] || "").toLowerCase();


  if (action === "list" || action === "-l") {
    const list = banMgr.list();
    if (!list.length) return reply("📋 | No banned users.");
    const lines = [];
    for (const id of list) lines.push(`• ${await getName(id)} (${id})`);
    return reply(`🚫 | Banned users (${list.length}):\n${lines.join("\n")}`);
  }


  if (action === "unban" || action === "remove") {
    const targets = getTargets(args.slice(1));
    if (!targets.length) return reply("❗ | Tag, reply, or give a UID to unban.\n📌 Usage: ban unban @user");
    const done = [], notBanned = [];
    for (const id of targets) {
      if (banMgr.unban(id)) done.push(`• ${await getName(id)} (${id})`);
      else notBanned.push(id);
    }
    let msg = "";
    if (done.length) msg += `✅ | Unbanned ${done.length} user(s):\n${done.join("\n")}`;
    if (notBanned.length) msg += `\n⚠ | Not banned: ${notBanned.join(", ")}`;
    return reply(msg.trim());
  }


  const targets = getTargets(args);
  if (!targets.length) {
    return reply(
      "❗ | Tag a user, reply to their message, or give a UID.\n\n" +
      "📌 Usage:\n" +
      "• ban @user\n" +
      "• ban 1000123456789\n" +
      "• ban (reply to message)\n" +
      "• ban list\n" +
      "• ban unban @user"
    );
  }

  const done = [], already = [], skipped = [];
  for (const id of targets) {
    if (admins.includes(id)) { skipped.push(id); continue; }
    if (banMgr.isBanned(id)) { already.push(id); continue; }
    banMgr.ban(id);
    done.push(`• ${await getName(id)} (${id})`);
  }

  let msg = "";
  if (done.length) msg += `🚫 | Banned ${done.length} user(s):\n${done.join("\n")}`;
  if (already.length) msg += `\n⚠ | Already banned: ${already.join(", ")}`;
  if (skipped.length) msg += `\n⛔ | Can't ban bot admin: ${skipped.join(", ")}`;
  return reply(msg.trim());
};
