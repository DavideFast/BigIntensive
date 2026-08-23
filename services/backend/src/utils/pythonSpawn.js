import { spawn } from "child_process";

export function startPythonJob({ command, args, logTag }) {
  const child = spawn(command, args, {
    stdio: "pipe",
    detached: false,
  });

  child.stdout.on("data", (data) => {
    console.log(`[${logTag}] ${data}`);
  });

  child.stderr.on("data", (data) => {
    console.error(`[${logTag} error] ${data}`);
  });

  child.on("error", (err) => {
    console.error(`[${logTag} spawn error] ${err.message}`);
  });

  child.on("close", (code) => {
    console.log(`[${logTag}] Process exited with code ${code}`);
  });

  return child;
}
