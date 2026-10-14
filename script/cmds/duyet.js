const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "duyet",
  aliases: [],
  version: "1.0.2",
  hasPermssion: 2,
  credits: "Sagor",
  description: "approve boxes to use the bot xD",
  commandCategory: "Admin",
  cooldowns: 5,
  prefix: true
};

const dataPath = path.resolve(__dirname, "../../utils/data/approvedThreads.json");
const dataPendingPath = path.resolve(__dirname, "../../utils/data/pendingThreads.json");

module.exports.handleReply = async function ({ event, api, handleReply }) {
  if (handleReply.author !== event.senderID) return;
  const { body, threadID, messageID } = event;
  let approvedThreads = JSON.parse(fs.readFileSync(dataPath));
  let pendingThreads = JSON.parse(fs.readFileSync(dataPendingPath));

  if (handleReply.type === "pending") {
    if (body.trim().toLowerCase() === "all") {
      approvedThreads = approvedThreads.concat(pendingThreads);
      fs.writeFileSync(dataPath, JSON.stringify(approvedThreads, null, 2));
      fs.writeFileSync(dataPendingPath, JSON.stringify([], null, 2));
      pendingThreads.forEach(id => {
        api.sendMessage("✅ Your group has been approved!\n📝 Have fun using the bot", id);
      });
      return api.sendMessage(`✅ Successfully approved all ${pendingThreads.length} groups`, threadID, messageID);
    }

    const numbers = body.split(" ").map(num => parseInt(num.trim())).filter(num => !isNaN(num));
    let successCount = 0;

    for (let num of numbers) {
      const index = num - 1;
      if (index >= 0 && index < pendingThreads.length) {
        const idBox = pendingThreads[index];
        approvedThreads.push(idBox);
        api.sendMessage("✅ Your group has been approved!\n📝 Have fun using the bot", idBox);
        pendingThreads.splice(index, 1);
        successCount++;
      }
    }

    fs.writeFileSync(dataPath, JSON.stringify(approvedThreads, null, 2));
    fs.writeFileSync(dataPendingPath, JSON.stringify(pendingThreads, null, 2));

    return successCount > 0
      ? api.sendMessage(`✅ Successfully approved ${successCount} groups`, threadID, messageID)
      : api.sendMessage("❎ No groups approved, please check the numbers again", threadID, messageID);
  } else if (handleReply.type === "remove") {
    const idxs = [...new Set(body.split(" ").map(num => parseInt(num) - 1).filter(index => approvedThreads[index]))].sort((x, y) => y - x);
    if (idxs.length) {
      const removedIDs = [];
      for (const index of idxs) {
        const idBox = approvedThreads[index];
        approvedThreads.splice(index, 1);
        removedIDs.push(idBox);
        try { await api.removeUserFromGroup(api.getCurrentUserID(), idBox); } catch (e) {}
      }
      fs.writeFileSync(dataPath, JSON.stringify(approvedThreads, null, 2));
      return api.sendMessage(`✅ Removed boxes:\n${removedIDs.join(", ")}`, threadID, messageID);
    }
    return api.sendMessage("❎ No groups to delete", threadID, messageID);
  }
};

module.exports.run = async ({ event, api, args, Threads }) => {
  const { threadID, messageID } = event;
  let approvedThreads = JSON.parse(fs.readFileSync(dataPath));
  let pendingThreads = JSON.parse(fs.readFileSync(dataPendingPath));
  let idBox = args[0] ? args[0] : threadID;

  if (args[0] === "list" || args[0] === "l") {
    let msg = "[ Approved Groups ]\n";
    for (let [index, id] of approvedThreads.entries()) {
      const _t = (await Threads.getData(id)) || {};
      const name = (_t.threadInfo && (_t.threadInfo.threadName || _t.threadInfo.name)) || "Name not found";
      msg += `\n${index + 1}. ${name}\n🧬 ID: ${id}`;
    }
    return api.sendMessage(`${msg}\n\n📌 Reply with the number to delete the group`, threadID, (error, info) => {
      if (!error) {
        global.client.handleReply.push({
          name: this.config.name,
          messageID: info.messageID,
          author: event.senderID,
          type: "remove",
        });
      }
    }, messageID);
  }

  if (args[0] === "pending" || args[0] === "p") {
    let msg = `[ UNAPPROVED BOXES ]\n`;
    for (let [index, id] of pendingThreads.entries()) {
      let threadInfo = ((await Threads.getData(id)) || {}).threadInfo || {};
      msg += `\n${index + 1}. ${threadInfo.threadName || "Name not found"}\n🧬 ID: ${id}`;
    }
    return api.sendMessage(`${msg}\n\n📌 Reply with the number to approve groups`, threadID, (error, info) => {
      if (!error) {
        global.client.handleReply.push({
          name: this.config.name,
          messageID: info.messageID,
          author: event.senderID,
          type: "pending",
        });
      }
    }, messageID);
  }

  if (args[0] === "help" || args[0] === "h") {
    const prefix = (((await Threads.getData(String(threadID))) || {}).data || {}).PREFIX || global.config.PREFIX;
    return api.sendMessage(`[ Approve Box ]\n\n` +
      `${prefix}${this.config.name} l/list => view approved box list\n` +
      `${prefix}${this.config.name} p/pending => view pending box list\n` +
      `${prefix}${this.config.name} d/del => include ID to remove from the list\n` +
      `${prefix}${this.config.name} => include ID to approve that box`, threadID, messageID);
  }

  if (args[0] === "del" || args[0] === "d") {
    idBox = args[1] || threadID;
    if (!approvedThreads.includes(idBox)) {
      return api.sendMessage("❎ Group was not approved before", threadID, messageID);
    }
    approvedThreads = approvedThreads.filter(id => id !== idBox);
    fs.writeFileSync(dataPath, JSON.stringify(approvedThreads, null, 2));
    await api.removeUserFromGroup(api.getCurrentUserID(), idBox);
    return api.sendMessage(`✅ Group ${idBox} has been removed from the list`, threadID, messageID);
  }

  if (isNaN(parseInt(idBox))) {
    return api.sendMessage("❎ Invalid ID", threadID, messageID);
  }

  if (approvedThreads.includes(idBox)) {
    return api.sendMessage(`❎ Group ${idBox} was already approved`, threadID, messageID);
  }

  approvedThreads.push(idBox);
  pendingThreads = pendingThreads.filter(id => id !== idBox);
  fs.writeFileSync(dataPath, JSON.stringify(approvedThreads, null, 2));
  fs.writeFileSync(dataPendingPath, JSON.stringify(pendingThreads, null, 2));
  api.sendMessage("✅ Your group has been approved!\n📝 Have fun using the bot", idBox);
  return api.sendMessage(`✅ Successfully approved groups ${idBox}`, threadID, messageID);
};