/**
 * Sleep Prevention for Jim
 * Prevent system sleep during long-running tasks (macOS/Linux/Windows)
 */

import { EventEmitter } from "events";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface SleepPreventionState {
  active: boolean;
  reason: string;
  startedAt: number;
  method: string;
}

export class SleepPrevention extends EventEmitter {
  private state: SleepPreventionState = {
    active: false,
    reason: "",
    startedAt: 0,
    method: "",
  };
  private process: any = null;

  async prevent(reason: string = "Jim task running"): Promise<boolean> {
    if (this.state.active) return true;

    try {
      let method = "";

      if (process.platform === "darwin") {
        // macOS: use caffeinate
        this.process = exec(`caffeinate -dimsu -t 0`);
        method = "caffeinate";
      } else if (process.platform === "linux") {
        // Linux: use systemd-inhibit
        this.process = exec(
          `systemd-inhibit --what=sleep --who=Jim --why="${reason}" sleep infinity`,
        );
        method = "systemd-inhibit";
      } else if (process.platform === "win32") {
        // Windows: use SetThreadExecutionState via PowerShell
        const psScript = `
          Add-Type -TypeDefinition @"
            using System;
            using System.Runtime.InteropServices;
            public class PowerManagement {
              [DllImport("kernel32.dll")]
              public static extern uint SetThreadExecutionState(uint esFlags);
            }
"@
          [PowerManagement]::SetThreadExecutionState(0x80000000 -bor 0x00000001 -bor 0x00000002)
          while($true) { Start-Sleep -Seconds 60 }
        `;
        this.process = exec(
          `powershell -Command "${psScript.replace(/"/g, '\\"')}"`,
        );
        method = "SetThreadExecutionState";
      } else {
        return false;
      }

      this.state = {
        active: true,
        reason,
        startedAt: Date.now(),
        method,
      };

      this.emit("activated", this.state);
      return true;
    } catch {
      return false;
    }
  }

  async allow(): Promise<void> {
    if (!this.state.active) return;

    if (this.process) {
      try {
        this.process.kill();
      } catch {
        // Process may have already exited
      }
      this.process = null;
    }

    this.state = {
      active: false,
      reason: "",
      startedAt: 0,
      method: "",
    };

    this.emit("deactivated");
  }

  getState(): SleepPreventionState {
    return { ...this.state };
  }

  isActive(): boolean {
    return this.state.active;
  }

  getDuration(): number {
    if (!this.state.active) return 0;
    return Date.now() - this.state.startedAt;
  }

  formatStatus(): string {
    if (!this.state.active) {
      return "💤 Sleep prevention: Inactive";
    }

    const duration = Math.floor(this.getDuration() / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    return [
      "⚡ **Sleep Prevention: Active**",
      "",
      `Reason: ${this.state.reason}`,
      `Method: ${this.state.method}`,
      `Duration: ${minutes}m ${seconds}s`,
      `Started: ${new Date(this.state.startedAt).toLocaleTimeString()}`,
    ].join("\n");
  }
}
