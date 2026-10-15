
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "admin",
  aliases: ["admn"],
  version: "3.0.1",
  hasPermssion: 3,
  credits: "SAGOR",
  description: "Manage bot administrators",
  commandCategory: "Admin",
  usages: "admin list/add/remove [userID]",
  cooldowns: 2
};

module.exports.run = async function ({ api, event, args, Users }) {
  const { threadID, messageID, senderID, messageReply } = event;
  const config = global.config;
  const adminList = config.ADMINBOT || [];

  if (!adminList.some(id => String(id) === String(senderID))) {
    return api.sendMessage(
      "❌ You don't have permission to use this command.",
      threadID,
      messageID
    );
  }

  const action = (args[0] || "list").toLowerCase();

  if (action === "list") {
    if (!adminList.length) {
      return api.sendMessage(
        "✦ 𝐀𝐃𝐌𝐈𝐍 𝐌𝐀𝐍𝐀𝐆𝐄𝐑 ✦\n" +
        "╭─────────────────\n" +
        "┃ No admins found.\n" +
        "╰─────────────────\n" +
        "✦ Members: 00 ✦",
        threadID,
        messageID
      );
    }

    const names = await Promise.all(
      adminList.map(async id => {
        try {
          return await Users.getNameUser(id);
        } catch {
          return String(id);
        }
      })
    );

    const adminNames = names
      .map(name => `┃ 💎 ${name}`)
      .join("\n");

    return api.sendMessage(
      `✦ 𝐀𝐃𝐌𝐈𝐍 𝐌𝐀𝐍𝐀𝐆𝐄𝐑 ✦\n` +
      `╭─────────────────\n` +
      `${adminNames}\n` +
      `╰─────────────────\n` +
      `✦ Members: ${String(adminList.length).padStart(2, "0")} ✦`,
      threadID,
      messageID
    );
  }

  if (!["add", "remove"].includes(action)) {
    return api.sendMessage(
      "✦ ADMIN MANAGER ✦\n\n" +
      "➤ admin list\n" +
      "➤ admin add [userID]\n" +
      "➤ admin remove [userID]\n\n" +
      "Reply to a user's message with admin add/remove.",
      threadID,
      messageID
    );
  }

  const targetID = args[1] || messageReply?.senderID;

  if (!targetID) {
    return api.sendMessage(
      `⚠️ Reply to a user's message with admin ${action}.\n` +
      `Or use: admin ${action} [userID]`,
      threadID,
      messageID
    );
  }

  const id = String(targetID);
  const index = adminList.findIndex(uid => String(uid) === id);

  if (action === "add") {
    if (index !== -1) {
      return api.sendMessage(
        "⚠️ This user is already an admin.",
        threadID,
        messageID
      );
    }

    adminList.push(id);
  } else {
    if (index === -1) {
      return api.sendMessage(
        "⚠️ This user is not an admin.",
        threadID,
        messageID
      );
    }

    if (String(senderID) === id) {
      return api.sendMessage(
        "❌ You cannot remove yourself.",
        threadID,
        messageID
      );
    }

    adminList.splice(index, 1);
  }

  config.ADMINBOT = adminList;

  let savedSuccessfully = false;

  try {
    const configPath = path.join(process.cwd(), "config.json");

    if (fs.existsSync(configPath)) {
      const savedConfig = JSON.parse(
        fs.readFileSync(configPath, "utf8")
      );

      savedConfig.ADMINBOT = adminList;

      fs.writeFileSync(
        configPath,
        JSON.stringify(savedConfig, null, 2),
        "utf8"
      );

      savedSuccessfully = true;
    }
  } catch (error) {
    console.error("Admin config save error:", error);
  }

  let name = id;

  try {
    name = await Users.getNameUser(id);
  } catch {}

  return api.sendMessage(
    `✦ 𝐀𝐃𝐌𝐈𝐍 𝐌𝐀𝐍𝐀𝐆𝐄𝐑 ✦\n` +
    `╭─────────────────\n` +
    `┃ ${action === "add" ? "✅ Added" : "🗑️ Removed"}\n` +
    `┃ 💎 ${name}\n` +
    `┃ 🆔 ${id}\n` +
    `╰─────────────────\n` +
    `✦ Members: ${String(adminList.length).padStart(2, "0")} ✦\n` +
    `${savedSuccessfully ? "✅ Config saved." : "⚠️ Config file not saved."}`,
    threadID,
    messageID
  );
};
    
