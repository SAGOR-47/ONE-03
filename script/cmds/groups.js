module.exports.config = {
	name: "group",
	version: "0.0.3",
	permission: 2,
	credits: "Sagor",
	prefix: true,
  premium: false,
	description: "ban or unblock a group",
	category: "admin",
	usages: "[unban/ban/search] [id or text]",
	cooldowns: 5
};

module.exports.handleReaction = async ({ event, api, Threads, handleReaction, botid }) => {
	if (parseInt(event.userID) !== parseInt(handleReaction.author)) return;
	switch (handleReaction.type) {
		case "ban": {
			const data = (await Threads.getData(handleReaction.target)).data || {};
			data.banned = 1;
			await Threads.setData(handleReaction.target, { data });
			global.data.threadBanned.set(String(handleReaction.target), { reason: '', dateAdded: '' });
			api.sendMessage(`successfully banned group id ${handleReaction.target}`, event.threadID, () => api.unsendMessage(handleReaction.messageID));
			break;
		}
		case "unban": {
			const data = (await Threads.getData(handleReaction.target)).data || {};
			data.banned = 0;
			await Threads.setData(handleReaction.target, { data });
			global.data.threadBanned.delete(String(handleReaction.target));
			api.sendMessage(`successfully unbanned group id ${handleReaction.target}`, event.threadID, () => api.unsendMessage(handleReaction.messageID));
			break;
		}
		default:
			break;
	}
}

module.exports.run = async ({ event, api, args, Threads, botid }) => {
    let content = args.slice(1, args.length);
	switch (args[0]) {
		case "ban": {
			if (content.length == 0) return api.sendMessage("you need to enter the thread id you want to ban.", event.threadID);
			for (let idThread of content) {
				idThread = String(idThread).replace(/[^0-9]/g, '');
				if (!idThread) return api.sendMessage(`that's not group id`, event.threadID);
				let dataThread = (await Threads.getData(idThread.toString()));
				if (!dataThread) return api.sendMessage(`thread does not exist in database\ngroup id : ${idThread}`, event.threadID);
				if ((dataThread.data || {}).banned) return api.sendMessage(`already banned group id ${idThread}`, event.threadID);
				return api.sendMessage(`do you want to ban group id ${idThread}?\n\nplease react to this message to ban`, event.threadID, (error, info) => {
					if (error || !info) return;
					global.client.handleReaction.get(botid).push({
						name: this.config.name,
						messageID: info.messageID,
						author: event.senderID,
						type: "ban",
						target: idThread
					});
				})
			}
			break;
		}
		case "unban": {
			if (content.length == 0) return api.sendMessage("you need to enter the thread id you want to unban", event.threadID);
			for (let idThread of content) {
				idThread = String(idThread).replace(/[^0-9]/g, '');
				if (!idThread) return api.sendMessage(`that's not a group id` , event.threadID);
				let dataThread = (await Threads.getData(idThread)).data;
				if (!dataThread) return api.sendMessage(`thread does not exist in the database\ngroup id : ${idThread}`, event.threadID);
				if (dataThread.banned != 1) return api.sendMessage(`[${idThread}] Not banned before`, event.threadID);
				return api.sendMessage(`you want to unban group id ${idThread}?\n\nPlease react to this message to ban`, event.threadID, (error, info) => {
					if (error || !info) return;
					global.client.handleReaction.get(botid).push({
						name: this.config.name,
						messageID: info.messageID,
						author: event.senderID,
						type: "unban",
						target: idThread
					});
				})
			}
			break;
		}
		case "search": {
			let contentJoin = content.join(" ");
			let getThreads = (await Threads.getAll(['threadID', 'threadInfo']))
				.map(item => ({ id: item.threadID, name: (item.threadInfo || {}).threadName || "" }))
				.filter(item => !!item.name);
			let matchThreads = [], a = '', b = 0;
			getThreads.forEach(i => {
				if (i.name.toLowerCase().includes(contentJoin.toLowerCase())) {
					matchThreads.push({
						name: i.name,
						id: i.id
					});
				}
			});
			matchThreads.forEach(i => a += `\n${b += 1}. ${i.name} - ${i.id}`);
			(matchThreads.length > 0) ? api.sendMessage(`here's the match : \n${a}`, event.threadID) : api.sendMessage("no results found based on your search", event.threadID);
			break;
		}
		default: {
			return global.utils.throwError(this.config.name, event.threadID, event.messageID)
		}
	}
}
