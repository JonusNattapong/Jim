/**
 * Keybinding System for Jim
 * Chord support, hot reload, user customization
 */

import { EventEmitter } from "events";
import fs from "fs/promises";
import path from "path";

export interface KeyBinding {
  key: string;
  chord?: string;
  action: string;
  description: string;
  when?: string;
}

export interface KeybindingConfig {
  bindings: KeyBinding[];
  vimMode?: boolean;
}

export class KeybindingManager extends EventEmitter {
  private bindings: Map<string, KeyBinding> = new Map();
  private chordBindings: Map<string, KeyBinding> = new Map();
  private activeChord: string | null = null;
  private chordTimer: NodeJS.Timeout | null = null;
  private configPath: string;
  private vimMode = false;
  private vimState: { mode: string; pending: string } = {
    mode: "normal",
    pending: "",
  };

  constructor(configDir: string) {
    super();
    this.configPath = path.join(configDir, "keybindings.json");
    this.registerDefaults();
  }

  private registerDefaults(): void {
    const defaults: KeyBinding[] = [
      {
        key: "ctrl+c",
        action: "cancel",
        description: "Cancel current operation",
      },
      { key: "ctrl+d", action: "exit", description: "Exit session" },
      { key: "ctrl+l", action: "clear", description: "Clear screen" },
      { key: "ctrl+k", action: "clearLine", description: "Clear current line" },
      {
        key: "ctrl+u",
        action: "clearToStart",
        description: "Clear to start of line",
      },
      {
        key: "ctrl+a",
        action: "moveToStart",
        description: "Move to start of line",
      },
      {
        key: "ctrl+e",
        action: "moveToEnd",
        description: "Move to end of line",
      },
      {
        key: "ctrl+w",
        action: "deleteWord",
        description: "Delete word backward",
      },
      {
        key: "tab",
        action: "autocomplete",
        description: "Trigger autocomplete",
      },
      {
        key: "shift+tab",
        action: "reverseAutocomplete",
        description: "Reverse autocomplete",
      },
      {
        key: "up",
        action: "historyPrev",
        description: "Previous command in history",
      },
      {
        key: "down",
        action: "historyNext",
        description: "Next command in history",
      },
      {
        key: "ctrl+r",
        action: "searchHistory",
        description: "Search command history",
      },
      { key: "ctrl+t", action: "newTask", description: "Create new task" },
      { key: "ctrl+b", action: "toggleSidebar", description: "Toggle sidebar" },
      {
        key: "ctrl+/",
        action: "showHelp",
        description: "Show keybinding help",
      },
      { key: "f1", action: "showHelp", description: "Show help" },
      { key: "f5", action: "refresh", description: "Refresh" },
      { key: "f12", action: "devTools", description: "Open dev tools" },
      // Chord bindings (ctrl+k then another key)
      {
        key: "ctrl+k",
        chord: "ctrl+s",
        action: "saveAll",
        description: "Save all files",
      },
      {
        key: "ctrl+k",
        chord: "ctrl+w",
        action: "closeAll",
        description: "Close all tabs",
      },
      {
        key: "ctrl+k",
        chord: "ctrl+c",
        action: "commentBlock",
        description: "Comment block",
      },
      {
        key: "ctrl+k",
        chord: "ctrl+d",
        action: "duplicateLine",
        description: "Duplicate line",
      },
      {
        key: "ctrl+k",
        chord: "ctrl+f",
        action: "findInFiles",
        description: "Find in files",
      },
      {
        key: "ctrl+k",
        chord: "ctrl+g",
        action: "goToLine",
        description: "Go to line",
      },
      {
        key: "ctrl+k",
        chord: "ctrl+r",
        action: "rename",
        description: "Rename symbol",
      },
      {
        key: "ctrl+k",
        chord: "ctrl+t",
        action: "newTerminal",
        description: "New terminal",
      },
    ];

    for (const binding of defaults) {
      if (binding.chord) {
        this.chordBindings.set(`${binding.key} ${binding.chord}`, binding);
      } else {
        this.bindings.set(binding.key, binding);
      }
    }
  }

  async loadUserConfig(): Promise<void> {
    try {
      const content = await fs.readFile(this.configPath, "utf-8");
      const config: KeybindingConfig = JSON.parse(content);

      if (config.bindings) {
        for (const binding of config.bindings) {
          if (binding.chord) {
            this.chordBindings.set(`${binding.key} ${binding.chord}`, binding);
          } else {
            this.bindings.set(binding.key, binding);
          }
        }
      }

      if (config.vimMode) {
        this.vimMode = true;
      }
    } catch {
      // No user config, use defaults
    }
  }

