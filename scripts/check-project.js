#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules']);
const javascriptFiles = [];
const jsonFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.js') || entry.name.endsWith('.cjs') || entry.name.endsWith('.mjs')) {
        javascriptFiles.push(fullPath);
      } else if (entry.name.endsWith('.json')) {
        jsonFiles.push(fullPath);
      }
    }
  }
}

walk(root);
let failures = 0;

for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures += 1;
    process.stderr.write(`SYNTAX ERROR ${path.relative(root, file)}\n${result.stderr || result.error}\n`);
  }
}

for (const file of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures += 1;
    process.stderr.write(`INVALID JSON ${path.relative(root, file)}: ${error.message}\n`);
  }
}

try {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
  for (const key of ['ADMINBOT', 'NDH', 'commandDisabled', 'eventDisabled']) {
    if (!Array.isArray(config[key])) throw new TypeError(`config.${key} must be an array`);
  }
  if (typeof config.PREFIX !== 'string' || !config.PREFIX) {
    throw new TypeError('config.PREFIX must be a non-empty string');
  }
  if (config.language && !fs.existsSync(path.join(root, 'languages', `${config.language}.lang`))) {
    throw new Error(`language file missing for config.language=${config.language}`);
  }
} catch (error) {
  failures += 1;
  process.stderr.write(`CONFIG ERROR: ${error.message}\n`);
}

if (failures) {
  process.stderr.write(`\nProject check failed: ${failures} issue(s) across ${javascriptFiles.length} JS and ${jsonFiles.length} JSON files.\n`);
  process.exitCode = 1;
} else {
  console.log(`Project check passed: ${javascriptFiles.length} JS and ${jsonFiles.length} JSON files; config is valid.`);
}
