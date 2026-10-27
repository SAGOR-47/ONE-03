const { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, rm } = require("fs-extra");
const { join, resolve } = require("path");
const { execSync } = require('child_process');
const logger = require("./utils/log.js");

const login = require('../sagor-fca')
const fs = require('fs-extra');
const moment = require('moment-timezone');
if (!fs.existsSync('./core/utils/data')) {
  fs.mkdirSync('./core/utils/data', { recursive: true });
}
global.client = {
  commands: new Map(),
  events: new Map(),
  cooldowns: new Map(),
  eventRegistered: [],
  handleReaction: [],
  handleReply: [],
  mainPath: process.cwd(),
  configPath: "",
  getTime: option => moment.tz("Asia/Dhaka").format({ seconds: "ss", minutes: "mm", hours: "HH", date: "DD", month: "MM", year: "YYYY", fullHour: "HH:mm:ss", fullYear: "DD/MM/YYYY", fullTime: "HH:mm:ss DD/MM/YYYY" }[option])
};
global.data = new Object({
    threadInfo: new Map(),
    threadData: new Map(),
    userName: new Map(),
    userBanned: new Map(),
    threadBanned: new Map(),
    commandBanned: new Map(),
    threadAllowNSFW: new Array(),
    allUserID: new Array(),
    allCurrenciesID: new Array(),
    allThreadID: new Array()
});
global.utils = require("./utils/func");
global.config = require('../config.json');
if (!Array.isArray(global.config.ADMINBOT)) global.config.ADMINBOT = [];
if (!Array.isArray(global.config.NDH)) global.config.NDH = [];
const facebookAdminId = String(global.config.FACEBOOK_ADMIN || "").trim();
if (facebookAdminId && !global.config.ADMINBOT.map(String).includes(facebookAdminId)) {
  global.config.ADMINBOT.push(facebookAdminId);
}
if (typeof global.config.allowInbox !== "boolean") global.config.allowInbox = true;

function startDashboard() {
  const cfg = global.config.dashBoard || {};
  if (!cfg.enable || global.client.dashboardServer) return;
  const port = Number(cfg.port) || 12001;
  try {
    const express = require("express");
    const app = express();
    app.get("/", (_req, res) => {
      res.json({
        ok: true,
        name: global.config.BOTNAME || "Mirai Bot",
        version: global.config.version || "3.0.0",
        uptime: Math.floor(process.uptime())
      });
    });
    app.get("/health", (_req, res) => res.json({ status: "ok" }));
    global.client.dashboardServer = app.listen(port, () => {
      logger(`Dashboard running on port ${port}`, "[ DASHBOARD ]");
    });
    global.client.dashboardServer.on("error", (err) => {
      logger(`Dashboard failed to start: ${err.message}`, "warn");
    });
  } catch (err) {
    logger(`Dashboard setup error: ${err.message}`, "warn");
  }
}

