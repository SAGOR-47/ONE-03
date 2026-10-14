


const axios = require("axios");

function isEnabled() {
  const cfg = (global.config && global.config.telegram) || {};

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) return true;
  return !!(cfg.enable && cfg.botToken && cfg.chatId);
}


async function send(text) {
  if (!isEnabled()) return false;
  const cfg = (global.config && global.config.telegram) || {};
  const token = process.env.TELEGRAM_BOT_TOKEN || cfg.botToken;
  const chatId = process.env.TELEGRAM_CHAT_ID || cfg.chatId;
  try {
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: chatId, text: String(text).slice(0, 4000) },
      { timeout: 15000 }
    );
    return true;
  } catch (e) {
    console.error("[Telegram] notify failed:", e.message);
    return false;
  }
}

function formatUptime() {
  const s = Math.floor(process.uptime());
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

module.exports = { send, isEnabled, formatUptime };
