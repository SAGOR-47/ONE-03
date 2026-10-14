


const path = require("path");

function ensureRGlobals(api) {
  const cfg = global.config;
  if (!global.nodemodule) {
    global.nodemodule = new Proxy({}, {
      get(target, name) {
        if (!(name in target)) {
          try { target[name] = require(name); }
          catch (e) { target[name] = require(path.join(global.client.mainPath, "node_modules", String(name))); }
        }
        return target[name];
      }
    });
  }
  if (!Array.isArray(cfg.operators)) cfg.operators = (cfg.NDH || []).map(String);
  if (!Array.isArray(cfg.disabledcmds)) cfg.disabledcmds = [];
  if (!Array.isArray(cfg.haspremiumcmd)) cfg.haspremiumcmd = [];
  if (cfg.premium === undefined) cfg.premium = false;
  if (!global.send && api) {
    global.send = (msg, threadID, cb, mid) => api.sendMessage(msg, threadID, cb, mid);
  }


  try {
    const hr = global.client && global.client.handleReply;
    if (Array.isArray(hr) && typeof hr.get !== "function") {
      hr.get = function (botid) {
        const self = this;
        const filtered = botid == null ? this.slice() : this.filter(x => !x || x.botid == null || String(x.botid) === String(botid));

        filtered.push = function (...args) { return self.push(...args); };
        return filtered;
      };
      hr.set = function (botid, arr) {
        for (let i = this.length - 1; i >= 0; i--) {
          const x = this[i];
          if (x && x.botid != null && String(x.botid) === String(botid)) this.splice(i, 1);
        }
        if (Array.isArray(arr)) this.push(...arr);
        return this;
      };
      hr.has = function () { return true; };
    }
    const hre = global.client && global.client.handleReaction;
    if (Array.isArray(hre) && typeof hre.get !== "function") {
      hre.get = function (botid) {
        const self = this;
        const filtered = botid == null ? this.slice() : this.filter(x => !x || x.botid == null || String(x.botid) === String(botid));
        filtered.push = function (...args) { return self.push(...args); };
        return filtered;
      };
      hre.set = function (botid, arr) {
        for (let i = this.length - 1; i >= 0; i--) {
          const x = this[i];
          if (x && x.botid != null && String(x.botid) === String(botid)) this.splice(i, 1);
        }
        if (Array.isArray(arr)) this.push(...arr);
        return this;
      };
      hre.has = function () { return true; };
    }
  } catch (e) {}
}


const isRCommand = (mod) => !!(mod && mod.config && typeof mod.run === "function" &&
  !mod.config.commandCategory && (mod.config.category !== undefined || mod.config.permission !== undefined || mod.config.prefix !== undefined));

function extras(api, event) {
  const senderID = String(event && event.senderID || "");
  let threadPrefix = global.config.PREFIX;
  try {
    const td = global.data.threadData.get(String(event.threadID)) || {};
    if (td.PREFIX) threadPrefix = td.PREFIX;
  } catch (e) {}
  return {
    prefix: threadPrefix,
    botname: global.config.BOTNAME || "bot",
    admin: (global.config.ADMINBOT || []).map(String),
    operator: (global.config.NDH || []).map(String),
    botid: (api && api.getCurrentUserID && api.getCurrentUserID()) || global.client.botID,
    senderID
  };
}

function wrapFn(fn) {
  if (typeof fn !== "function") return fn;
  return function (obj) {
    return fn.call(this, Object.assign({}, extras(obj && obj.api, obj && obj.event), obj));
  };
}

function wrapR(mod) {
  const c = mod.config;
  c.commandCategory = String(c.category || "misc");
  if (c.hasPermssion === undefined) c.hasPermssion = Number(c.permission || 0);
  if (c.usages === undefined) c.usages = c.usage || c.guide || c.description || "";
  if (c.cooldowns === undefined) c.cooldowns = 0;
  if (typeof c.credits !== "string") c.credits = "Sagor";
  if (c.description && typeof c.description !== "string") c.description = String(c.description.en || Object.values(c.description)[0] || "");
  for (const k of ["run", "handleEvent", "handleReply", "handleReaction", "onLoad"]) {
    if (k !== "onLoad") mod[k] = wrapFn(mod[k]);
  }
  mod.__r = true;
  return mod;
}


function wrapREvent(mod) {
  if (mod && typeof mod.run === "function" && !mod.__r) {
    mod.run = wrapFn(mod.run);
    mod.__r = true;
  }
  return mod;
}

module.exports = { isRCommand, wrapR, wrapREvent, ensureRGlobals };
