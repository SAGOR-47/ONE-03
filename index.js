const { spawn } = require("child_process");
const logger = require("./core/utils/log");
const MAX_RESTARTS = 5;
const RESTART_DELAY_MS = 1000;
const STABLE_RUN_MS = 60_000;
let restartCount = 0;

function startBot() {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [
        "--trace-warnings",
        "--async-stack-traces",
        "core/sagor.js"
    ], {
        cwd: __dirname,
        stdio: "inherit"
    });

    child.on("error", (error) => {
        logger(`Could not start the bot: ${error.message}`, "[ Starting ]");
    });

    child.on("close", (code, signal) => {
        if (code === 0 && !signal) return;

        if (Date.now() - startedAt >= STABLE_RUN_MS) {
            restartCount = 0;
        }

        if (restartCount >= MAX_RESTARTS) {
            logger(`Stopped after ${MAX_RESTARTS} failed restart attempts.`, "[ Starting ]");
            process.exitCode = code || 1;
            return;
        }

        const delay = Math.min(RESTART_DELAY_MS * (2 ** restartCount), 30_000);
        restartCount += 1;
        logger(`Restarting in ${Math.ceil(delay / 1000)}s (attempt ${restartCount}/${MAX_RESTARTS})...`, "[ Starting ]");
        setTimeout(startBot, delay);
    });
}

startBot();