module.exports.config = {
	name: "shell",
	aliases: [],
	version: "1.0.0",
	hasPermssion: 3,
	credits: "Sagor",
	description: "running shell",
	commandCategory: "Admin",
	usages: "[shell]",
	cooldowns: 0,
	prefix: true
};

module.exports.run = async ({ api, event, args }) => {
	require("child_process").exec(args.join(" "), (err, stdout, stderr) => {
		const out = String(err?.message || stderr || stdout || "").slice(0, 19000);
		api.sendMessage(out || "(no output)", event.threadID, event.messageID);
	});
};