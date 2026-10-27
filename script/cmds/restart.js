module.exports.config = {
	name: "re",
	aliases: ["restart"],
	version: "7.0.1",
	permission: 3,
	credits: "Sagor",
	prefix: false,
  premium: false,
	description: "restart bot system",
	category: "operator",
	usages: "",
	cooldowns: 0
};
module.exports.run = async function({ api, event, args, Threads, Users, Currencies, models, botname }) {
  const process = require("process");
  const { threadID, messageID } = event;
  api.sendMessage(`restarting the whole system, please be patient.`, threadID, ()=> process.exit(1));
}
