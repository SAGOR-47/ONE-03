this.config = {
    name: "rs",
    aliases: [],
    version: "1.0.0",
    hasPermssion: 3,
    credits: "Sagor",
    description: "Restart the bot.",
    commandCategory: "Admin",
    cooldowns: 0,
    images: [],
 };
 this.run = ({event, api}) => api.sendMessage("✅", event.threadID, () => process.exit(1), event.messageID)