/**
 * Diagnostic Tracking for Jim
 * Track IDE errors, TypeScript errors, and code quality issues
 */

import { EventEmitter } from "events";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info";
  code?: string;
  message: string;
  source?: string;
}

export interface DiagnosticSummary {
  errors: number;
  warnings: number;
  infos: number;
  files: number;
  diagnostics: Diagnostic[];
}

export class DiagnosticTracker extends EventEmitter {
  private diagnostics: Map<string, Diagnostic[]> = new Map();
  private projectRoot: string;

  constructor(projectRoot: string) {
    super();
    this.projectRoot = projectRoot;
  }

  async runTypeCheck(): Promise<DiagnosticSummary> {
    try {
      const { stdout, stderr } = await execAsync(
        "npx tsc --noEmit --pretty false",
        {
          cwd: this.projectRoot,
          timeout: 30000,
        },
      ).catch((err) => ({
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? "",
      }));

      const output = stdout + stderr;
      const diagnostics = this.parseTscOutput(output);

      const summary: DiagnosticSummary = {
        errors: diagnostics.filter((d) => d.severity === "error").length,
        warnings: diagnostics.filter((d) => d.severity === "warning").length,
        infos: diagnostics.filter((d) => d.severity === "info").length,
        files: new Set(diagnostics.map((d) => d.file)).size,
        diagnostics,
      };

      this.diagnostics.set("tsc", diagnostics);
      this.emit("diagnosticsUpdated", summary);

      return summary;
    } catch (err: any) {
      return {
        errors: 0,
        warnings: 0,
        infos: 0,
        files: 0,
        diagnostics: [],
      };
    }
  }

  private parseTscOutput(output: string): Diagnostic[] {
    const lines = output.split("\n");
    const diagnostics: Diagnostic[] = [];

    for (const line of lines) {
      const match = line.match(
        /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s*TS(\d+):\s*(.+)$/,
      );
      if (match) {
        diagnostics.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          severity: match[4] as "error" | "warning",
          code: `TS${match[5]}`,
          message: match[6],
          source: "tsc",
        });
      }
    }

    return diagnostics;
  }

  async runLint(): Promise<DiagnosticSummary> {
    try {
      const { stdout } = await execAsync("npx eslint . --format json", {
        cwd: this.projectRoot,
        timeout: 30000,
      }).catch((err) => ({ stdout: err.stdout ?? "[]" }));

      const results = JSON.parse(stdout);
      const diagnostics: Diagnostic[] = [];

      for (const file of results) {
        for (const msg of file.messages ?? []) {
          diagnostics.push({
            file: file.filePath,
            line: msg.line,
            column: msg.column,
            severity: msg.severity === 2 ? "error" : "warning",
            code: msg.ruleId,
            message: msg.message,
            source: "eslint",
          });
        }
      }

      this.diagnostics.set("eslint", diagnostics);

      const summary: DiagnosticSummary = {
        errors: diagnostics.filter((d) => d.severity === "error").length,
        warnings: diagnostics.filter((d) => d.severity === "warning").length,
        infos: 0,
        files: new Set(diagnostics.map((d) => d.file)).size,
        diagnostics,
      };

      this.emit("diagnosticsUpdated", summary);
      return summary;
    } catch {
      return { errors: 0, warnings: 0, infos: 0, files: 0, diagnostics: [] };
    }
  }

  getDiagnostics(source?: string): Diagnostic[] {
    if (source) return this.diagnostics.get(source) ?? [];
    return Array.from(this.diagnostics.values()).flat();
  }

  getFileDiagnostics(filePath: string): Diagnostic[] {
    return this.getDiagnostics().filter((d) => d.file.includes(filePath));
  }

  getSummary(): DiagnosticSummary {
    const all = this.getDiagnostics();
    return {
      errors: all.filter((d) => d.severity === "error").length,
      warnings: all.filter((d) => d.severity === "warning").length,
      infos: all.filter((d) => d.severity === "info").length,
      files: new Set(all.map((d) => d.file)).size,
      diagnostics: all,
    };
  }

  formatReport(): string {
    const summary = this.getSummary();
    if (summary.diagnostics.length === 0) return "✅ No diagnostics found.";

    return [
      "🔍 **Diagnostic Report**",
      "",
      `Errors: ${summary.errors}`,
      `Warnings: ${summary.warnings}`,
      `Files: ${summary.files}`,
      "",
      ...summary.diagnostics.slice(0, 20).map((d) => {
        const icon =
          d.severity === "error"
            ? "❌"
            : d.severity === "warning"
              ? "⚠️"
              : "ℹ️";
        return `${icon} ${d.file}:${d.line}:${d.column} - ${d.message} (${d.code ?? ""})`;
      }),
    ].join("\n");
  }

  clear(source?: string): void {
    if (source) {
      this.diagnostics.delete(source);
    } else {
      this.diagnostics.clear();
    }
    this.emit("diagnosticsCleared", source);
  }
}
