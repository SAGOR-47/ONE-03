const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const vm = require("vm");

if (global.client && !global.client.handleReaction) global.client.handleReaction = [];

module.exports.config = {
  name: "cmd",
  aliases: [],
  version: "3.0.0",
  hasPermssion: 2,
  credits: "Sagor",
  description: "Command Manager (Install/Load/Unload)",
  commandCategory: "System",
  usages: "[load/unload/loadAll/unloadAll/install/del/info/count]",
  cooldowns: 3
};

function box(title, content) {
  return (
`┌─❖
│ ${title}
├─•
${content}
└─❖`
  );
}


function registerCommand(command) {
  global.client.commands.set(command.config.name, command);
  if (typeof command.handleEvent === "function" && !global.client.eventRegistered.includes(command.config.name)) {
    global.client.eventRegistered.push(command.config.name);
  }
  if (Array.isArray(command.config.aliases)) {
    for (const a of command.config.aliases) {
      const key = String(a).toLowerCase().trim();
      if (key && !global.client.commands.has(key)) {
        global.client.commands.set(key, command);
      }
    }
  }
}


function unregisterCommand(name) {
  const command = global.client.commands.get(name);
  if (command && Array.isArray(command.config.aliases)) {
    for (const a of command.config.aliases) {
      global.client.commands.delete(String(a).toLowerCase().trim());
    }
  }
  global.client.commands.delete(name);
}

module.exports.run = async function ({ api, event, args }) {

  const { threadID, messageID } = event;

  const commandFolder = path.join(__dirname, "..");
  const customFolder = path.join(commandFolder, "custom");


  const findCommandFile = (name) => {
    const target = name + ".js";
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = walk(full);
          if (found) return found;
        } else if (entry.isFile() && entry.name === target) {
          return full;
        }
      }
      return null;
    };
    return walk(commandFolder);
  };


  const listCommandFiles = () => {
    const out = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
      }
    };
    walk(commandFolder);
    return out;
  };


  const { isGoatCommand, wrapGoat, ensureGoatBot } = require("../../core/Gcompat.js");
  const { isRCommand, wrapR, ensureRGlobals } = require("../../core/Rcompat.js");
  ensureGoatBot();
  try { ensureRGlobals(api); } catch (e) {}
  const loadModule = (filePath) => {
    delete require.cache[require.resolve(filePath)];
    let mod = require(filePath);
    if (isGoatCommand(mod)) mod = wrapGoat(mod);
    else if (isRCommand(mod)) mod = wrapR(mod);
    if (mod && typeof mod.onLoad === "function") {
      try {
        const c = global.client.controllers || {};
        Promise.resolve(mod.onLoad({ api: global.client.api, models: global.client.models, Users: c.Users, Threads: c.Threads, Currencies: c.Currencies }))
          .catch(e => console.error(`onLoad error in ${mod.config && mod.config.name}:`, e));
      } catch (e) { console.error(e); }
    }
    return mod;
  };

  if (!args[0]) {
    return api.sendMessage(box(
      "📦 CMD MANAGER",
`│ • cmd load <name>
│ • cmd unload <name>
│ • cmd loadAll
│ • cmd unloadAll
│ • cmd install <file.js> <url/code>
│ • cmd del <name>
│ • cmd info <name>
│ • cmd count`
    ), threadID, messageID);
  }

  const action = args[0].toLowerCase();

  try {


    if (action === "count") {
      return api.sendMessage(box(
        "📊 TOTAL COMMANDS",
        `│ ${global.client.commands.size} commands loaded`
      ), threadID, messageID);
    }


    if (action === "info") {
      const cmdName = args[1];
      const command = global.client.commands.get(cmdName);

      if (!command)
        return api.sendMessage(box("❌ ERROR", "│ Command not found"), threadID, messageID);

      const cfg = command.config;

      return api.sendMessage(box(
        "📄 COMMAND INFO",
`│ Name: ${cfg.name}
│ Version: ${cfg.version}
│ Author: ${cfg.credits}
│ Permission: ${cfg.hasPermssion}
│ Cooldown: ${cfg.cooldowns}
│ Category: ${cfg.commandCategory}`
      ), threadID, messageID);
    }


    if (action === "load") {
      const name = args[1];
      if (!name)
        return api.sendMessage(box("❌ ERROR", "│ Missing command name"), threadID, messageID);

      const dir = findCommandFile(name);
      if (!dir)
        return api.sendMessage(box("❌ ERROR", "│ Command file not found"), threadID, messageID);

      const command = loadModule(dir);
      if (!command.config || !command.config.name)
        return api.sendMessage(box("❌ ERROR", "│ Invalid command file"), threadID, messageID);

      registerCommand(command);

      return api.sendMessage(box(
        "✅ LOAD SUCCESS",
        `│ Command: ${name}\n│ Status: Active`
      ), threadID, messageID);
    }


    if (action === "unload") {
      const name = args[1];
      if (!name)
        return api.sendMessage(box("❌ ERROR", "│ Missing command name"), threadID, messageID);

      if (!global.client.commands.has(name))
        return api.sendMessage(box("❌ ERROR", "│ Command not loaded"), threadID, messageID);

      unregisterCommand(name);

      return api.sendMessage(box(
        "✅ UNLOAD SUCCESS",
        `│ Command: ${name}\n│ Status: Inactive`
      ), threadID, messageID);
    }


    if (action === "loadall") {
      const files = listCommandFiles();

      for (const dir of files) {
        const command = loadModule(dir);
        if (command.config && command.config.name) registerCommand(command);
      }

      return api.sendMessage(box(
        "✅ LOAD ALL SUCCESS",
        `│ Loaded: ${files.length} commands`
      ), threadID, messageID);
    }


    if (action === "unloadall") {
      const files = listCommandFiles();

      for (const dir of files) {
        const name = path.basename(dir).replace(".js", "");
        unregisterCommand(name);
      }

      return api.sendMessage(box(
        "✅ UNLOAD ALL SUCCESS",
        `│ Unloaded: ${files.length} commands`
      ), threadID, messageID);
    }


    if (action === "del") {
      const name = args[1];
      if (!name)
        return api.sendMessage(box("❌ ERROR", "│ Missing command name"), threadID, messageID);

      const file = findCommandFile(name);

      if (!file)
        return api.sendMessage(box("❌ ERROR", "│ File not found"), threadID, messageID);

      fs.unlinkSync(file);
      unregisterCommand(name);

      return api.sendMessage(box(
        "🗑️ DELETE SUCCESS",
        `│ Deleted: ${name}.js`
      ), threadID, messageID);
    }


    if (action === "install") {

      const fileName = args[1];
      const input = args.slice(2).join(" ");

      if (!fileName || !input)
        return api.sendMessage(box("❌ ERROR", "│ Usage: cmd install file.js <url/code>"), threadID, messageID);

      if (!fileName.endsWith(".js"))
        return api.sendMessage(box("❌ ERROR", "│ Only .js allowed"), threadID, messageID);

      if (fileName.includes(".."))
        return api.sendMessage(box("❌ ERROR", "│ Invalid filename"), threadID, messageID);

      let code;

      if (input.startsWith("http")) {
        const res = await axios.get(input);
        code = res.data;
      } else {
        code = input;
      }


      try {
        new vm.Script(code);
      } catch (err) {
        return api.sendMessage(box("❌ SYNTAX ERROR", `│ ${err.message}`), threadID, messageID);
      }

      const filePath = path.join(customFolder, fileName);
      fs.ensureDirSync(customFolder);


      if (fs.existsSync(filePath)) {
        return api.sendMessage(
`┌─❖
│ ⚠️ WARNING
├─•
│ 📁 FILE ALREADY EXISTS!
│ 🎯 Command: ${fileName}
│ 📝 Overwrite existing file?
│ 💡 React to this message to confirm
└─❖`,
          threadID,
          (err, info) => {
            if (err || !info) return;
            global.client.handleReaction.push({
              name: this.config.name,
              author: event.senderID,
              messageID: info.messageID,
              fileName,
              code,
              path: filePath
            });
          },
          messageID
        );
        return;
      }


      fs.writeFileSync(filePath, code);

      const command = loadModule(filePath);
      if (!command.config || !command.config.name) {
        fs.unlinkSync(filePath);
        return api.sendMessage(box("❌ ERROR", "│ Invalid command file"), threadID, messageID);
      }
      registerCommand(command);

      return api.sendMessage(
`┌─❖
│ ✅ INSTALLED SUCCESS
├─•
│ 📁 Command: ${fileName.replace(".js","")}
│ 📍 Path: ${filePath}
│ 🎯 Status: Active
└─❖`,
        threadID, messageID
      );
    }

    return api.sendMessage(box("❌ ERROR", "│ Unknown action"), threadID, messageID);

  } catch (err) {
    return api.sendMessage(box("❌ ERROR", `│ ${err.message}`), threadID, messageID);
  }
};


