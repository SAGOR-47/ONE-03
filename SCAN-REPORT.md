# Project scan report — ONE-03

**Scan date:** 2026-10-30 (UTC)

**Branch:** `arena/fda46a7a-one-03`

**Scope:** bot source and command modules, vendored `sagor-fca`, JSON/configuration, package installation, dependency audit, and Git-tracked files.

> This report replaces the older report in this file. The older report described a different branch and claimed fixes that were not present in this checkout.

## Summary

| Check | Result |
|---|---|
| JavaScript syntax | Pass: 82 JS/CJS/MJS files |
| JSON parsing | Pass: 11 JSON files |
| Core config validation | Pass |
| Command modules | 45 found; 44 load in this environment; `upt.js` cannot load because native `canvas` was not built |
| Vendored FCA tests | Pass: 5 passed, 1 optional live-login test skipped (requires credentials) |
| Root `npm audit` | 10 findings: 0 critical, 0 high, 5 moderate, 5 low |
| Vendored FCA `npm audit` | 6 findings: 0 critical, 0 high, 0 moderate, 6 low |
| Native build | Not verified here: prebuilt downloads failed certificate validation and Node headers could not be fetched |

`npm run check` and `npm test` are now available from the root package.

## Fixes made during this scan

- Removed the tracked `cookie.txt` from the working tree and index, removed its local copy, and added ignore rules for cookies, environment secrets, runtime state, databases, dependencies, and generated FCA config. **The session value existed in Git history; removing the current file does not revoke or erase historical copies. Rotate/log out that Facebook session immediately.**
- Disabled runtime `npm install` of packages (`autoInstallMissingPackages: false`) to avoid loading commands by installing unreviewed dependencies during bot startup.
- Disabled Telegram notifications by default because the checked-in Telegram credentials are blank. Environment credentials can still opt in.
- Fixed thread approval storage to create and consistently use `core/utils/data/`, tolerate missing/corrupt JSON lists, and normalize IDs before approval checks.
- Fixed scheduled thread-sync timestamps: malformed timestamps are handled, and each successful sync records its run time even when thread data did not change.
- Removed the global `uuid@11` override from the root package. It caused the required legacy downloader dependency (`request`) to fail at module load (`uuid/v4` is no longer exported). The downloader command now loads with the installed compatible dependency tree; the tradeoff is documented in the remaining audit findings.
- Added dependency security overrides to the vendored `sagor-fca` package and aligned its `ws` range, clearing its high/critical advisories without a major SQLite upgrade.
- Added a reproducible project checker and root `npm test` script; corrected the README clone URL and project/lockfile guidance.

## Remaining findings and constraints

### Dependency advisories

The root package reports **5 moderate and 5 low** advisories; vendored `sagor-fca` reports **6 low** advisories. Both trees have **0 high and 0 critical** advisories after adding the same safety overrides to the vendored package. Root moderate findings trace primarily to the unmaintained `request` dependency pulled by `sagor-video-downloader` (including its SSRF advisory), UUID versions required by older consumers, and their dependents. npm reports no compatible non-breaking automatic fix for those root packages. Replacing or removing the downloader is the cleanest way to remove that legacy dependency, but changes the `autodown` feature. The remaining low findings are in `sqlite3` build tooling and `esbuild`. Do not use `npm audit fix --force` without testing major-version compatibility.

### Runtime/install verification

Dependencies were installed with lifecycle scripts disabled for safe, repeatable inspection. The `canvas` and SQLite native bindings therefore are not present. A native rebuild was attempted but could not complete in this sandbox because certificate validation failed for the canvas prebuilt download and Node headers were unavailable. As a result, the uptime command and actual database-backed bot startup were not integration-tested here; use a normal supported deployment install with build prerequisites to verify them.

### Privileged command surface

`eval`, `shell`, and `cmd` allow code execution or remote command installation behind bot permission levels. They are intentional administrative features, not ordinary user commands, but accounts with the required permissions must be fully trusted. `config.json` currently sets `publicMode: true`, so the group-approval gate is disabled by configuration; set it to `false` if private approval-only operation is intended.

## Commands run

```text
find ... '*.js' ... | node --check       pass
npm ci --ignore-scripts (both packages)   pass
npm run check                            pass
npm test                                 pass (5 FCA tests; optional login skipped)
npm audit (root)                        10 findings (0 critical, 0 high)
npm audit --prefix sagor-fca              6 findings (0 critical, 0 high)
npm rebuild canvas sqlite3               blocked by sandbox download/header failure
```
