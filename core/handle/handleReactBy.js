// ============================================================
//  ReactBy guard — protects the bot's messages from hate reacts:
//  config.json "reactBy":
//    enable: true/false
//    unsend: [emojis] -> bot unsends its message if someone
//                       reacts with one of these
//    kick:   [emojis] -> bot kicks the reactor from the group
//                       if they react with one of these
// ============================================================
const { isBotMessage } = require("../activityLog.js");

module.exports = function ({ api }) {
  return async function ({ event }) {
    try {
      const cfg = global.config.reactBy;
      if (!cfg || !cfg.enable) return;
      if (event.type !== "message_reaction") return;

      const emoji = event.reaction;
      if (!emoji) return; // reaction removed, ignore

      // only protect the bot's own messages
      if (!isBotMessage(event.messageID)) return;

      // ignore the bot's own reactions
      const botID = String(api.getCurrentUserID());
      if (String(event.userID) === botID) return;

      const unsendList = cfg.unsend || [];
      const kickList = cfg.kick || [];

      if (unsendList.includes(emoji)) {
        try {
          await api.unsendMessage(event.messageID, event.threadID);
        } catch (e) {}
      }

      if (kickList.includes(emoji)) {
        try {
          await api.removeUserFromGroup(event.userID, event.threadID);
        } catch (e) {}
      }
    } catch (e) {}
  };
};
