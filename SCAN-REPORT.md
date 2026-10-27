# Full Project Scan Report — ONE-03 (Mirai Bot V3)

**Repo:** SAGOR-47/ONE-03 · **Branch:** `arena/2f980a98-one-03` · **Scan date:** 2026-10-27
**Scanner notes:** static analysis, syntax check of all JS, `npm audit`, path/config/git-history review.

---

## 1. Project Overview

| Item | Value |
|---|---|
| Type | Facebook Messenger chatbot (Mirai Bot V3 fork, Goat/R compat layers) |
| Runtime | Node.js >= 20 (`railpack.json` pins Node 20 for deploy) |
| Entry | `index.js` (crash-restart supervisor) → `core/sagor.js` (bot process) |
| DB | SQLite via Sequelize (`core/data.sqlite`) |
| FB API | Vendored `sagor-fca` v0.0.21 (MQTT listen, ~1 MB dist bundle) |
| Code size | 95 files / 78 JS / ~8,400 LOC (excl. sagor-fca dist) |
| Commands | 45 files in `script/cmds/` (+5 events in `script/events/`) |
| Deploy | Replit/Railpack (cairo/canvas apt packages), Telegram notify, optional Express dashboard |

**Message flow:** `sagor.js` (login → load modules → MQTT) → `core/listen.js` (approve-gate + dispatch) →
`handle/*` (command / reply / reaction / event / schedule / createDatabase) → `script/cmds/*`.
Compat: `core/Gcompat.js` (Goat Bot V2), `core/Rcompat.js` (R-style) auto-wrap foreign command formats.

---

## 2. What Passed ✅

- **Syntax:** all 78 JS files pass `node --check` — zero syntax errors.
- **Secrets:** no hardcoded tokens/cookies/API keys found in tracked files. Secrets come from
  `FACEBOOK_COOKIE` / `TELEGRAM_*` env vars (good pattern).
- **Cookie hygiene:** `cookie.txt` is empty (1 byte). Git history has only 1 commit; no cookie
  values exist anywhere in history.
- **Bot loop guard:** `isBotMessage()` (activityLog) prevents the bot replying to itself — important
  with the noprefix system.
- **Restart supervisor:** `index.js` has exponential backoff (max 5 restarts, 60 s stability reset) — solid.
- **Quality nits absent:** no TODO/FIXME/HACK debt; fire-and-forget `.then` without catch = 0.
- **Error safety:** MQTT listener wraps handlers in try/catch; command errors report to Telegram.

---

## 3. Critical Issues 🔴

### C1. Group-approval system is completely broken (path split bug)
Two different data directories are in use:

| File | Path used | Created? |
|---|---|---|
| `core/listen.js` (duyetbox flow) | `core/utils/data/{approved,pending}Threads.json` | ✅ created at startup |
| `script/cmds/duyet.js` (approve command) | `<root>/utils/data/{approved,pending}Threads.json` | ❌ **never created** |
| `core/handle/handleSchedule.js` | `<root>/utils/data/check_data.json` | ❌ **never created** |

Consequences:
- `duyet` command crashes with `ENOENT` on **every** invocation (`fs.readFileSync` with no try/catch,
  no `mkdir`) — admins can never approve groups.
- Even if the dir existed, `listen.js` writes pending IDs to a **different file** than `duyet.js` reads.
- `handleSchedule.js`'s 10-min thread auto-sync always fails to save its timestamp → re-syncs every run.

**Fix:** use one canonical dir (e.g. `core/utils/data/`), `fs.mkdirSync(..., { recursive: true })`
before writes, and make both read/write the same files.

### C2. `approve` command crashes (undefined `approvedgroups`)
`script/cmds/approve.js:33` destructures `global.config.approvedgroups` which **does not exist** in
`config.json` → `approvedgroups.push(id)` throws `TypeError` (lines 75, 84). Also its
`languages` block uses keys `"bangla"/"english"` while `config.language = "en"` → `getText()`
returns `undefined`, so even non-crash messages send as empty.

### C3. Dependency vulnerabilities — `npm audit`: 69 total
`3 critical · 53 high · 11 moderate · 2 low`

| Severity | Package | Issue |
|---|---|---|
| CRITICAL | `form-data` | unsafe random boundary, CRLF injection (via `request`) |
| CRITICAL | `request` | SSRF (via `cloudscraper`, `sagor-video-downloader`) — deprecated pkg |
| CRITICAL | `tar` | arbitrary file write via hardlink/symlink path traversal (via `node-gyp`→`sqlite3`) |
| HIGH | `axios` | CSRF / SSRF-credential-leak fixes needed (used everywhere) |
| HIGH | `ws` | DoS via headers/fragments (via `websocket-stream`) |
| HIGH | `nodemailer` | SMTP command injection / domain-confusion |
| HIGH | `minimatch`, `trim-newlines`, `undici`, `@fastify/busboy`, `zod` (via `jimp@1.6`) | ReDoS / DoS |
| HIGH | `extract-zip` | symlink traversal → arbitrary file write |
| MODERATE | `tough-cookie` | prototype pollution; `uuid` bounds issue; `qs` DoS |

Notable: `jimp@1.6` pulls ~30 high-severity sub-packages (zod chain). `moment` is maintenance-mode.
`cloudscraper` + `request` are dead upstream.

---

## 4. High-Risk Design (intentional, but dangerous) 🟠

