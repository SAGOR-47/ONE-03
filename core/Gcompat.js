


const fs = require("fs");
const path = require("path");

const LOG_TYPES = [
  "log:subscribe", "log:unsubscribe", "log:thread-name", "log:thread-icon",
  "log:thread-color", "log:thread-admins", "log:user-nickname", "log:thread-call",
  "log:thread-approval-mode", "log:thread-poll", "log:thread-image", "log:link-status",
  "log:magic-words", "log:thread-pinned", "log:thread-unpinned", "log:thread-created"
];


const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);

function isGoatModule(mod) {
  return !!(mod && mod.config && typeof mod.run !== "function" && ["onStart", "onChat", "onReply", "onReaction", "onAnyEvent", "onFirstChat"].some(k => typeof mod[k] === "function"));
}
const isGoatCommand = isGoatModule;
const isGoatEvent = (mod) => !!(mod && mod.config && typeof mod.onStart === "function" && typeof mod.run !== "function");

function pickText(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.en || v.vi || Object.values(v)[0] || "";
  return String(v);
}

function toPath(p) {
  if (Array.isArray(p)) return p.map(String);
  return String(p).replace(/\[(\w+)\]/g, ".$1").split(".").filter(Boolean);
}
function getPath(obj, p, defaultValue) {
  if (p == null) return obj === undefined ? defaultValue : obj;
  let cur = obj;
  for (const k of toPath(p)) {
    if (cur == null) return defaultValue;
    cur = cur[k];
  }
  return cur === undefined ? defaultValue : cur;
}
function setPath(obj, p, value) {
  const keys = toPath(p);
  if (!keys.length) return obj;
  if (keys.some(k => FORBIDDEN.has(k))) throw new Error("Invalid key path");
  let cur = obj;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = value;
    else {
      if (cur[k] == null || typeof cur[k] !== "object") cur[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      cur = cur[k];
    }
  });
  return obj;
}
function unsetPath(obj, p) {
  const keys = toPath(p);
  if (keys.some(k => FORBIDDEN.has(k))) throw new Error("Invalid key path");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur == null) return obj;
    cur = cur[keys[i]];
  }
  if (cur != null) delete cur[keys[keys.length - 1]];
  return obj;
}
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));


function makeMessage(goat, api, event) {
  const threadID = event && event.threadID;
  const messageID = event && event.messageID;

  const sendP = (msg, tid, callback, mid) => new Promise((resolve, reject) => {
    const cb = (err, info) => {
      if (typeof callback === "function") { try { callback(err, info); } catch (e) { console.error(e); } }
      if (err) return reject(err);
      resolve(info);
    };
    try {
      if (mid !== undefined && mid !== null) api.sendMessage(msg, tid, cb, mid);
      else api.sendMessage(msg, tid, cb);
    } catch (e) { reject(e); }
  });

  const reply = (msg, callback) => sendP(msg, threadID, callback, messageID);
  const sendError = (err) => {
    const text = "❌ " + (err && err.message ? err.message : String(err));
    return reply(text);
  };
  return {
    reply,
    send: (msg, tid, callback, mid) => sendP(msg, tid || threadID, callback, mid),
    unsend: (mid, callback) => new Promise((resolve, reject) => {
      api.unsendMessage(mid || messageID, threadID, (err) => {
        if (typeof callback === "function") { try { callback(err); } catch (e) {} }
        if (err) return reject(err);
        resolve();
      });
    }),
    reaction: (emoji, mid, callback) => new Promise((resolve) => {
      api.setMessageReaction(emoji, mid || messageID, threadID, (err) => {
        if (typeof callback === "function") { try { callback(err); } catch (e) {} }
        resolve(!err);
      }, true);
    }),
    err: sendError,
    error: sendError,

    SyntaxError: () => reply(String(pickText(goat.config && goat.config.guide) || "Wrong syntax, check the guide.")
      .replace(/\{pn\}/g, ((global.config && global.config.PREFIX) || "!") + ((goat.config && goat.config.name) || ""))),
  };
}


function makeGetLang(goat) {
  const langs = goat.langs || (goat.config && goat.config.langs) || {};
  return (key, ...args) => {
    const code = (global.config && global.config.language) || "en";
    const table = langs[code] || langs.en || langs.vi || Object.values(langs)[0] || {};
    let text = table[key];
    if (text == null) text = (langs.en && langs.en[key]) || (langs.vi && langs.vi[key]);
    if (text == null) text = key;
    args.forEach((a, i) => { text = String(text).split(`%${i + 1}`).join(a); });
    return text;
  };
}


