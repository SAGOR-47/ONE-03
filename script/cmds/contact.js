this.config = {
    name: "contact",
    aliases: [],
    version: "1.0.0",
    hasPermssion: 0,
    credits: "Sagor",
    description: "Contact members in the group",
    commandCategory: "Tools",
    usages: "",
    cooldowns: 5,
    prefix: false
  };

  this.run = async ({ api, event: { threadID, messageReply, senderID, mentions, type }, args }) => {
    let id = Object.keys(mentions).length > 0 ? Object.keys(mentions)[0].replace(/\&mibextid=ZbWKwL/g, '') : args[0] !== undefined ? isNaN(args[0]) ? await api.getUID(args[0]) : args[0] : senderID;
    if (type === "message_reply") id = messageReply.senderID;
    api.shareContact("", id, threadID);
  };