  async saveUserConfig(): Promise<void> {
    try {
      const allBindings = [
        ...Array.from(this.bindings.values()),
        ...Array.from(this.chordBindings.values()),
      ];
      const config: KeybindingConfig = {
        bindings: allBindings,
        vimMode: this.vimMode,
      };
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    } catch {
      // Save failed
    }
  }

  handleKeyPress(key: string): { action: string; binding: KeyBinding } | null {
    // Handle active chord
    if (this.activeChord) {
      const chordKey = `${this.activeChord} ${key}`;
      const binding = this.chordBindings.get(chordKey);
      this.clearChord();
      if (binding) {
        this.emit("action", binding.action, binding);
        return { action: binding.action, binding };
      }
      return null;
    }

    // Check for chord start
    const chordStart = Array.from(this.chordBindings.keys()).find((k) =>
      k.startsWith(key + " "),
    );
    if (chordStart) {
      this.activeChord = key;
      this.chordTimer = setTimeout(() => this.clearChord(), 2000);
      this.emit("chordStarted", key);
      return null;
    }

    // Regular binding
    const binding = this.bindings.get(key);
    if (binding) {
      this.emit("action", binding.action, binding);
      return { action: binding.action, binding };
    }

    // Vim mode handling
    if (this.vimMode) {
      return this.handleVimKey(key);
    }

    return null;
  }

  private handleVimKey(
    key: string,
  ): { action: string; binding: KeyBinding } | null {
    const vimBindings: Record<string, string> = {
      h: "moveLeft",
      j: "moveDown",
      k: "moveUp",
      l: "moveRight",
      w: "moveWordForward",
      b: "moveWordBackward",
      "0": "moveToStart",
      $: "moveToEnd",
      i: "insertMode",
      a: "appendMode",
      o: "openLineBelow",
      O: "openLineAbove",
      dd: "deleteLine",
      yy: "yankLine",
      p: "paste",
      u: "undo",
      x: "deleteChar",
      "/": "search",
      n: "nextMatch",
      N: "previousMatch",
    };

    this.vimState.pending += key;

    const action = vimBindings[this.vimState.pending];
    if (action) {
      this.vimState.pending = "";
      this.emit("action", action, {
        key,
        action,
        description: `Vim: ${action}`,
      });
      return {
        action,
        binding: { key, action, description: `Vim: ${action}` },
      };
    }

    // Clear pending if no match after 2 chars
    if (this.vimState.pending.length >= 2) {
      this.vimState.pending = key;
    }

    return null;
  }

  private clearChord(): void {
    this.activeChord = null;
    if (this.chordTimer) {
      clearTimeout(this.chordTimer);
      this.chordTimer = null;
    }
  }

  getBindings(): KeyBinding[] {
    return [
      ...Array.from(this.bindings.values()),
      ...Array.from(this.chordBindings.values()),
    ];
  }

  getBinding(key: string, chord?: string): KeyBinding | undefined {
    if (chord) {
      return this.chordBindings.get(`${key} ${chord}`);
    }
    return this.bindings.get(key);
  }

  setBinding(binding: KeyBinding): void {
    if (binding.chord) {
      this.chordBindings.set(`${binding.key} ${binding.chord}`, binding);
    } else {
      this.bindings.set(binding.key, binding);
    }
  }

  removeBinding(key: string, chord?: string): boolean {
    if (chord) {
      return this.chordBindings.delete(`${key} ${chord}`);
    }
    return this.bindings.delete(key);
  }

  formatHelp(): string {
    const bindings = this.getBindings();
    let help = "⌨️ **Keybindings**\n\n";

    const categories: Record<string, KeyBinding[]> = {};
    for (const binding of bindings) {
      const cat = binding.when ?? "General";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(binding);
    }

    for (const [cat, list] of Object.entries(categories)) {
      help += `### ${cat}\n`;
      for (const b of list) {
        const key = b.chord ? `${b.key} → ${b.chord}` : b.key;
        help += `- \`${key}\` - ${b.description}\n`;
      }
      help += "\n";
    }

    return help;
  }

  setVimMode(enabled: boolean): void {
    this.vimMode = enabled;
    this.vimState = { mode: "normal", pending: "" };
    this.emit("vimModeChanged", enabled);
  }

  isVimMode(): boolean {
    return this.vimMode;
  }

  getVimState(): { mode: string; pending: string } {
    return { ...this.vimState };
  }
}
