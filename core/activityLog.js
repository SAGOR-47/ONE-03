


const moment = require("moment-timezone");

function time() {
  return moment.tz("Asia/Dhaka").format("HH:mm:ss");
}

function userName(id) {
  try {
    return global.data.userName.get(String(id)) || String(id);
  } catch (e) { return String(id); }
}

function threadName(id) {
  try {
    const info = global.data.threadInfo.get(String(id));
    return (info && info.threadName) || String(id);
  } catch (e) { return String(id); }
}


const botMessageIDs = new Set();
function trackBotMessage(id) {
  if (!id) return;
  botMessageIDs.add(String(id));
  if (botMessageIDs.size > 2000) {

    const first = botMessageIDs.values().next().value;
    botMessageIDs.delete(first);
  }
}
function isBotMessage(id) {
  return botMessageIDs.has(String(id));
}

function preview(msg) {
  if (typeof msg === "string") {
    const oneLine = msg.replace(/\n/g, " ").slice(0, 120);
    return oneLine || "[empty]";
  }
  if (msg && msg.body) return preview(msg.body);
  return "[attachment]";
}

function box(header, lines) {
  const body = lines.map(l => `│ ${l}`).join("\n");
  console.log(`┌─ ${header} ─────────\n${body}\n└─────────────────────`);
}


function wrapApi(api, logger) {
  if (api.sendMessage.__activityWrapped) return;

  const origSend = api.sendMessage.bind(api);
  api.sendMessage = function (msg, threadID, callback, ...rest) {
    try {
      box(`🤖 BOT REPLY`, [`→ ${threadName(threadID)} | ${time()}`, preview(msg)]);
    } catch (e) {}

    let userCb, replyId;
    if (typeof callback === "function") userCb = callback;
    else if (callback !== undefined) replyId = callback;
    const wrappedCb = function (err, info) {
      if (!err && info && info.messageID) trackBotMessage(info.messageID);
      if (userCb) userCb(err, info);
    };
    return replyId !== undefined
      ? origSend(msg, threadID, wrappedCb, replyId, ...rest)
      : origSend(msg, threadID, wrappedCb, ...rest);
  };
  api.sendMessage.__activityWrapped = true;

  if (typeof api.setMessageReaction === "function" && !api.setMessageReaction.__activityWrapped) {
    const origReact = api.setMessageReaction.bind(api);
    api.setMessageReaction = function (reaction, messageID, ...rest) {
      try {
        box(`👍 BOT REACT`, [`${reaction || "❌"} | ${time()}`]);
      } catch (e) {}
      return origReact(reaction, messageID, ...rest);
    };
    api.setMessageReaction.__activityWrapped = true;
  }
}


function logEvent(event, logger) {
  try {
    const t = time();
    switch (event.type) {
      case "message":
      case "message_reply": {
        const body = event.body
          || (event.attachments && event.attachments.length ? "[attachment]" : "")
          || "[no text]";
        const replyMark = event.type === "message_reply" ? " ↩ reply" : "";
        box(`💬 INCOMING${replyMark}`, [
          `${userName(event.senderID)} @ ${threadName(event.threadID)} | ${t}`,
          body.slice(0, 150)
        ]);
        break;
      }
      case "message_reaction": {
        box(`❤️ REACTION`, [
          `${userName(event.userID)} reacted ${event.reaction || "❌"}`,
          `@ ${threadName(event.threadID)} | ${t}`
        ]);
        break;
      }
      case "message_unsend": {
        box(`🗑️ UNSEND`, [
          `${userName(event.senderID)} unsent a message`,
          `@ ${threadName(event.threadID)} | ${t}`
        ]);
        break;
      }
      default:
        break;
    }
  } catch (e) {}
}

module.exports = { wrapApi, logEvent, isBotMessage };
