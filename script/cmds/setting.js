


const { writeFileSync } = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "setting",
  aliases: ["settings"],
  version: "4.0",
  hasPermssion: 2,
  credits: "Sagor",
  description: "V4: Control bot settings from chat",
  commandCategory: "System",
  usages: "[number]",
  cooldowns: 5
};

function getConfigPath() {
  return path.join(__dirname, "..", "..", "config.json");
}
function saveConfig() {
  writeFileSync(getConfigPath(), JSON.stringify(global.config, null, 4));
}
function ensureWl() {
  if (!global.config.whiteListMode) global.config.whiteListMode = { enable: false, whiteListIds: [] };
  return global.config.whiteListMode;
}
function ensureWlT() {
  if (!global.config.whiteListModeThread) global.config.whiteListModeThread = { enable: false, whiteListThreadIds: [] };
  return global.config.whiteListModeThread;
}

const MENU =
  `⚙️ 𝗕𝗢𝗧 𝗦𝗘𝗧𝗧𝗜𝗡𝗚𝗦 (V4)\n` +
  `━━━━━━━━━━━━━━━\n` +
  `1️⃣ Whitelist Mode (users): {wl}\n` +
  `2️⃣ Whitelist Thread Mode: {wlt}\n` +
  `3️⃣ Bot Name: {name}\n` +
  `4️⃣ Prefix: {prefix}\n` +
  `5️⃣ ReactBy guard: {react}\n` +
  `6️⃣ Language: {lang}\n` +
  `━━━━━━━━━━━━━━━\n` +
  `↩️ Reply with a number (1-6)`;

function fmtMenu() {
  const on = (b) => b ? "🟢 ON" : "🔴 OFF";
  return MENU
    .replace("{wl}", on(ensureWl().enable))
    .replace("{wlt}", on(ensureWlT().enable))
    .replace("{name}", global.config.BOTNAME || "Mirai")
    .replace("{prefix}", global.config.PREFIX || "!")
    .replace("{react}", on(global.config.reactBy && global.config.reactBy.enable))
    .replace("{lang}", global.config.language || "en");
}

module.exports.run = async function ({ api, event }) {
  const { threadID, messageID } = event;
  api.sendMessage(fmtMenu(), threadID, (err, info) => {
    if (err) return;
    global.client.handleReply.push({
      name: module.exports.config.name,
      messageID: info.messageID,
      author: event.senderID,
      step: "menu"
    });
  }, messageID);
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { threadID, messageID, senderID } = event;
  if (senderID !== handleReply.author) return;
  const reply = (msg) => api.sendMessage(msg, threadID, messageID);
  const ask = (msg, nextStep) => {
    api.sendMessage(msg, threadID, (err, info) => {
      if (err) return;
      global.client.handleReply.push({
        name: module.exports.config.name,
        messageID: info.messageID,
        author: senderID,
        step: nextStep
      });
    }, messageID);
  };

  const input = (event.body || "").trim();

  if (handleReply.step === "menu") {
    switch (input) {
      case "1": {
        const wl = ensureWl();
        wl.enable = !wl.enable; saveConfig();
        return reply(`${wl.enable ? "🟢" : "🔴"} Whitelist Mode (users) is now ${wl.enable ? "ON" : "OFF"}.`);
      }
      case "2": {
        const wlt = ensureWlT();
        wlt.enable = !wlt.enable; saveConfig();
        return reply(`${wlt.enable ? "🟢" : "🔴"} Whitelist Thread Mode is now ${wlt.enable ? "ON" : "OFF"}.`);
      }
      case "3":
        return ask("✏️ Reply with the new bot name:", "setName");
      case "4":
        return ask("✏️ Reply with the new prefix (1 character recommended):", "setPrefix");
      case "5": {
        if (!global.config.reactBy) global.config.reactBy = { enable: true };
        global.config.reactBy.enable = !global.config.reactBy.enable; saveConfig();
        return reply(`${global.config.reactBy.enable ? "🟢" : "🔴"} ReactBy guard is now ${global.config.reactBy.enable ? "ON" : "OFF"}.`);
      }
      case "6":
        return ask("🌐 Reply with language code (en / bn):", "setLang");
      default:
        return reply("⚠ Please reply with a number 1-6.");
    }
  }

  if (handleReply.step === "setName") {
    if (!input) return reply("⚠ Name cannot be empty.");
    global.config.BOTNAME = input.slice(0, 50); saveConfig();
    return reply(`✅ Bot name set to: ${global.config.BOTNAME}`);
  }
  if (handleReply.step === "setPrefix") {
    if (!input) return reply("⚠ Prefix cannot be empty.");
    global.config.PREFIX = input.slice(0, 3); saveConfig();
    return reply(`✅ Prefix set to: ${global.config.PREFIX}`);
  }
  if (handleReply.step === "setLang") {
    const lang = input.toLowerCase();
    const langFileOk = /^[a-z]{2,5}$/.test(lang) && require("fs").existsSync(path.join(__dirname, "..", "..", "..", "languages", lang + ".lang"));
    if (!langFileOk) return reply("⚠ Language file not found. Available: en (add languages/<code>.lang for more).");
    global.config.language = lang; saveConfig();
    return reply(`✅ Language set to: ${lang === "bn" ? "বাংলা 🇧🇩" : "English 🇬🇧"}`);
  }
};
