import { spawn } from "node:child_process";
import { resolve } from "node:path";

const viteBin = resolve("node_modules/vite/bin/vite.js");
const cliArgs = process.argv.slice(2);
const args = cliArgs.includes("--host")
    ? cliArgs
    : ["--host", "localhost", ...cliArgs];

const vite = spawn(
    process.execPath,
    [viteBin, ...args],
    {
        env: {
            ...process.env,
            DEBUG: process.env.DEBUG || "crx:hmr",
        },
        stdio: "inherit",
    },
);

vite.on("exit", code => {
    process.exit(code ?? 0);
});
