import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class RepoBriefService {
  constructor(private projectRoot: string) {}

  async getBrief(): Promise<string> {
    const brief: string[] = ["# Repo Briefing: Architectural Overview\n"];

    // 1. Project Identity
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(this.projectRoot, "package.json"), "utf-8"));
      brief.push(`## Identity\n- **Name**: ${pkg.name}\n- **Version**: ${pkg.version}\n- **Main Entry**: ${pkg.main || pkg.module || "index.js"}\n- **Scripts**: ${Object.keys(pkg.scripts || {}).join(", ")}`);
    } catch {
      brief.push("## Identity\n- package.json not found.");
    }

    // 2. High-Level Structure
    try {
      const { stdout } = await execAsync("ls -F", { cwd: this.projectRoot });
      brief.push(`\n## Root Structure\n\`\`\`\n${stdout.trim()}\n\`\`\``);
    } catch {}

    // 3. Tech Stack & File Distribution
    try {
      const { stdout: files } = await execAsync("git ls-files", { cwd: this.projectRoot });
      const fileList = files.trim().split("\n");
      const extensions: Record<string, number> = {};
      fileList.forEach(f => {
        const ext = path.extname(f) || "no-ext";
        extensions[ext] = (extensions[ext] || 0) + 1;
      });
      
      const stats = Object.entries(extensions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([ext, count]) => `- **${ext}**: ${count} files`)
        .join("\n");
      
      brief.push(`\n## File Distribution\n${stats}\n- **Total Count**: ${fileList.length} files`);
    } catch {}

    // 4. Hot Files (Recent Changes)
    try {
      const { stdout: hot } = await execAsync("git log -n 5 --pretty=format: --name-only | sort | uniq -c | sort -nr | head -n 5", { cwd: this.projectRoot });
      brief.push(`\n## Recently Active Files\n\`\`\`\n${hot.trim()}\n\`\`\``);
    } catch {}

    return brief.join("\n");
  }
}