const globalDataFile = path.join(__dirname, "utils", "data", "goatGlobalData.json");
let globalStore = null;
let saveTimer = null;
function loadGlobalStore() {
  if (globalStore) return globalStore;
  try { globalStore = JSON.parse(fs.readFileSync(globalDataFile, "utf8")); }
  catch (e) { globalStore = {}; }
  return globalStore;
}
function saveGlobalStore() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(globalDataFile), { recursive: true });
      fs.writeFileSync(globalDataFile, JSON.stringify(globalStore || {}, null, 2));
    } catch (e) { console.error("[ GoatCompat ] globalData save failed:", e.message); }
  }, 500);
}
const globalData = {
  async create(key, data = {}) {
    const store = loadGlobalStore();
    if (!store[key]) store[key] = { key, data: {}, ...clone(data) };
    saveGlobalStore();
    return clone(store[key]);
  },
  async get(key, p, defaultValue) {
    const store = loadGlobalStore();
    if (!store[key]) store[key] = { key, data: {} };
    return p == null ? clone(store[key]) : clone(getPath(store[key], p, defaultValue));
  },
  async set(key, value, p) {
    const store = loadGlobalStore();
    if (!store[key]) store[key] = { key, data: {} };
    if (p != null) setPath(store[key], p, value);
    else Object.assign(store[key], value);
    saveGlobalStore();
    return clone(store[key]);
  },
  async getAll() { return Object.values(loadGlobalStore()).map(clone); },
  async delete(key) { delete loadGlobalStore()[key]; saveGlobalStore(); return true; },
  async deleteKey(key, p) { const s = loadGlobalStore(); if (s[key]) unsetPath(s[key], p); saveGlobalStore(); return true; },
};
const dashBoardData = {
  get: async () => null, set: async () => null, create: async () => null, getAll: async () => [],
  delete: async () => true, deleteKey: async () => true,
};


