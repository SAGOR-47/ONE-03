module.exports = {
	config: {
		name: "unsend",
		aliases: ["uns", "unsent"],
		version: "1.3",
		author: "NTKhang",
		countDown: 5,
		role: 0,
		description: {
			vi: "Gỡ tin nhắn của bot",
			en: "Unsend bot's message"
		},
		category: "box chat",
		guide: {
			vi: "reply tin nhắn muốn gỡ của bot và gọi lệnh {pn}",
			en: "reply the message you want to unsend and call the command {pn}"
		}
	},

	langs: {
		vi: {
			syntaxError: "Vui lòng reply tin nhắn muốn gỡ của bot",
			unsendFail: "❌ Không thể gỡ tin nhắn: %1"
		},
		en: {
			syntaxError: "Please reply the message you want to unsend",
			unsendFail: "❌ Could not unsend message: %1"
		}
	},

	onStart: async function ({ message, event, api, getLang }) {
		if (!event.messageReply || String(event.messageReply.senderID) != String(api.getCurrentUserID()))
			return message.reply(getLang("syntaxError"));
		try {
			await message.unsend(event.messageReply.messageID);
		}
		catch (e) {
			return message.reply(getLang("unsendFail", (e && e.message) || e));
		}
	}
};
