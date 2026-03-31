/**
 * Notifications System for Jim
 * Desktop notifications, bell alerts, and 16 notification hooks
 */

import { EventEmitter } from "events";

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  sound?: boolean;
  urgency?: "low" | "normal" | "critical";
  timeout?: number;
}

export interface NotificationHook {
  event: string;
  handler: (data: unknown) => void;
}

export class NotificationManager extends EventEmitter {
  private hooks: NotificationHook[] = [];
  private enabled = true;
  private bellEnabled = true;

  constructor() {
    super();
    this.registerDefaultHooks();
  }

  private registerDefaultHooks(): void {
    // 16 notification hooks like Claude Code
    this.registerHook("onToolComplete", (data: any) => {
      if (data?.isError) {
        this.notify({
          title: "Tool Error",
          body: `${data.name} failed`,
          urgency: "normal",
        });
      }
    });

    this.registerHook("onTaskComplete", () => {
      this.notify({
        title: "Task Complete",
        body: "Your task has been completed",
        sound: true,
      });
    });

    this.registerHook("onError", (data: any) => {
      this.notify({
        title: "Error",
        body: String(data?.message ?? "An error occurred"),
        urgency: "critical",
      });
    });

    this.registerHook("onSessionStart", () => {
      this.bell();
    });

    this.registerHook("onPermissionRequired", () => {
      this.bell();
    });

    this.registerHook("onBudgetWarning", (data: any) => {
      this.notify({
        title: "Budget Warning",
        body: String(data?.message ?? "Approaching budget limit"),
        urgency: "normal",
      });
    });

    this.registerHook("onModelChange", (data: any) => {
      this.notify({
        title: "Model Changed",
        body: `Switched to ${data?.model ?? "unknown"}`,
      });
    });

    this.registerHook("onSubAgentComplete", () => {
      this.bell();
    });

    this.registerHook("onMcpConnected", (data: any) => {
      this.notify({
        title: "MCP Server",
        body: `Connected to ${data?.name ?? "server"}`,
      });
    });

    this.registerHook("onMcpDisconnected", (data: any) => {
      this.notify({
        title: "MCP Server",
        body: `Disconnected from ${data?.name ?? "server"}`,
      });
    });

    this.registerHook("onHookFired", (data: any) => {
      // Silent by default
    });

    this.registerHook("onMemorySaved", () => {
      // Silent
    });

    this.registerHook("onCompaction", () => {
      this.notify({
        title: "Context Compacted",
        body: "Conversation context has been summarized",
      });
    });

    this.registerHook("onCheckpoint", (data: any) => {
      this.notify({
        title: "Checkpoint Created",
        body: data?.label ?? "Checkpoint saved",
      });
    });

    this.registerHook("onRateLimit", () => {
      this.notify({
        title: "Rate Limited",
        body: "Waiting before retrying...",
        urgency: "normal",
      });
    });

    this.registerHook("onStreamComplete", () => {
      this.bell();
    });
  }

  registerHook(event: string, handler: (data: unknown) => void): void {
    this.hooks.push({ event, handler });
  }

  fire(event: string, data?: unknown): void {
    for (const hook of this.hooks) {
      if (hook.event === event) {
        try {
          hook.handler(data);
        } catch {
          // Ignore hook errors
        }
      }
    }
    this.emit(event, data);
  }

  async notify(options: NotificationOptions): Promise<void> {
    if (!this.enabled) return;

    try {
      // Cross-platform notification
      const { execSync } = await import("child_process");
      const bodyEscaped = options.body
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'");

      if (process.platform === "darwin") {
        execSync(
          `osascript -e 'display notification "${bodyEscaped}" with title "${options.title}"'`,
        );
      } else if (process.platform === "linux") {
        execSync(`notify-send "${options.title}" "${bodyEscaped}"`);
      } else if (process.platform === "win32") {
        // Windows toast notification via PowerShell
        const psScript = `
          [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
          [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null
          $template = @"<toast><visual><binding template="ToastText02"><text id="1">${options.title}</text><text id="2">${bodyEscaped}</text></binding></visual></toast>"@
          $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
          $xml.LoadXml($template)
          $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
          [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Jim").Show($toast)
        `;
        execSync(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`);
      }

      if (options.sound) {
        this.bell();
      }
    } catch {
      // Notification failed silently
    }
  }

  bell(): void {
    if (!this.bellEnabled) return;
    process.stdout.write("\x07");
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setBellEnabled(enabled: boolean): void {
    this.bellEnabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