function buildDataApis(ctx) {
  const C = (global.client && global.client.controllers) || {};
  const Users = ctx.Users || C.Users, Threads = ctx.Threads || C.Threads, Currencies = ctx.Currencies || C.Currencies;
  const api = ctx.api || (global.client && global.client.api);
  const EXTRA = "__goat";


  const ensureCurrency = async (id) => {
    if (!Currencies) return null;
    let c = await Currencies.getData(String(id));
    if (!c) { await Currencies.createData(String(id), { data: {} }); c = await Currencies.getData(String(id)); }
    return c || null;
  };
  const buildUser = (row, cur) => {
    const data = clone(row.data) || {};
    const extra = data[EXTRA] || {};
    delete data[EXTRA];
    const id = String(row.userID);
    return Object.assign({
      userID: id,
      name: row.name || "Facebook user",
      gender: row.gender,
      money: cur ? Number(cur.money) || 0 : 0,
      exp: cur ? Number(cur.exp) || 0 : 0,
      banned: { status: global.data.userBanned.has(id), reason: (global.data.userBanned.get(id) || {}).reason || "" },
      settings: {},
      data,
    }, extra);
  };
  const getUserDoc = async (id) => {
    id = String(id);
    let row = await Users.getData(id);
    if (!row) {
      let info = {};
      try { info = (await Users.getInfo(id)) || {}; } catch (e) {}
      await Users.createData(id, { name: info.name || "Facebook user", gender: info.gender, data: {} });
      if (info.name) global.data.userName.set(id, info.name);
      if (!global.data.allUserID.includes(id)) global.data.allUserID.push(id);
      row = await Users.getData(id);
    }
    if (!row) return null;
    return buildUser(row, await ensureCurrency(id));
  };
  const persistUser = async (id, doc, keys) => {
    id = String(id);
    const row = (await Users.getData(id)) || {};
    const upd = {};
    const baseData = clone(row.data) || {};
    const extra = baseData[EXTRA] || {};
    let dataTouched = false;
    const cur = {};
    for (const k of keys) {
      if (k === "money" || k === "exp") cur[k] = Math.trunc(Number(doc[k]) || 0);
      else if (k === "name" || k === "gender") upd[k] = doc[k];
      else if (k === "data") { Object.assign(baseData, {}); for (const kk of Object.keys(baseData)) if (kk !== EXTRA) delete baseData[kk]; Object.assign(baseData, clone(doc.data) || {}); dataTouched = true; }
      else if (k !== "userID") { extra[k] = clone(doc[k]); dataTouched = true; }
    }
    if (dataTouched) { baseData[EXTRA] = extra; upd.data = baseData; }
    if (Object.keys(upd).length) {
      if (upd.name) global.data.userName.set(id, upd.name);
      await Users.setData(id, upd);
    }
    if (Currencies && Object.keys(cur).length) { await ensureCurrency(id); await Currencies.setData(id, cur); }
  };

  const usersData = {
    get: async (id, p, defaultValue) => {
      if (!Users) return null;
      const doc = await getUserDoc(id);
      return p == null ? doc : getPath(doc, p, defaultValue);
    },
    set: async (id, value, p) => {
      const doc = await getUserDoc(id);
      let keys;
      if (p != null) { setPath(doc, p, value); keys = [toPath(p)[0]]; }
      else { Object.assign(doc, value); keys = Object.keys(value || {}); }
      await persistUser(id, doc, keys);
      return doc;
    },
    deleteKey: async (id, p) => {
      const doc = await getUserDoc(id);
      unsetPath(doc, p);
      await persistUser(id, doc, [toPath(p)[0]]);
      return true;
    },
    create: async (id, data = {}) => {
      await Users.createData(String(id), data);
      return getUserDoc(id);
    },
    getAll: async (p) => {
      const rows = await Users.getAll();
      const curs = Currencies ? await Currencies.getAll() : [];
      const map = new Map(curs.map(c => [String(c.userID), c]));
      const docs = rows.map(r => buildUser(r, map.get(String(r.userID))));
      return p == null ? docs : docs.map(d => getPath(d, p));
    },
    getName: async (id) => (Users ? Users.getNameUser(String(id)) : "Facebook user"),
    getAvatarUrl: async (id) => `https://graph.facebook.com/${id}/picture?width=720&height=720`,
    refreshInfo: async (id) => {
      const info = await Users.getInfo(String(id));
      if (info && info.name) await Users.setData(String(id), { name: info.name, gender: info.gender });
      if (info && info.name) global.data.userName.set(String(id), info.name);
      return getUserDoc(id);
    },
    addMoney: async (id, money) => {
      const c = await ensureCurrency(id);
      await Currencies.setData(String(id), { money: (Number(c.money) || 0) + Math.trunc(Number(money) || 0) });
      return true;
    },
    subtractMoney: async (id, money) => {
      const c = await ensureCurrency(id);
      await Currencies.setData(String(id), { money: (Number(c.money) || 0) - Math.trunc(Number(money) || 0) });
      return true;
    },
  };


  const buildThread = (row) => {
    const info = clone(row.threadInfo) || {};
    const data = clone(row.data) || {};
    const settings = data.settings || {};
    delete data.settings;
    let adminIDs = [];
    if (Array.isArray(info.adminIDs)) adminIDs = info.adminIDs.map(a => String(a && a.id != null ? a.id : a));
    let members = [];
    if (Array.isArray(info.participantIDs))
      members = info.participantIDs.map(uid => ({
        userID: String(uid),
        name: global.data.userName.get(String(uid)) || "Facebook user",
        count: 0,
        inGroup: true
      }));
    const id = String(row.threadID);
    const isGroup = info.isGroup != null ? !!info.isGroup : members.length > 2;
    return {
      threadID: id,
      threadName: info.threadName || "",
      emoji: info.emoji,
      avatar: info.imageSrc || "",
      approvalMode: !!info.approvalMode,
      adminIDs, members, isGroup,
      banned: { status: global.data.threadBanned.has(id), reason: (global.data.threadBanned.get(id) || {}).reason || "" },
      settings, data,
      threadInfo: info,
    };
  };
  const getThreadDoc = async (id) => {
    const row = await Threads.getData(String(id));
    return row ? buildThread(row) : null;
  };
  const persistThread = async (id, doc, keys) => {
    id = String(id);
    const row = (await Threads.getData(id)) || {};
    const info = clone(row.threadInfo) || {};
    const data = clone(row.data) || {};
    const upd = {};
    let infoTouched = false, dataTouched = false;
    for (const k of keys) {
      if (k === "data") { const s = data.settings; for (const kk of Object.keys(data)) delete data[kk]; Object.assign(data, clone(doc.data) || {}); if (s !== undefined) data.settings = s; dataTouched = true; }
      else if (k === "settings") { data.settings = clone(doc.settings) || {}; dataTouched = true; }
      else if (k === "threadName" || k === "emoji" || k === "approvalMode") { info[k] = doc[k]; infoTouched = true; }
      else if (k === "avatar") { info.imageSrc = doc.avatar; infoTouched = true; }
      else if (k === "adminIDs") { info.adminIDs = (doc.adminIDs || []).map(a => ({ id: String(a) })); infoTouched = true; }
      else if (k === "members") { info.participantIDs = (doc.members || []).filter(m => m.inGroup !== false).map(m => String(m.userID)); infoTouched = true; }
    }
    if (infoTouched) upd.threadInfo = info;
    if (dataTouched) upd.data = data;
    if (Object.keys(upd).length) {
      if (row.threadID === undefined) await Threads.createData(id, upd);
      else await Threads.setData(id, upd);
    }
  };

  const threadsData = {
    get: async (id, p, defaultValue) => {
      if (!Threads) return p == null ? null : defaultValue;
      let doc = await getThreadDoc(id);
      if (!doc && api) {
        try {
          const info = await Threads.getInfo(String(id));
          if (info) { await Threads.createData(String(id), { threadInfo: info, data: {} }); doc = await getThreadDoc(id); }
        } catch (e) {}
      }
      if (p == null) return doc;
      return doc ? getPath(doc, p, defaultValue) : defaultValue;
    },
    set: async (id, value, p) => {
      let doc = await getThreadDoc(id);
      if (!doc) { await Threads.createData(String(id), { threadInfo: {}, data: {} }); doc = await getThreadDoc(id); }
      let keys;
      if (p != null) { setPath(doc, p, value); keys = [toPath(p)[0]]; }
      else { Object.assign(doc, value); keys = Object.keys(value || {}); }
      await persistThread(id, doc, keys);
      return doc;
    },
    deleteKey: async (id, p) => {
      const doc = await getThreadDoc(id);
      if (!doc) return true;
      unsetPath(doc, p);
      await persistThread(id, doc, [toPath(p)[0]]);
      return true;
    },
    create: async (id, data = {}) => {
      await Threads.createData(String(id), data);
      return getThreadDoc(id);
    },
    getAll: async (p) => {
      const rows = await Threads.getAll();
      const docs = rows.map(buildThread);
      return p == null ? docs : docs.map(d => getPath(d, p));
    },
    refreshInfo: async (id) => {
      const info = await Threads.getInfo(String(id));
      const row = await Threads.getData(String(id));
      if (row) await Threads.setData(String(id), { threadInfo: info });
      else await Threads.createData(String(id), { threadInfo: info, data: {} });
      return getThreadDoc(id);
    },
    getInfo: (id) => Threads.getInfo(String(id)),
  };
  return { usersData, threadsData };
}


