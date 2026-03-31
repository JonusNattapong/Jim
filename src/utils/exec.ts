import { execFile } from "node:child_process";
import { promisify } from "node:util";

const _execFileAsync = promisify(execFile);

export const execFileAsync = (file: string, args: string[] = [], options: any = {}) => {
  const isWin = process.platform === "win32";
  return _execFileAsync(file, args, { 
    shell: isWin,
    encoding: "utf-8",
    ...options 
  }) as unknown as Promise<{ stdout: string; stderr: string }>;
};