### H1. Full RCE surface for level-2/3 users
- `shell.js` (`hasPermssion: 3`) — `child_process.exec` of arbitrary args.
- `eval.js` (`role: 3`) — raw `eval()`.
- `cmd.js` (`hasPermssion: 2`) — installs/runs **arbitrary remote JS** from URLs (`axios.get` → `writeFileSync` → `require`), plus `vm` usage.
- `config.json` → `autoInstallMissingPackages: true` — any loaded command can trigger `npm install <pkg>`
  at runtime (supply-chain hook; package name is regex-validated but still arbitrary npm).

Permission map: **NDH (level 3) > ADMINBOT (level 2)** — supporters outrank bot admins.
README warns about this, but config.json has the **same ID in both lists** (`61581197276223`).

### H2. Noprefix is global — applies to every command
`handleCommand.js` runs *any* command on bare text (`ping`, but also `shell`, `re`, `eval`, `duyet`).
Those are permission-gated, so it's not open RCE — but combined with H3 it raises blast radius.

### H3. Typo-fuzzy-match can redirect to the wrong command
With a prefix, an unknown command auto-runs the closest name at `stringSimilarity >= 0.5`
(e.g. `.shel` → `shell`, `.restrt` → `re`). A mistyped admin command can execute a **different,
more dangerous** command silently. Suggest-only would be safer for `category: Admin/System`.

### H4. Public repo hygiene
- **No `.gitignore`** exists, although README claims one. `cookie.txt` is tracked (currently empty —
  one paste-and-commit away from leaking a live session; README itself warns about this).
  Also untracked runtime data (`data.sqlite`, `core/utils/data/*`, `fbstate.json` written at login)
  has no ignore rules. **Add a `.gitignore` + untrack `cookie.txt`.**
- Real Facebook UID `61581197276223` hardcoded in `config.json` (ADMINBOT/NDH/BOXADMIN).
- `core/sagor.js` writes a fresh `core/utils/data/fbstate.json` (session dump) at every login — must be ignored.

---

## 5. Medium Issues 🟡

| # | Where | Issue |
|---|---|---|
| M1 | ~20 call sites (`handleReply`, `handleReaction`, `duyet`, `allgroups`, `approve`, `func.js`…) | `api.sendMessage(msg, threadID, messageID)` passes messageID as *callback*. Works only because `sagor-fca` special-cases a string 3rd arg — fragile against API upgrades |
| M2 | `approve.js`, `pending.js` | `languages` keys `"bangla"/"english"` vs config `"en"` → `getText` = undefined (empty messages) |
| M3 | 39 sites | empty `catch {}` blocks — silent failures hard to debug |
| M4 | `core/sagor.js:280` | `config.json` is **rewritten on every startup** (git churn; can surprise diffs) |
| M5 | `package.json` | metadata still says `Mirai-Bot` / `DongDev-VN/Mirai-Bot-V3` while README says SAGOR fork — inconsistent provenance |
| M6 | `core/handle/handleCommand.js:168` | obfuscated constant `0x2533 + 0x1105 + -0x3638` (= 0) — leftover Goatism; hurts readability |
| M7 | `script/cmds/eval.js:1` | destructures `global.utils.removeHomeDir/log` at require-time — works only because `ensureGoatBot()` runs first; brittle ordering dependency |
| M8 | `config.json` telegram `enable: true` with empty token/chatId | hourly `setInterval` heartbeat attempts send every hour (fails quietly) — noise in logs |
| M9 | `script/cmds/assets/hubble/nasa.json` | 172 KB data file inside `cmds/` (loaded fine, but odd location) |
| M10 | engines mismatch | root `>=20`, `sagor-fca` `>=14` — fine in practice, just sloppy |

---

## 6. Low / Nits 🟢

- `handleCommand.js`: unused destructured `adminOnly`; double `;;`; `var` mixed with `const`.
- `restart.js` file name vs `config.name: "re"` mismatch (confusing for users).
- `run.bat` = `npm start` (Windows convenience only).
- `dashboard` (Express) binds with no auth — currently disabled (`dashBoard.enable: false`); if enabled, port 12001 exposes bot name/version/uptime publicly.
- `moment`/`moment-timezone` still fine but in maintenance mode (consider `luxon`/`dayjs` someday).
- Language file coverage is otherwise complete (`en.lang` has all keys used by core handlers).

---

## 7. Recommended Actions (priority order)

1. **Fix the `utils/data` path split** (C1) — one dir, mkdir before write, same files for `duyet` + `listen`.
2. **Fix `approve.js`** (C2) — default `approvedgroups` to `[]`, fix lang keys to `"en"`.
3. **Add `.gitignore`** (H4): `cookie.txt`, `node_modules/`, `*.sqlite`, `core/utils/data/`, `fbstate.json`, `package-lock.json`; `git rm --cached cookie.txt`.
4. **Upgrade/replace vulnerable deps** (C3): bump `axios`, `ws`, `form-data` (or drop `cloudscraper`/`sagor-video-downloader` to kill `request`), consider `jimp@1.x → newer`, replace `nodemailer` usage or upgrade to patched version.
5. **Harden the RCE surface** (H1–H3): require exact command names (no fuzzy auto-run) for Admin/System categories; set `autoInstallMissingPackages: false` in production; consider deleting `eval`/`shell` if unused.
6. Sweep M1 call sites to the correct `sendMessage(msg, threadID, cb, messageID)` signature.
7. Replace empty `catch {}` with at least debug-level logging (M3).

---

## 8. Quick Stats

```
Files:            95 (78 JS, ~8,411 LOC excl. sagor-fca dist)
Commands:         45 | Events: 5
Syntax errors:    0
Secrets leaked:   0 (cookie history clean)
npm audit:        69 vulns (3 critical, 53 high, 11 moderate, 2 low)
Broken features:  group approval (duyet), approve cmd, thread auto-sync timestamp
Empty catches:    39
```