const telegram = require("./telegram.js");
process.on("uncaughtException", (err) => {
    console.error("[ FATAL ] Uncaught exception:", err);
    telegram.send(`🚨 Bot crashed!\n\n${String((err && err.message) || err).slice(0, 500)}`)
        .catch(() => {}).finally(() => process.exit(1));
    setTimeout(() => process.exit(1), 8000);
});
process.on("unhandledRejection", (reason) => {
    console.error("[ FATAL ] Unhandled rejection:", reason);
    telegram.send(`⚠️ Bot error (unhandled rejection)\n\n${String((reason && reason.message) || reason).slice(0, 500)}`).catch(() => {});
});
global.configModule = new Object();
global.moduleData = new Array();
global.language = new Object();
const langPath = `${__dirname}/../languages/${global.config.language || "en"}.lang`;
const langFile = (readFileSync(existsSync(langPath) ? langPath : `${__dirname}/../languages/en.lang`, { encoding: 'utf-8' })).split(/\r?\n|\r/);
const langData = langFile.filter(item => item.indexOf('#') != 0 && item != '');
for (const item of langData) {
    const getSeparator = item.indexOf('=');
    const itemKey = item.slice(0, getSeparator);
    const itemValue = item.slice(getSeparator + 1, item.length);
    const head = itemKey.slice(0, itemKey.indexOf('.'));
    const key = itemKey.replace(head + '.', '');
    const value = itemValue.replace(/\\n/gi, '\n');
    if (typeof global.language[head] == "undefined") global.language[head] = new Object();
    global.language[head][key] = value;
}
global.getText = function (...args) {
    const langText = global.language;
    if (!langText.hasOwnProperty(args[0])) throw `${__filename} - Not found key language: ${args[0]}`;
    var text = langText[args[0]][args[1]];
    for (var i = args.length - 1; i > 0; i--) {
        const regEx = RegExp(`%${i}`, 'g');
        text = text.replace(regEx, args[i + 1]);
    }
    return text;
}
async function onBot({ models }) {
    const cookie = process.env.FACEBOOK_COOKIE ||
        (existsSync('./cookie.txt') ? fs.readFileSync('./cookie.txt', 'utf8') : '');
    if (!cookie.trim()) {
        logger(global.getText("mirai", "notFoundPathAppstate"), '[ LOGIN ]');
        console.log('\n[ ERROR ] cookie.txt not found!');
        console.log('[ ERROR ] Facebook cookie "cookie.txt" \u09a8\u09be\u09ae\u09c7 \u09ab\u09be\u0987\u09b2\u09c7 paste \u0995\u09b0\u09c7 bot folder-\u09c7 \u09b0\u09be\u0996\u09cb, \u09a4\u09be\u09b0\u09aa\u09b0 \u0986\u09ac\u09be\u09b0 \u099a\u09be\u09b2\u09be\u0993. (Or set FACEBOOK_COOKIE env)\n');
        return process.exit(1);
    }
    logger(global.getText("mirai", "foundPathAppstate"), '[ LOGIN ]');
    login({ appState: global.utils.parseCookies(cookie)}, async (loginError, api) => {
        if (loginError) {
            console.error('[ ERROR ] Facebook login failed. Check or renew cookie.');
            return process.exit(1);
        }
        api.setOptions(global.config.FCAOption);
        writeFileSync('./core/utils/data/fbstate.json', JSON.stringify(api.getAppState(), null, 2));
        global.config.version = global.config.version || '3.0.0';
        global.client.timeStart = new Date().getTime();
        global.client.api = api;
        startDashboard();
        global.GoatBot = global.GoatBot || {};
        global.GoatBot.fcaApi = api;
        global.GoatBot.botID = api.getCurrentUserID();
        const userId = api.getCurrentUserID();
        const user = await api.getUserInfo([userId]);
        const userName = user[userId]?.name || null;
        logger(`Login successful - ${userName} (${userId})`, '[ LOGIN ] >');
        console.log(require('chalk').yellow(" __  __ ___ ____      _    ___      ____   ___ _____  __     _______" + "\n" +
          "|  \\/  |_ _|  _ \\    / \\  |_ _|    | __ ) / _ \\_   _| \\ \\   / /___ / " + "\n" +
          "| |\\/| || || |_) |  / _ \\  | |_____|  _ \\| | | || |____\\ \\ / /  |_ \\ " + "\n" +
          "| |  | || ||  _ <  / ___ \\ | |_____| |_) | |_| || |_____\\ V /  ___) |" + "\n" +
          "|_|  |_|___|_| \\_\\/_/   \\_\\___|    |____/ \\___/ |_|      \\_/  |____/ \n"));
        let loadedCommandsCount = 0, loadedEventsCount = 0;
        await (async function () {
            const { isGoatCommand, isGoatEvent, wrapGoat, wrapGoatEvent, ensureGoatBot } = require("./Gcompat.js");
            const { isRCommand, wrapR, wrapREvent, ensureRGlobals } = require("./Rcompat.js");
            ensureRGlobals(api);

            const loadUsers = require("./controllers/users")({ models, api });
            const loadThreads = require("./controllers/threads")({ models, api });
            const loadCurrencies = require("./controllers/currencies")({ models });
            global.client.models = models;
            global.client.controllers = { Users: loadUsers, Threads: loadThreads, Currencies: loadCurrencies, models };


            ensureGoatBot();


            const requireAutoInstall = (file) => {
              const tried = new Set();
              for (;;) {
                try { return require(file); }
                catch (err) {
                  const m = err && err.code === 'MODULE_NOT_FOUND' && /Cannot find module '([^'./][^']*)'/.exec(err.message || '');
                  if (!m || global.config.autoInstallMissingPackages === false) throw err;
                  const parts = m[1].split('/');
                  const pkg = m[1].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
                  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(pkg) || tried.has(pkg)) throw err;
                  tried.add(pkg);
                  logger(global.getText("mirai", "notFoundPackage", pkg, file.split(/[\\/]/).pop()), '[ AUTO-INSTALL ]');
                  try {
                    require('child_process').execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
                      ['install', pkg, '--no-audit', '--no-fund'],
                      { cwd: global.client.mainPath, stdio: 'inherit', shell: process.platform === 'win32' });
                    logger(global.getText("mirai", "loadedPackage", file.split(/[\\/]/).pop()), '[ AUTO-INSTALL ]');
                  } catch (e) {
                    logger(global.getText("mirai", "cantInstallPackage", pkg, file.split(/[\\/]/).pop(), e.message || e), '[ AUTO-INSTALL ]');
                    throw err;
                  }
                }
              }
            };
            const loadModules = async (path, collection, disabledList, type) => {

              const collectJs = (dir) => {
                let out = [];
                for (const entry of readdirSync(dir, { withFileTypes: true })) {
                  const full = join(dir, entry.name);
                  if (entry.isDirectory()) out = out.concat(collectJs(full));
                  else if (entry.isFile()) out.push(full);
                }
                return out;
              };
              const items = collectJs(path).filter(file => file.endsWith('.js') && !file.includes('example') && !disabledList.includes(file.split(/[\\/]/).pop()));
              let loadedCount = 0;
              for (const file of items) {
                try {
                  let item = requireAutoInstall(file);

                  if (type === 'commands' && isGoatCommand(item)) {
                    item = wrapGoat(item);
                    console.log(`[ COMPAT ] Goat-style command loaded: ${item.config.name} (${file.split(/[\\/]/).pop()})`);
                  } else if (type === 'events' && isGoatEvent(item)) {
                    item = wrapGoatEvent(item);
                    console.log(`[ COMPAT ] Goat-style event loaded: ${item.config.name} (${file.split(/[\\/]/).pop()})`);
                  }

                  if (type === 'commands' && isRCommand(item)) {
                    item = wrapR(item);
                    console.log(`[ COMPAT ] R-style command loaded: ${item.config.name} (${file.split(/[\\/]/).pop()})`);
                  } else if (type === 'events') {
                    item = wrapREvent(item);
                  }
                  const { config, run, onLoad, handleEvent } = item;
                  if (!config || !run || (type === 'commands' && !config.commandCategory)) {
                    throw new Error(global.getText("mirai", "errorFormat"));
                  }
                  if (global.client[collection].has(config.name)) {
                    throw new Error(global.getText("mirai", "nameExist"));
                  }
                  if (config.envConfig) {
                    try {
                      global.configModule[config.name] = global.configModule[config.name] || {};
                      global.config[config.name] = global.config[config.name] || {};
                      for (const key in config.envConfig) {
                        global.configModule[config.name][key] = global.config[config.name][key] || config.envConfig[key] || '';
                        global.config[config.name][key] = global.configModule[config.name][key];
                      }
                      logger(global.getText("mirai", "loadedConfig", config.name), '[ MODULE ]');
                    } catch (e) {
                      logger(global.getText("mirai", "cantLoadConfig", config.name, e.message || e), '[ MODULE ]');
                    }
                  }
                  if (item.languages && !item.languages[global.config.language || "en"]) {
                    logger(global.getText("mirai", "notFoundLanguage", config.name), '[ MODULE ]');
                  }
                  if (config.envConfig && global.GoatBot) {
                    const envStore = type === 'commands' ? global.GoatBot.envCommands : global.GoatBot.envEvents;
                    envStore[config.name] = global.configModule[config.name];
                  }
                  if (onLoad) await Promise.resolve(onLoad({ api, models, Users: loadUsers, Threads: loadThreads, Currencies: loadCurrencies })).catch(e => console.error(global.getText("mirai", "cantOnload", config.name, e.message || e)));
                  if (handleEvent) global.client.eventRegistered.push(config.name);
                  global.client[collection].set(config.name, item);
                  logger(global.getText("mirai", "successLoadModule", config.name), '[ MODULE ]');
                  if (type === 'commands' && Array.isArray(config.aliases)) {
                    for (const alias of config.aliases) {
                      const a = String(alias).toLowerCase().trim();
                      if (!a) continue;
                      if (global.client[collection].has(a)) {
                        console.error(`Alias "${a}" of command "${config.name}" already exists, skipped`);
                        continue;
                      }
                      global.client[collection].set(a, item);
                    }
                  }
                  loadedCount++;
                } catch (error) {
                  if (error && error.code === 'MODULE_NOT_FOUND' && /Cannot find module '([^'./][^']*)'/.test(error.message)) {
                    const pkg = error.message.match(/Cannot find module '([^']+)'/)[1];
                    console.error(global.getText("mirai", "notFoundPackage", pkg, file.split(/[\\/]/).pop()));
                  } else {
                    console.error(global.getText("mirai", "failLoadModule", file.split(/[\\/]/).pop(), error.message || error));
                  }
                }
              }
              if (loadedCount === 0) {
                console.log(`No ${type === 'commands'? 'command' :'event'} found in ${path}`);
              }
              return loadedCount;
            };
            const commandPath = join(global.client.mainPath, 'script', 'cmds');
            const eventPath = join(global.client.mainPath, 'script', 'events');
            loadedCommandsCount = await loadModules(commandPath, 'commands', global.config.commandDisabled, 'commands');
            loadedEventsCount = await loadModules(eventPath, 'events', global.config.eventDisabled, 'events');
            logger.loader(global.getText("mirai", "finishLoadModule", loadedCommandsCount, loadedEventsCount));
        })();
        logger.loader(' Ping load source: ' + (Date.now() - global.client.timeStart) + 'ms');
        try {
            const moment = require("moment-timezone");
            telegram.send(
                `🤖 Bot started\n\n` +
                `👤 ${userName} (${userId})\n` +
                `✅ ${loadedCommandsCount} commands loaded\n` +
                `✅ ${loadedEventsCount} events loaded\n` +
                `🕐 ${moment.tz("Asia/Dhaka").format("HH:mm:ss DD/MM/YYYY")}`
            ).catch(() => {});
        } catch (e) {}
        // only rewrite config.json when the content actually changed (avoids git churn)
        try {
            const newCfg = JSON.stringify(global.config, null, 4);
            const oldCfg = existsSync('./config.json') ? readFileSync('./config.json', 'utf8') : '';
            if (newCfg !== oldCfg) writeFileSync('./config.json', newCfg, 'utf8');
        } catch (e) {
            writeFileSync('./config.json', JSON.stringify(global.config, null, 4), 'utf8');
        }
        const listener = require('./listen')({ api, models });
        let reconnectTimer = null;
        const scheduleReconnect = () => {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            try { if (typeof api.stopListening === "function") api.stopListening(); } catch (e) {}
            connect_mqtt();
          }, 1000 * 60 * 60 * 1);
        };
        function listenerCallback(error, event) {
          if (error) {
            if (JSON.stringify(error).includes("601051028565049")) {
              const form = {
                av: api.getCurrentUserID(),
                fb_api_caller_class: "RelayModern",
                fb_api_req_friendly_name: "FBScrapingWarningMutation",
                variables: "{}",
                server_timestamps: "true",
                doc_id: "6339492849481770",
              };
              api.httpPost("https://www.facebook.com/api/graphql/", form, (e, i) => {
                if (e) return logger("Error: could not clear Facebook warnings.", "error");
                let res;
                try { res = JSON.parse(i); } catch (err) { return logger("Error: invalid response while clearing Facebook warnings.", "error"); }
                if (res.errors) return logger("Error: could not clear Facebook warnings.", "error");
                if (res.data?.fb_scraping_warning_clear?.success) {
                  logger("Facebook warnings bypassed successfully.", "[ SUCCESS ] >");
                  try { if (typeof api.stopListening === "function") api.stopListening(); } catch (err) {}
                  connect_mqtt();
                }
              });
            } else {
              logger(global.getText("mirai", "handleListenError", JSON.stringify(error)), "error");
            }
            return;
          }
          if (!event) return;
          if (["presence", "typ", "read_receipt"].some((data) => data === event.type)) return;
          if (global.config.DeveloperMode) console.log(event);
          Promise.resolve(listener(event)).catch(err => console.error("[ LISTENER ] Unhandled error:", err));
        }
        function connect_mqtt() {
          global.handleListen = api.listenMqtt(listenerCallback);
          scheduleReconnect();
          logger(global.getText('mirai', 'successConnectMQTT'), '[ MQTT ]');
        }
        connect_mqtt();

        if (telegram.isEnabled()) {
            setInterval(() => {
                try {
                    telegram.send(`⏰ Hourly check\n\n✅ Bot is running\n🕐 Uptime: ${telegram.formatUptime()}`).catch(() => {});
                } catch (e) {}
            }, 3600000);
        }
    });
}
(async() => {
    try {
        const { Sequelize, sequelize } = require("./database");
        await sequelize.authenticate();
        const models = require('./database/model')({ Sequelize, sequelize });
        logger(global.getText('mirai', 'successConnectDatabase'), '[ DATABASE ]');
        await models.ready;
        onBot({ models });
    } catch (error) {
        logger(global.getText('mirai', 'failConnectDatabase', error.message || error), '[ DATABASE ]');
      }
})();