module.exports.handleReaction = async function ({ api, event, handleReaction }) {

  const { author, fileName, code, path } = handleReaction;

  if (event.userID != author) return;


  const idx = global.client.handleReaction.findIndex(e => e.messageID == event.messageID);
  if (idx >= 0) global.client.handleReaction.splice(idx, 1);

  try {
    const fs = require("fs-extra");

    fs.writeFileSync(path, code);

    delete require.cache[require.resolve(path)];
    let command = require(path);


    try {
      const { isGoatCommand, wrapGoat } = require("../../core/Gcompat.js");
      const { isRCommand, wrapR } = require("../../core/Rcompat.js");
      if (!global.GoatBot) global.GoatBot = { config: global.config || {} };
      if (isGoatCommand(command)) command = wrapGoat(command);
      else if (isRCommand(command)) command = wrapR(command);
    } catch (e) {}
    if (!command.config || !command.config.name)
      return api.sendMessage("❌ Invalid command file", event.threadID);


    global.client.commands.set(command.config.name, command);
    if (Array.isArray(command.config.aliases)) {
      for (const a of command.config.aliases) {
        const key = String(a).toLowerCase().trim();
        if (key && !global.client.commands.has(key)) global.client.commands.set(key, command);
      }
    }

    return api.sendMessage(
`┌─❖
│ ✅ OVERWRITE SUCCESS
├─•
│ 📁 Command: ${fileName.replace(".js","")}
│ 🎯 Status: Replaced & Active
└─❖`,
      event.threadID
    );

  } catch (err) {
    return api.sendMessage("❌ Error: " + err.message, event.threadID);
  }
};
