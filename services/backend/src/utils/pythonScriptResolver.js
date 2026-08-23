import fs from "fs";
import path from "path";

export function createResolvePythonScript(pythonScriptsDir) {
  return function resolvePythonScript(scriptName) {
    const scriptPath = path.join(pythonScriptsDir, scriptName);

    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script non trovato: ${scriptPath}`);
    }

    return scriptPath;
  };
}
