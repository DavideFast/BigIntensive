import { spawnSync } from "child_process";

export function resolvePythonExecutable() {
  if (process.env.PYTHON_BIN) {
    return { command: process.env.PYTHON_BIN, preArgs: [] };
  }

  const pythonCheck = spawnSync("python", ["--version"], { stdio: "ignore" });
  if (pythonCheck.status === 0) {
    return { command: "python", preArgs: [] };
  }

  const pyCheck = spawnSync("py", ["-3", "--version"], { stdio: "ignore" });
  if (pyCheck.status === 0) {
    return { command: "py", preArgs: ["-3"] };
  }

  return null;
}

export function resolveDockerExecutable() {
  const dockerCheck = spawnSync("docker", ["--version"], { stdio: "ignore" });
  return dockerCheck.status === 0 ? "docker" : null;
}
