import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aiDir = path.resolve(__dirname, "../apps/ai-service");

const isWin = process.platform === "win32";
const venvPython = isWin
  ? path.join(aiDir, ".venv", "Scripts", "python.exe")
  : path.join(aiDir, ".venv", "bin", "python");

const pythonCmd = fs.existsSync(venvPython) ? venvPython : (isWin ? "python" : "python3");

const child = spawn(
  pythonCmd,
  ["-m", "uvicorn", "main:app", "--reload", "--port", "8000"],
  {
    cwd: aiDir,
    stdio: "inherit",
    shell: false,
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
