module.exports.config = {
	name: "joinNoti",
	eventType: ["log:subscribe"],
	version: "1.0.4",
	credits: "Mirai Team",
	description: "Notify when bot or someone joins the group",
	dependencies: {
		"fs-extra": ""
	}
};

const logger = require("../../core/utils/log.js");

module.exports.run = async function ({ api, event, Users }) {
	const { join } = global.nodemodule["path"];
	const { threadID } = event;
	if (event.logMessageData.addedParticipants.some(i => i.userFbId == api.getCurrentUserID())) {
		api.changeNickname(`[ ${global.config.PREFIX} ] • ${(!global.config.BOTNAME) ? "Connected successfully :<" : global.config.BOTNAME}`, threadID, api.getCurrentUserID());
		return api.sendMessage(`Hellooooooooooooooooooooooooooooooooooooooo <3`, threadID);
	}
	else {
		try {
			const { createReadStream, existsSync, mkdirSync } = global.nodemodule["fs-extra"];
			let { threadName, participantIDs } = await api.getThreadInfo(threadID);

			const threadData = global.data.threadData.get(String(threadID)) || {};
			const path = join(__dirname, "cache", "joinGif");
			const pathGif = join(path, `${threadID}.gif`);

			var mentions = [], nameArray = [], memLength = [], i = 0;

			for (const participant of event.logMessageData.addedParticipants) {
				const id = String(participant.userFbId);
				const userName = participant.fullName;
				nameArray.push(userName);
				mentions.push({ tag: userName, id });
				memLength.push(participantIDs.length - i++);

				if (!global.data.allUserID.includes(id)) {
					await Users.createData(id, { name: userName, data: {} });
					global.data.allUserID.push(id);
					logger(global.getText("handleCreateDatabase", "newUser", id), "[ DATABASE ]");
				}
			}
			memLength.sort((a, b) => a - b);

			let msg = (typeof threadData.customJoin == "undefined")
				? "👋Welcome {name}.\nWelcome to {threadName}.\n{type} is member #{soThanhVien} of the group 🥳"
				: threadData.customJoin;
			msg = msg
				.replace(/\{name}/g, nameArray.join(', '))
				.replace(/\{type}/g, (memLength.length > 1) ? 'guys' : 'you')
				.replace(/\{soThanhVien}/g, memLength.join(', '))
				.replace(/\{threadName}/g, threadName);

			if (!existsSync(path)) mkdirSync(path, { recursive: true });

			let formPush;
			if (existsSync(pathGif)) formPush = { body: msg, attachment: createReadStream(pathGif), mentions }
			else formPush = { body: msg, mentions }

			return api.sendMessage(formPush, threadID);
		} catch (e) { return console.log(e) };
	}
}
