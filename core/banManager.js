


const fs = require("fs-extra");
const path = require("path");

const filePath = path.join(__dirname, "utils", "data", "bannedUsers.json");

function load() {
  try {
    const d = fs.readJsonSync(filePath);
    return new Set((d.banned || []).map(String));
  } catch (e) { return new Set(); }
}

let banned = load();


let notified = new Set();

function save() {
  try {
    fs.writeJsonSync(filePath, { banned: [...banned] }, { spaces: 2 });
  } catch (e) {
    console.error("[Ban] save failed:", e.message);
  }
}

module.exports = {
  isBanned: (id) => banned.has(String(id)),
  ban: (id) => { banned.add(String(id)); notified.delete(String(id)); save(); },
  unban: (id) => { const r = banned.delete(String(id)); notified.delete(String(id)); if (r) save(); return r; },
  wasNotified: (id) => notified.has(String(id)),
  markNotified: (id) => notified.add(String(id)),
  list: () => [...banned],
  count: () => banned.size
};
