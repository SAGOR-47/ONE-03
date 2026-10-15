module.exports.config = {
	name: "pending",
	version: "1.1.0",
	credits: "Sagor",
	prefix: false,
	premium: false,
	permission: 2,
	description: "approve or refuse pending groups",
	category: "admin",
	cooldowns: 5
};

const STR = {
	invaildNumber: "%1 is not a valid number",
	cancelSuccess: "refused %1 thread",
	notiBox: "group has been approved, you can now use the bot",
	approveSuccess: "approved successfully %1 threads",
	cantGetPendingList: "can't get the pending list",
	returnListPending: "the whole number of groups to approve is : %1 thread \n\n%2\n\nreply with number(s) to approve, or c<number> to refuse",
	returnListClean: "there is no group in the pending list"
};

// language-independent (config.language is "en", so don't rely on module.languages)
const t = (key, ...v) => v.reduce((s, x, i) => s.replace(new RegExp("%" + (i + 1), "g"), x), STR[key] || key);

module.exports.languages = { en: STR, english: STR, bangla: STR };

module.exports.handleReply = async function ({ api, event, handleReply }) {
	if (String(event.senderID) !== String(handleReply.author)) return;
	const { threadID, messageID } = event;
	const body = String(event.body || "").trim();
	const list = handleReply.pending;
	let count = 0;

	const isCancel = /^c(ancel)?\s*\d/i.test(body);
	const tokens = (isCancel ? body.replace(/^c(ancel)?/i, "") : body).split(/[\s,]+/).filter(Boolean);
	if (!tokens.length) return;

	for (const tok of tokens) {
		const n = Number(tok);
		if (!Number.isInteger(n) || n <= 0 || n > list.length)
			return api.sendMessage(t("invaildNumber", tok), threadID, messageID);
	}

	for (const tok of tokens) {
		const target = list[Number(tok) - 1].threadID;
		try {
			if (isCancel) await api.removeUserFromGroup(api.getCurrentUserID(), target);
			else await api.sendMessage(t("notiBox"), target);
			count++;
		} catch (e) { console.log("[pending] failed for", target, e && e.message || e); }
	}
	return api.sendMessage(t(isCancel ? "cancelSuccess" : "approveSuccess", count), threadID, messageID);
};

module.exports.run = async function ({ api, event, botid }) {
	const { threadID, messageID } = event;
	let spam = [], pending = [];
	try {
		spam = (await api.getThreadList(100, null, ["OTHER"])) || [];
		pending = (await api.getThreadList(100, null, ["PENDING"])) || [];
	} catch (e) {
		console.log("[pending] getThreadList error:", e && e.message || e);
		return api.sendMessage(t("cantGetPendingList"), threadID, messageID);
	}

	const seen = new Set();
	const list = [...spam, ...pending].filter(g => g && g.isGroup && !seen.has(g.threadID) && seen.add(g.threadID));
	if (!list.length) return api.sendMessage(t("returnListClean"), threadID, messageID);

	const msg = list.map((g, i) => `${i + 1}. ${g.name || "Unnamed group"} (${g.threadID})`).join("\n");
	return api.sendMessage(t("returnListPending", list.length, msg), threadID, (error, info) => {
		if (error || !info) return;
		global.client.handleReply.push({
			name: module.exports.config.name,
			messageID: info.messageID,
			author: event.senderID,
			pending: list
		});
	}, messageID);
};
