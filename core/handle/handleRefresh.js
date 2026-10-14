const leaveNoti = require('../../script/events/leaveNoti.js');

module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const logger = require("../utils/log.js");

    return async function ({ event }) {
        const { threadID, logMessageType, logMessageData, author } = event;
        const { setData, getData, delData, createData } = Threads;

        try {
            let threadData = await getData(threadID);
            if (!threadData) {
                logger('Thread data does not exist: ' + threadID, '[ERROR]');
                return;
            }

            let dataThread = threadData.threadInfo || {};
            dataThread.adminIDs = dataThread.adminIDs || [];
            dataThread.participantIDs = dataThread.participantIDs || [];

            switch (logMessageType) {
                case "log:thread-admins": {
                    if (logMessageData.ADMIN_EVENT == "add_admin") {
                        dataThread.adminIDs.push({ id: logMessageData.TARGET_ID });
                        api.sendMessage(`✅ Update ${dataThread.adminIDs.length} QTV`, threadID);
                    } else if (logMessageData.ADMIN_EVENT == "remove_admin") {
                        dataThread.adminIDs = dataThread.adminIDs.filter(item => item.id != logMessageData.TARGET_ID);
                        api.sendMessage(`✅ Update ${dataThread.adminIDs.length} QTV`, threadID);
                    }
                    logger('Refreshing admin list at thread ' + threadID, '[UPDATE DATA]');
                    await setData(threadID, { threadInfo: dataThread });
                    break;
                }
                case "log:thread-name": {
                    logger('Updating name at thread ' + threadID, '[UPDATE DATA]');
                    dataThread.threadName = logMessageData.name;
                    await setData(threadID, { threadInfo: dataThread });
                    api.sendMessage(`📝 Group name changed to: ${logMessageData.name}`, threadID);
                    break;
                }
                case 'log:unsubscribe': {
                    const userFbId = logMessageData.leftParticipantFbId;
                    if (userFbId == api.getCurrentUserID()) {
                        logger('Deleting data of thread ' + threadID, '[DELETE DATA THREAD]');
                        const index = global.data.allThreadID?.findIndex(item => item == threadID);
                        if (index > -1) global.data.allThreadID.splice(index, 1);
                        await delData(threadID);
                        return;
                    } else {
                        (await leaveNoti.run({ api, event, Users, Threads }));
                        const participantIndex = dataThread.participantIDs.findIndex(item => item == userFbId);
                        if (participantIndex > -1) dataThread.participantIDs.splice(participantIndex, 1);

                        const adminIndex = dataThread.adminIDs.findIndex(item => item.id == userFbId);
                        if (adminIndex > -1) {
                            dataThread.adminIDs.splice(adminIndex, 1);
                        }

                        logger('Deleting user ' + userFbId, '[DELETE DATA USER]');
                        await setData(threadID, { threadInfo: dataThread });
                    }
                    break;
                }
            }
        } catch (e) {
            console.error('Error updating data: ' + e);
        }
        return;
    };
};
