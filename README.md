# Mirai Bot V3 🤖

A Facebook Messenger chatbot built on the Mirai V3 framework, customized with automatic noprefix, command aliases, and Asia/Dhaka timezone.

## ✨ Features

- 💬 **Messenger chatbot** — auto reply, group management, fun commands
- ⚡ **Automatic noprefix** — every command works with or without prefix (`ping` or `!ping`)
- 🔗 **Command aliases** — give any command alternative names via `aliases: []`
- 🌍 **Timezone** — Asia/Dhaka
- 🗣️ **Language** — English
- 🔄 **Auto-restart** — `index.js` restarts the bot if it crashes
- 🍪 **Cookie login** — via the `FACEBOOK_COOKIE` Replit Secret or a local ignored `cookie.txt`

## 📋 Requirements

- [Node.js](https://nodejs.org/en/) v20 or higher
- A Facebook account to use as the bot (a spare account is recommended)

## ⚙️ Installation

```sh
# 1. Clone the repo
git clone https://github.com/SAGOR-47/ONE-03.git
cd ONE-03

# 2. Install dependencies
npm install

# 3. Configure the bot
#    Edit config.json — set PREFIX, BOTNAME, ADMINBOT ids, etc.
#    See the Configuration table below for every option.

# 4. Add your Facebook cookie securely
#    On Replit, save it as the FACEBOOK_COOKIE secret.
#    For local development, use an ignored cookie.txt file.

# 5. Start the bot
npm start
```

Run `npm run check` to validate JavaScript syntax, JSON files, and core configuration.
Run `npm test` to run those checks plus the vendored FCA tests.

> ⚠️ **Never commit or share your Facebook cookie** — anyone with it can access your account.
> If a cookie was committed to a public repository, rotate the session; removing the file
> from the latest commit does not erase it from Git history.

## 🗂️ Project Structure

```
├── index.js              # Entry point (npm start) — auto-restarts the bot
├── core/
│   ├── sagor.js          # Main bot process
│   ├── handle/           # Command / event / schedule handlers
│   ├── controllers/      # Users, threads, currencies controllers
│   └── database/         # Database setup & models
├── script/
│   ├── cmds/             # Bot commands (30 built-in)
│   └── events/           # Bot events (join / leave notifications)
├── sagor-fca/            # Facebook chat API (vendored)
├── config.json           # Bot settings
└── .gitignore            # Keeps local cookies and database files out of Git
```

## ⌨️ Commands

Type `menu` (or `!menu`) in chat to see all commands.

**Noprefix:** all commands work without any prefix. `ping`, `help`, `menu` — just type the name.

**Aliases:** each command supports alternative names:

```js
module.exports.config = {
    name: "ping",
    aliases: ["p", "pong"],   // "p" or "pong" also runs this command
    ...
};
```

## 🛠️ Configuration

All settings live in `config.json`:

| Setting | Description |
|---|---|
| `BOTNAME` | Bot display name |
| `PREFIX` | Command prefix (default `.`) |
| `language` | Bot language (`en`) |
| `ADMINBOT` | Bot admin Facebook IDs |
| `NDH` | Supporter Facebook IDs |
| `commandDisabled` | Commands to disable |
| `eventDisabled` | Events to disable |

⚠️ `NDH` users get permission level 3 and can run `shell` / `run` (arbitrary code on the server). Only add IDs you fully trust.

## 📝 Notes

- The bot reads the session from `FACEBOOK_COOKIE` or a local `cookie.txt` file. Keep either secret private.
- Timezone is fixed to **Asia/Dhaka**.
- Commit `package-lock.json` so deployments use the reviewed dependency tree. Database and session files are runtime data and must stay untracked.

## 📄 License

GPL-3.0 — based on Mirai Bot V3 by Sagor.


## 🐐 Goat Bot V2 compatibility

Goat Bot V2 commands and events work without any conversion:

- Commands: put them in `script/cmds/<category>/` (see `script/cmds/tools/goat_example.js`).
- Events (`onStart` + `config`, no `eventType`): put them in `script/events/<category>/`.
- Supported: `onStart`, `onChat`, `onReply`, `onReaction`, `onLoad`, `langs`/`getLang`, `envConfig`,
  `message.reply/send/unsend/reaction`, `usersData`, `threadsData` (incl. `get/set(id, value, "path")`),
  `globalData`, `global.GoatBot`, and the common `global.utils` helpers.
- If a command needs an npm package that is not installed, the console tells you the exact `npm install <pkg>` to run.
- Money/exp are stored in Mirai's Currencies table and exposed as `usersData.get(id).money / .exp`.


## 🧩 R compatibility (3-in-1: Mirai + Goat + R)

R-style commands work natively too:

- Put R-style commands (`config.category`, `config.permission`, `run`, `handleEvent`) in `script/cmds/<folder>/` (distributed across category folders).
— R params `prefix`, `botname`, `admin`, `operator`, `botid` are injected automatically; `global.nodemodule`, `global.config.operators` etc. are provided by `includes/Rcompat.js`.
— R `premium` gate is disabled (everyone can use every command).
- Commands whose name already exists in Srr (`cmd`, `help`, `imgur`, `prefix`, `premium`, `unsend`, `usersid`, `weather`) were not copied; the Srr version is used.
- Many R-style commands call third-party web APIs (e.g. ryukodev.gleeze.com); if those services are down the command will fail even though it loads fine.
