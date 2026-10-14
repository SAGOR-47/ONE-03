


module.exports.config = {
  name: "mycommand",
  aliases: [],
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Sagor",
  description: "Write what your command does here",
  commandCategory: "Tools",
  usages: "[text]",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args, Users }) {
  const { threadID, messageID, senderID } = event;


  const text = args.join(" ");

  if (!text) {
    return api.sendMessage(
      `❌ Please give me some text.\n📌 Usage: mycommand [text]`,
      threadID, messageID
    );
  }


  return api.sendMessage(`✅ You said: ${text}`, threadID, messageID);


};