function withGoatCtx(goat, ctx) {
  const { usersData, threadsData } = buildDataApis(ctx);
  const prefix = (global.utils && global.utils.getPrefix)
    ? global.utils.getPrefix(ctx.event && ctx.event.threadID)
    : ((global.config && global.config.PREFIX) || "!");
  const name = (goat.config && goat.config.name) || "";
  const models = ctx.models || (global.client && global.client.models);
  const useModel = (n) => { try { return models && models.use(n); } catch (e) { return undefined; } };
  const gb = global.GoatBot || {};
  return Object.assign({}, ctx, {
    message: makeMessage(goat, ctx.api, ctx.event || {}),
    getLang: makeGetLang(goat),
    usersData,
    threadsData,
    globalData,
    dashBoardData,
    threadModel: useModel("Threads"),
    userModel: useModel("Users"),
    globalModel: undefined,
    dashBoardModel: undefined,

    Reply: ctx.handleReply || ctx.Reply,
    Reaction: ctx.handleReaction || ctx.Reaction,
    commandName: ctx.commandName || name,

    role: ctx.permssion != null ? Math.min(ctx.permssion, 3) : (ctx.role || 0),
    prefix,
    removeCommandNameFromBody: (body, pfx, n) => {
      const b = body != null ? body : (ctx.event && ctx.event.body) || "";
      const p = pfx != null ? pfx : prefix;
      const nn = n != null ? n : name;
      const esc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return String(b).replace(new RegExp(`^${esc(p)}(\\s+|)${esc(nn)}`, "i"), "").trim();
    },
    envCommands: (() => { const e = Object.assign({}, gb.envCommands); if (!e[name]) e[name] = (goat.config && goat.config.envConfig) || {}; return e; })(),
    envEvents: (() => { const e = Object.assign({}, gb.envEvents); if (!e[name]) e[name] = (goat.config && goat.config.envConfig) || {}; return e; })(),
    envGlobal: gb.envGlobal || {},
    isUserCallCommand: ctx.isUserCallCommand === undefined ? false : ctx.isUserCallCommand,
  });
}


let _dbSyncStarted = false;
async function syncGoatDb() {
  const C = (global.client && global.client.controllers) || {};
  if (!global.db) return;
  try {
    if (C.Users && C.Users.getAll) {
      const users = await C.Users.getAll();
      global.db.allUserData = (users || []).map(u => ({ userID: String(u.userID), name: u.name, gender: u.gender, data: (u.data && typeof u.data === "object") ? u.data : {}, money: 0, exp: 0 }));
    }
  } catch (e) {}
  try {
    if (C.Threads && C.Threads.getAll) {
      const threads = await C.Threads.getAll();
      global.db.allThreadData = (threads || []).map(t => {
        const info = t.threadInfo || {};
        return { threadID: String(t.threadID), threadName: info.threadName, adminIDs: info.adminIDs || [], members: [], data: (t.data && typeof t.data === "object") ? t.data : {}, settings: {} };
      });
    }
  } catch (e) {}
}
function startDbSync() {
  if (_dbSyncStarted) return;
  _dbSyncStarted = true;
  setTimeout(syncGoatDb, 8000).unref();
  setInterval(syncGoatDb, 5 * 60 * 1000).unref();
}

