const fs = require("fs-extra");
const path = require("path");
const os = require("os");

module.exports.config = {
  name: "callad",
  aliases: ["call", "called"],
  version: "2.0",
  hasPermssion: 0,
  credits: "Sagor",
  description: "Send message or report directly to bot admin",
  commandCategory: "contacts admin",
  usages: "<your message>",
  cooldowns: 5
};

const mediaTypes = ["photo", "sticker", "animated_image", "video", "audio"];


async function getAttachmentStreams(event) {
  const atts = [
    ...(event.attachments || []),
    ...((event.messageReply && event.messageReply.attachments) || [])
  ].filter(a => a && a.url && mediaTypes.includes(a.type));

  const files = [];
  const streams = [];
  for (let i = 0; i < atts.length; i++) {
    const p = path.join(os.tmpdir(), `callad_${Date.now()}_${i}`);
    try {
      await global.utils.downloadFile(atts[i].url, p);
      files.push(p);
      streams.push(fs.createReadStream(p));
    } catch (e) {}
  }
  const cleanup = () => { for (const f of files) { try { fs.unlinkSync(f); } catch (e) {} } };
  return { streams, cleanup };
}

module.exports.run = async function ({ api, event, args, Users, Threads }) {
  const { senderID, threadID, messageID, isGroup } = event;

  if (!args[0]) {
    return api.sendMessage("❗ Please write a message to send", threadID, messageID);
  }

  const adminBot = global.config.ADMINBOT || [];
  if (!adminBot.length) {
    return api.sendMessage("⚠️ No admin found", threadID, messageID);
  }

  let senderName = senderID;
  try { senderName = await Users.getNameUser(senderID) || senderID; } catch (e) {}

  let body =
    "📞 CALL ADMIN\n\n" +
    `👤 User: ${senderName}\n` +
    `🆔 ID: ${senderID}`;

  if (isGroup) {
    let threadName = threadID;
    try { threadName = (await Threads.getInfo(threadID)).threadName || threadID; } catch (e) {}
    body += `\n👥 Group: ${threadName}\n🧵 Thread ID: ${threadID}`;
  } else {
    body += `\n👤 Sent from private chat`;
  }

  body += `\n\n📩 Message:\n${args.join(" ")}\n\n↩️ Reply to respond`;

  const { streams, cleanup } = await getAttachmentStreams(event);
  const formMessage = {
    body,
    mentions: [{ id: senderID, tag: senderName }],
  };
  if (streams.length) formMessage.attachment = streams;

  let success = 0;
  for (const uid of adminBot) {
    try {
      const info = await new Promise((resolve, reject) => {
        api.sendMessage(formMessage, uid, (err, info) => err ? reject(err) : resolve(info));
      });
      success++;
      global.client.handleReply.push({
        name: module.exports.config.name,
        messageID: info.messageID,
        author: senderID,
        threadID,
        messageIDSender: messageID
      });
    } catch (e) {}
  }
  cleanup();

  if (success > 0) {
    return api.sendMessage(`✅ Message Sent\n\n📨 Sent to ${success} admin(s)`, threadID, messageID);
  } else {
    return api.sendMessage(`❌ Failed to send message to ${adminBot.length} admin(s)`, threadID, messageID);
  }
};

module.exports.handleReply = async function ({ api, event, args, handleReply, Users }) {

  let senderName = event.senderID;
  try { senderName = await Users.getNameUser(event.senderID) || event.senderID; } catch (e) {}

  const body =
    `📍 Admin Reply\n\n` +
    `👤 ${senderName}:\n${args.join(" ")}\n\n` +
    `↩️ Reply to continue`;

  api.sendMessage(body, handleReply.threadID, () => {
    api.sendMessage("✅ Reply sent successfully", event.threadID, event.messageID);
  }, handleReply.messageIDSender);
};
