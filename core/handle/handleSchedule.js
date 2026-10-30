const cron = require('node-cron');
const fs = require('fs');
const moment = require('moment-timezone');
const path = require('path');
const logger = require('../utils/log');

module.exports = function ({ api, Threads }) {
  cron.schedule('*/10 * * * *', async () => {
   try {
    const cc = path.join(__dirname, '..', 'utils', 'data', 'check_data.json');
    const now = moment().tz('Asia/Dhaka');
    const currentTime = now.format('YYYY-MM-DD HH:mm:ss');
    let lastRunTime = null;
    if (fs.existsSync(cc)) {
        try {
            const saved = JSON.parse(fs.readFileSync(cc, 'utf-8'));
            if (typeof saved?.datetime === 'string') {
                lastRunTime = moment.tz(saved.datetime, 'YYYY-MM-DD HH:mm:ss', 'Asia/Dhaka');
            }
        } catch (error) {
            logger(`Could not read thread sync timestamp: ${error.message}`, '[ DATA ] >');
        }
    }
    if (!lastRunTime?.isValid() || now.diff(lastRunTime, 'minutes') >= 10) {
        const groupList = (await api.getThreadList(100, null, ['INBOX'])).filter(group => group.isSubscribed && group.isGroup);
        let dataChanged = false;
        for (const { threadID } of groupList) {
            const newThreadInfo = await api.getThreadInfo(threadID);
            const oldThreadInfo = await Threads.getData(threadID);
            if (JSON.stringify(newThreadInfo) !== JSON.stringify((oldThreadInfo || {}).threadInfo)) {
                await Threads.setData(threadID, { threadInfo: newThreadInfo });
                dataChanged = true;
            }
        }
        fs.mkdirSync(path.dirname(cc), { recursive: true });
        fs.writeFileSync(cc, JSON.stringify({ datetime: currentTime }), 'utf-8');
        if (dataChanged) {
            logger(`Auto updating data of ${groupList.length} threads`, '[ DATA ] >');
        }
    }
   } catch (err) {
    logger(global.getText("handleSchedule", "exectuteError", "autoUpdateData", err && err.message ? err.message : err), 'warn');
   }
  });
}
