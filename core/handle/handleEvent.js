module.exports = function ({api ,models, Users, Threads, Currencies }) {
    const logger = require("../utils/log.js");
   	const moment = require("moment-timezone");

    return async function ({ event }) {
        const timeStart = Date.now()
        const time = moment.tz("Asia/Dhaka").format("HH:mm:ss DD/MM/YYYY");
        const { userBanned, threadBanned } = global.data;
        const { events } = global.client;
        const { allowInbox, DeveloperMode } = global.config;
        var { senderID, threadID } = event;
        senderID = String(senderID);
        threadID = String(threadID);
        if (userBanned.has(senderID)|| threadBanned.has(threadID) || allowInbox == ![] && senderID == threadID) return;
        for (const [key, value] of events.entries()) {
            const eventTypes = value && value.config && value.config.eventType;
            if (!eventTypes) continue;
            const typeMatched = Array.isArray(eventTypes)
                ? eventTypes.indexOf(event.logMessageType) !== -1
                : eventTypes === event.logMessageType;
            if (typeMatched) {
                const eventRun = events.get(key);
                try {
                    const Obj = {};
                    Obj.api = api
                    Obj.event = event
                    Obj.models= models 
                    Obj.Users= Users 
                    Obj.Threads = Threads
                    Obj.Currencies = Currencies 
                    await Promise.resolve(eventRun.run(Obj));
                    if (DeveloperMode == !![]) 
                    	logger(global.getText('handleEvent', 'executeEvent', time, eventRun.config.name, threadID, Date.now() - timeStart), '[ Event ]');
                } catch (error) {
                    logger(global.getText('handleEvent', 'eventError', eventRun.config.name, (error && error.stack) || String(error)), "error");
                }
            }
        }
        return;
    };
}