function ensureGoatBot() {
  if (!global.GoatBot) global.GoatBot = {};
  const gb = global.GoatBot;
  const cfg = global.config || {};


  if (!gb._cfgLinked) {
    const derived = Object.create(cfg);
    Object.defineProperties(derived, {
      adminBot: { enumerable: false, get: () => (global.config.ADMINBOT || []), set() {} },
      prefix: { enumerable: false, get: () => global.config.PREFIX, set() {} },
      language: { enumerable: false, get: () => global.config.language || "en", set() {} },
      owner: { enumerable: false, get: () => (global.config.ADMINBOT || [])[0], set() {} },
    });
    derived.adminOnly = { enable: false, ignoreCommand: [], notes: "" };
    derived.whiteListMode = derived.whiteListMode || { enable: false, whiteListIds: [] };
    derived.timeZone = "Asia/Dhaka";
    derived.optionsFca = cfg.FCAOption || {};
    gb.config = derived;
    gb._cfgLinked = true;
  }
  gb.startTime = gb.startTime || Date.now();
  gb.configCommands = gb.configCommands || {};
  gb.envCommands = gb.envCommands || {};
  gb.envEvents = gb.envEvents || {};
  gb.envGlobal = gb.envGlobal || {};
  gb.shortcutData = gb.shortcutData || {};
  gb.commandFilesPath = gb.commandFilesPath || [];
  gb.eventCommands = gb.eventCommands || new Map();
  gb.eventCommandsFilesPath = gb.eventCommandsFilesPath || [];

  const mirror = (goatMap, clientKey) => {
    if (goatMap && goatMap._mirrored) return goatMap;
    const map = goatMap instanceof Map ? goatMap : new Map(goatMap);
    const origSet = map.set.bind(map);
    const origDelete = map.delete.bind(map);
    const findIdx = (mid) => {
      const arr = global.client && global.client[clientKey];
      if (!Array.isArray(arr)) return -1;
      return arr.findIndex(e => e && (e.messageID == mid || e._goatKey == mid));
    };
    map.set = (key, value) => {
      origSet(key, value);
      const arr = global.client && global.client[clientKey];
      if (Array.isArray(arr) && value && value.commandName) {
        const i = findIdx(key);
        const entry = Object.assign({ name: value.commandName, messageID: value.messageID || key, _goatKey: key }, value);
        if (i >= 0) arr[i] = entry; else arr.push(entry);
      }
      return map;
    };
    map.delete = (key) => {
      const i = findIdx(key);
      if (i >= 0 && global.client && Array.isArray(global.client[clientKey]))
        global.client[clientKey].splice(i, 1);
      return origDelete(key);
    };
    map._mirrored = true;
    return map;
  };
  gb.onReply = mirror(gb.onReply, "handleReply");
  gb.onReaction = mirror(gb.onReaction, "handleReaction");
  if (!Array.isArray(gb.onEvent)) gb.onEvent = [];
  if (!Array.isArray(gb.onChat)) gb.onChat = [];

  if (!gb._commandsLinked) {
    try {
      Object.defineProperty(gb, "commands", {
        configurable: true,
        get: () => (global.client && global.client.commands) || new Map(),
      });
    } catch (e) { gb.commands = (global.client && global.client.commands) || new Map(); }
    const aliasMap = new Map();
    aliasMap.get = (alias) => {
      const cmds = global.client && global.client.commands;
      if (!cmds) return undefined;
      const cmd = cmds.get(String(alias).toLowerCase());
      return cmd && cmd.config ? cmd.config.name : undefined;
    };
    aliasMap.has = (alias) => aliasMap.get(alias) !== undefined;
    gb.aliases = aliasMap;
    gb._commandsLinked = true;
  }


  const api = (global.client && global.client.api) || null;
  if (api && !gb.fcaApi) gb.fcaApi = api;
  if (gb.botID == null && api && typeof api.getCurrentUserID === "function") {
    try { gb.botID = api.getCurrentUserID(); } catch (e) {}
  }

  if (!global.temp) global.temp = {};
  if (!global.language) global.language = cfg.language || "en";
  const cl = global.client || (global.client = {});
  const nodePath = require("path");
  const rootDir = cl.mainPath || process.cwd();
  cl.dirConfig = cl.dirConfig || nodePath.join(rootDir, "config.json");
  cl.dirConfigCommands = cl.dirConfigCommands || nodePath.join(rootDir, "configCommands.json");
  cl.busyList = cl.busyList || {};
  try { const fsx = require("fs"); if (!fsx.existsSync(cl.dirConfigCommands)) fsx.writeFileSync(cl.dirConfigCommands, "{}"); } catch (e) {}
  gb.configCommands.envGlobal = gb.configCommands.envGlobal || gb.envGlobal;
  gb.configCommands.envCommands = gb.configCommands.envCommands || gb.envCommands;
  gb.configCommands.envEvents = gb.configCommands.envEvents || gb.envEvents;
  if (!global.db) global.db = { allUserData: [], allThreadData: [], allGlobalData: [], allDashBoardData: [], dashBoardData: [] };
  startDbSync();
  try { augmentGlobalUtils(); } catch (e) { console.error("[ GoatCompat ] utils augment failed:", e.message); }
  return gb;
}


