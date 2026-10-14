module.exports = {
	config: {
		name: "help",
		version: "1.0",
		author: "SaGor",
		countDown: 5,
		role: 0,
		shortDescription: "Show command list",
		longDescription: "View all commands or command details",
		category: "system",
		guide: {
			en: "/help\n/help [command]"
		}
	},

	onStart: async function ({ message, args }) {

		const commands = global.GoatBot.commands;

		const getText = (v) => {
			if (!v) return "";
			if (typeof v === "string") return v;
			if (typeof v === "object") return v.en || Object.values(v)[0] || "";
			return String(v);
		};
		const getCategory = (cmd) => {
			const c = cmd.config || {};
			return getText(c.category) || c.commandCategory || "other";
		};
		const getRole = (cmd) => {
			const c = cmd.config || {};
			if (c.role != null) return c.role;
			if (c.hasPermssion != null) return Math.min(c.hasPermssion, 3);
			return 0;
		};


		if (!args[0]) {
			const categories = {};
			const seen = new Set();

			for (const [, cmd] of commands) {
				const name = cmd.config && cmd.config.name;
				if (!name || seen.has(name)) continue;
				seen.add(name);
				const category = getCategory(cmd);

				if (!categories[category]) categories[category] = [];
				categories[category].push(name);
			}

			let msg = "";

			for (const category in categories) {
				msg += `╭─────『 ${category.toUpperCase()} 』\n`;
				for (const cmd of categories[category]) {
					msg += `│ ▸ ${cmd}\n`;
				}
				msg += `╰──────────────\n`;
			}

			return message.reply(msg);
		}


		const cmdName = args[0].toLowerCase();
		const command = commands.get(cmdName);

		if (!command)
			return message.reply("❌ Command not found");

		const config = command.config;
		const desc = getText(config.longDescription) || getText(config.description) || getText(config.shortDescription) || "No description";
		const guide = getText(config.guide) || config.usages || "No guide";
		const role = getRole(command);
		const permTxt = role == 0 ? "User" : role == 1 ? "Group Admin" : role == 2 ? "Bot Admin" : "Supporter";

		let msg =
`╭─────『 COMMAND DETAILS 』
│ ▸ Name: ${config.name}
│ ▸ Category: ${getCategory(command)}
│ ▸ Description: ${desc}
│ ▸ Usage: ${guide}
│ ▸ Permission: ${permTxt}
╰──────────────`;

		message.reply(msg);
	}
};
