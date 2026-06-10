// Process-tree fixture: spawns a grandchild and stays alive so killTree has a
// real tree (shell -> node parent -> node child) to terminate.
const { spawn } = require("node:child_process");
const { join } = require("node:path");

const child = spawn(process.execPath, [join(__dirname, "child.cjs")], { stdio: "ignore" });
console.log(`CHILD_PID:${child.pid}`);
setInterval(() => {}, 1000);