function augmentGlobalUtils() {
  if (!global.utils || typeof global.utils !== "object") global.utils = {};
  const u = global.utils;
  const missing = (k) => u[k] === undefined;

  if (missing("getStreamFromURL")) {
    u.getStreamFromURL = async function (url, pathName) {
      const axios = require("axios");
      const res = await axios({ url, method: "GET", responseType: "stream" });
      if (pathName) res.data.path = pathName;
      return res.data;
    };
  }
  if (missing("getStreamsFromAttachment")) {
    u.getStreamsFromAttachment = async function (attachments) {
      if (!Array.isArray(attachments)) return [];
      const out = [];
      for (const a of attachments) {
        const url = a && (a.url || a.previewUrl || a.largePreviewUrl);
        if (url) { try { out.push(await u.getStreamFromURL(url)); } catch (e) {} }
      }
      return out;
    };
  }
  if (missing("getExtFromUrl")) {
    u.getExtFromUrl = function (url) {
      try {
        const m = new URL(url).pathname.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        return m ? m[1].toLowerCase() : "";
      } catch (e) { return ""; }
    };
  }
  if (missing("getExtFromAttachmentType")) {
    u.getExtFromAttachmentType = function (type) {
      switch (type) {
        case "photo": return "png";
        case "animated_image": return "gif";
        case "video": return "mp4";
        case "audio": return "mp3";
        default: return "";
      }
    };
  }
  if (missing("sleep")) u.sleep = (ms) => new Promise(r => setTimeout(r, ms));
  if (missing("randomNumber")) {
    u.randomNumber = function (min, max) {
      if (max === undefined) { max = min; min = 0; }
      min = Math.ceil(min); max = Math.floor(max);
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };
  }
  if (missing("convertTime")) {
    u.convertTime = function (ms, style) {
      const s = Math.floor(ms / 1000);
      const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
      const p = (n) => String(n).padStart(2, "0");
      if (style === "short") return `${h + d * 24}:${p(m)}:${p(sec)}`;
      return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${sec}s`].filter(Boolean).join(" ");
    };
  }
  if (missing("translate")) {
    u.translate = async function (text, lang = "en") {
      const axios = require("axios");
      const res = await axios.get("https://translate.googleapis.com/translate_a/single", {
        params: { client: "gtx", sl: "auto", tl: lang, dt: "t", q: text }, timeout: 15000
      });
      return (res.data[0] || []).map(x => x[0]).join("");
    };
  }
  if (missing("shortenURL")) {
    u.shortenURL = async function (url) {
      const axios = require("axios");
      try {
        const res = await axios.get("https://tinyurl.com/api-create.php", { params: { url }, timeout: 15000 });
        return String(res.data);
      } catch (e) { return url; }
    };
  }
  if (missing("findUid")) {
    u.findUid = async function (link) {
      const api = global.client && global.client.api;
      if (!api) throw new Error("Bot is not logged in");
      return await api.getUID(link);
    };
  }
  if (missing("getUID")) u.getUID = (link) => u.findUid(link);
  if (missing("uploadImgbb")) {
    u.uploadImgbb = async function () { throw new Error("uploadImgbb needs an imgbb API key — not configured on this bot"); };
  }
  if (missing("drive")) {
    u.drive = { get: async () => { throw new Error("Google Drive helper is not configured on this bot"); } };
  }

  if (missing("getTime")) {
    u.getTime = function (a, b) {
      const moment = require("moment-timezone");
      let ts, format;
      if (typeof a === "string" && b === undefined) { format = a; }
      else { ts = a; format = b; }
      return moment(ts || Date.now()).tz((global.GoatBot && global.GoatBot.config.timeZone) || "Asia/Dhaka")
        .format(format || "DD/MM/YYYY HH:mm:ss");
    };
  }
  if (missing("log")) {
    const chalk = (() => { try { return require("chalk"); } catch (e) { return null; } })();
    const paint = (fn, t) => (chalk && chalk[fn] ? chalk[fn](t) : t);
    const mk = (tag, color) => (...args) => console.log(paint(color, tag), ...args);
    u.log = mk("[ LOG ]", "cyan");
    u.log.info = mk("[ INFO ]", "green");
    u.log.success = mk("[ SUCCESS ]", "green");
    u.log.warn = mk("[ WARN ]", "yellow");
    u.log.err = mk("[ ERROR ]", "red");
    u.log.error = u.log.err;
    u.log.master = mk("[ MASTER ]", "magenta");
    u.log.dev = (...args) => { if (global.config && global.config.DeveloperMode) console.log(paint("blue", "[ DEV ]"), ...args); };
  }
  if (missing("colors")) {
    try { u.colors = require("chalk"); } catch (e) {}
  }
  if (missing("getPrefix")) {
    u.getPrefix = function (threadID) {
      try {
        const t = global.data.threadData.get(String(threadID)) || {};
        if (Object.prototype.hasOwnProperty.call(t, "PREFIX") && t.PREFIX) return t.PREFIX;
      } catch (e) {}
      return (global.config && global.config.PREFIX) || "!";
    };
  }
  if (missing("removeHomeDir")) {
    const os = require("os");
    u.removeHomeDir = function (text) {
      try { return String(text).split(os.homedir()).join("~"); } catch (e) { return text; }
    };
  }
  if (missing("downloadFile")) {
    u.downloadFile = async function (url, destPath) {
      const axios = require("axios");
      const fsx = require("fs-extra");
      const res = await axios.get(url, { responseType: "arraybuffer" });
      await fsx.outputFile(destPath, Buffer.from(res.data));
      return destPath;
    };
  }
  if (missing("getExtFromMimeType")) {
    u.getExtFromMimeType = function (mime) {
      const map = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "video/mp4": "mp4", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/wav": "wav", "application/pdf": "pdf", "text/plain": "txt", "application/json": "json" };
      return map[String(mime || "").split(";")[0].trim().toLowerCase()] || "";
    };
  }
  if (missing("splitPage")) {
    u.splitPage = function (arr, limit) {
      const allPage = [];
      for (let i = 0; i < arr.length; i += limit) allPage.push(arr.slice(i, i + limit));
      return { totalPage: allPage.length, allPage };
    };
  }
  if (missing("getStreamFromUrl")) u.getStreamFromUrl = (...a) => u.getStreamFromURL(...a);
  if (missing("randomString")) {
    u.randomString = function (max, onlyOnce = false, possible) {
      const chars = possible || "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let out = "";
      for (let i = 0; i < (max || 10); i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
      return out;
    };
  }
  if (missing("getType")) u.getType = (v) => Object.prototype.toString.call(v).slice(8, -1);
  if (missing("isHexColor")) u.isHexColor = (c) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(c));
  if (missing("loadScripts")) u.loadScripts = loadScripts;
  if (missing("unloadScripts")) u.unloadScripts = unloadScripts;
  if (missing("isNumber")) u.isNumber = (v) => !isNaN(parseFloat(v)) && isFinite(v);
  if (missing("jsonStringifyColor")) u.jsonStringifyColor = (o) => JSON.stringify(o, null, 2);
}


function findScriptFile(base, fileName) {
  const fsx = require("fs"), pth = require("path");
  const want = fileName.endsWith(".js") ? fileName : fileName + ".js";
  const walk = (d) => {
    for (const e of fsx.readdirSync(d, { withFileTypes: true })) {
      const full = pth.join(d, e.name);
      if (e.isDirectory()) { const r = walk(full); if (r) return r; }
      else if (e.name === want) return full;
    }
    return null;
  };
  return walk(base);
}
function dropFromCollection(coll, item) {
  for (const [k, v] of Array.from(coll.entries())) if (v === item) coll.delete(k);
  const reg = global.client.eventRegistered;
  if (Array.isArray(reg) && item && item.config) {
    const i = reg.indexOf(item.config.name);
    if (i >= 0) reg.splice(i, 1);
  }
}
function loadScripts(folder, fileName, log, configCommands, api, a1, a2, a3, a4, threadsData, usersData, a5, a6, getLang, rawCode) {
  const fsx = require("fs"), pth = require("path");
  const isCmd = folder === "cmds";
  const root = (global.client && global.client.mainPath) || process.cwd();
  const base = pth.join(root, "script", isCmd ? "cmds" : "events");
  try {
    let file = findScriptFile(base, fileName);
    if (rawCode) {
      file = file || pth.join(base, "tools", fileName.endsWith(".js") ? fileName : fileName + ".js");
      fsx.mkdirSync(pth.dirname(file), { recursive: true });
      fsx.writeFileSync(file, rawCode);
    }
    if (!file) throw new Error(`File "${fileName}" not found`);
    delete require.cache[require.resolve(file)];
    let item = require(file);
    if (isCmd && isGoatCommand(item)) item = wrapGoat(item);
    else if (!isCmd && isGoatEvent(item)) item = wrapGoatEvent(item);
    if (!item.config || !item.config.name || !item.run) throw new Error("Invalid command/event format");
    const coll = global.client[isCmd ? "commands" : "events"];
    const old = coll.get(item.config.name);
    if (old) dropFromCollection(coll, old);
    coll.set(item.config.name, item);
    if (isCmd && Array.isArray(item.config.aliases))
      for (const al of item.config.aliases) { const a = String(al).toLowerCase().trim(); if (a && !coll.has(a)) coll.set(a, item); }
    if (item.handleEvent && !global.client.eventRegistered.includes(item.config.name)) global.client.eventRegistered.push(item.config.name);
    const C = global.client.controllers || {};
    if (typeof item.onLoad === "function")
      Promise.resolve(item.onLoad({ api: api || global.client.api, models: global.client.models, Users: C.Users, Threads: C.Threads, Currencies: C.Currencies })).catch(e => console.error(e));
    return { status: "success", name: item.config.name };
  } catch (err) {
    return { status: "failed", name: fileName, error: err, errorWithThoutRemoveHomeDir: err };
  }
}
function unloadScripts(folder, fileName, configCommands, getLang) {
  const isCmd = folder === "cmds";
  try {
    const coll = global.client[isCmd ? "commands" : "events"];
    const item = coll.get(String(fileName).replace(/\.js$/, "").toLowerCase()) || coll.get(String(fileName).replace(/\.js$/, ""));
    if (!item) throw new Error(`"${fileName}" is not loaded`);
    dropFromCollection(coll, item);
    return { status: "success", name: item.config.name };
  } catch (err) {
    return { status: "failed", name: fileName, error: err, errorWithThoutRemoveHomeDir: err };
  }
}


function wrapGoat(goat) {
  const g = goat.config || {};
  const wrapped = {
    config: {
      name: g.name,
      version: g.version || "1.0",
      hasPermssion: g.role != null ? Math.min(Number(g.role) || 0, 3) : 0,
      credits: g.author || "Goat",
      description: pickText(g.description || g.shortDescription || g.longDescription) || "Goat Bot V2 command",
      commandCategory: pickText(g.category) || "Goat",
      usages: pickText(g.guide),
      cooldowns: g.countDown != null ? g.countDown : 5,
      aliases: Array.isArray(g.aliases) ? g.aliases : [],
      envConfig: g.envConfig,

      role: g.role, category: g.category, guide: g.guide, longDescription: g.longDescription,
      shortDescription: g.shortDescription, author: g.author, countDown: g.countDown,
    },
    _goat: goat,
    run: function (ctx) {
      if (typeof goat.onStart !== "function") return undefined;
      return goat.onStart.call(goat, withGoatCtx(goat, ctx));
    },
  };
  if (g.langs && !goat.langs) goat.langs = g.langs;
  if (typeof goat.onEvent === "function") {
    const gb = ensureGoatBot();
    for (let i = gb.onEvent.length - 1; i >= 0; i--)
      if (gb.onEvent[i] && gb.onEvent[i]._compat && gb.onEvent[i].commandName === g.name) gb.onEvent.splice(i, 1);
    gb.onEvent.push({
      commandName: g.name, _compat: true,
      onStart: (c) => goat.onEvent.call(goat, withGoatCtx(goat, Object.assign({ api: global.client && global.client.api }, c))),
    });
  }
  if (typeof goat.onLoad === "function") {
    wrapped.onLoad = function (ctx) { return goat.onLoad.call(goat, withGoatCtx(goat, ctx)); };
  }
  if (typeof goat.onReply === "function") {
    wrapped.handleReply = function (ctx) { return goat.onReply.call(goat, withGoatCtx(goat, ctx)); };
  }
  if (typeof goat.onReaction === "function") {
    wrapped.handleReaction = function (ctx) { return goat.onReaction.call(goat, withGoatCtx(goat, ctx)); };
  }
  if (["onChat", "onAnyEvent", "onFirstChat"].some(k => typeof goat[k] === "function")) {
    const seenThreads = new Set();
    wrapped.handleEvent = async function (ctx) {
      const gctx = withGoatCtx(goat, ctx);
      const tid = String((ctx.event && ctx.event.threadID) || "");
      if (typeof goat.onFirstChat === "function" && tid && !seenThreads.has(tid)) {
        seenThreads.add(tid);
        try { await goat.onFirstChat.call(goat, gctx); } catch (e) { console.error(`[ GoatCompat ] onFirstChat "${g.name}" error:`, e); }
      }
      if (typeof goat.onAnyEvent === "function") {
        try { await goat.onAnyEvent.call(goat, gctx); } catch (e) { console.error(`[ GoatCompat ] onAnyEvent "${g.name}" error:`, e); }
      }
      if (typeof goat.onChat === "function") return goat.onChat.call(goat, gctx);
    };
  }
  return wrapped;
}


function wrapGoatEvent(goat) {
  const g = goat.config || {};
  if (g.langs && !goat.langs) goat.langs = g.langs;
  return {
    config: {
      name: g.name,
      version: g.version || "1.0",
      credits: g.author || "Goat",
      description: pickText(g.description || g.shortDescription) || "Goat Bot V2 event",
      eventType: Array.isArray(g.eventType) && g.eventType.length ? g.eventType : LOG_TYPES,
      envConfig: g.envConfig,
    },
    _goat: goat,
    run: function (ctx) {
      return Promise.resolve(goat.onStart.call(goat, withGoatCtx(goat, ctx)))
        .catch(err => console.error(`[ GoatCompat ] Event "${g.name}" error:`, err));
    },
    onLoad: typeof goat.onLoad === "function"
      ? function (ctx) { return goat.onLoad.call(goat, withGoatCtx(goat, ctx)); }
      : undefined,
  };
}

module.exports = { isGoatCommand, isGoatEvent, isGoatModule, wrapGoat, wrapGoatEvent, ensureGoatBot, withGoatCtx, LOG_TYPES };
