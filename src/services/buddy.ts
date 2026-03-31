/**
 * Buddy System for Jim
 * Animated companion sprite for enhanced UX
 */

import { EventEmitter } from "events";

export interface BuddyConfig {
  enabled: boolean;
  style: "cat" | "robot" | "ghost" | "star" | "custom";
  customFrames?: string[];
  animationSpeed: number; // ms per frame
  reactions: boolean;
  sounds: boolean;
}

export interface BuddyState {
  mood: "idle" | "happy" | "thinking" | "working" | "error" | "sleeping";
  frame: number;
  message?: string;
}

export class BuddySystem extends EventEmitter {
  private config: BuddyConfig;
  private state: BuddyState;
  private animationTimer: NodeJS.Timeout | null = null;
  private frames: string[] = [];

  private readonly defaultFrames: Record<string, string[]> = {
    cat: [" (=^・ω・^=)", " (=^・ω・^=)♪", " (=^⏕ω⏕^=)", " (=^・ω・^=) zzz"],
    robot: [" [■■■]", " [■□■]", " [■■■]", " [□□□]"],
    ghost: [" .-.", " (o.o)", " >^<", " .-."],
    star: [" ✦", " ✧", " ★", " ☆"],
  };

  constructor(config: Partial<BuddyConfig> = {}) {
    super();
    this.config = {
      enabled: config.enabled ?? true,
      style: config.style ?? "cat",
      customFrames: config.customFrames,
      animationSpeed: config.animationSpeed ?? 500,
      reactions: config.reactions ?? true,
      sounds: config.sounds ?? false,
    };

    this.state = {
      mood: "idle",
      frame: 0,
    };

    this.loadFrames();
    if (this.config.enabled) {
      this.startAnimation();
    }
  }

  private loadFrames(): void {
    if (this.config.customFrames && this.config.customFrames.length > 0) {
      this.frames = this.config.customFrames;
    } else {
      this.frames =
        this.defaultFrames[this.config.style] ?? this.defaultFrames.cat;
    }
  }

  private startAnimation(): void {
    if (this.animationTimer) return;

    this.animationTimer = setInterval(() => {
      this.state.frame = (this.state.frame + 1) % this.frames.length;
      this.emit("frame", this.getCurrentFrame());
    }, this.config.animationSpeed);
  }

  private stopAnimation(): void {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }

  getCurrentFrame(): string {
    return this.frames[this.state.frame] ?? this.frames[0];
  }

  getState(): BuddyState {
    return { ...this.state };
  }

  setMood(mood: BuddyState["mood"], message?: string): void {
    this.state.mood = mood;
    this.state.message = message;
    this.emit("moodChange", mood, message);

    if (this.config.reactions) {
      this.showReaction(mood);
    }
  }

  private showReaction(mood: BuddyState["mood"]): void {
    const reactions: Record<string, string> = {
      idle: "...",
      happy: "🎉",
      thinking: "🤔",
      working: "⚙️",
      error: "❌",
      sleeping: "💤",
    };

    this.emit("reaction", reactions[mood] ?? "");
  }

  async speak(message: string): Promise<void> {
    this.setMood("happy", message);
    this.emit("speak", message);

    if (this.config.sounds) {
      this.emit("playSound", "speak");
    }
  }

  async think(message: string): Promise<void> {
    this.setMood("thinking", message);
    this.emit("think", message);
  }

  async work(message: string): Promise<void> {
    this.setMood("working", message);
    this.emit("work", message);
  }

  async celebrate(message?: string): Promise<void> {
    this.setMood("happy", message ?? "Great job!");
    this.emit("celebrate", message);

    if (this.config.sounds) {
      this.emit("playSound", "celebrate");
    }
  }

  async showError(message: string): Promise<void> {
    this.setMood("error", message);
    this.emit("error", message);
  }

  sleep(): void {
    this.setMood("sleeping");
    this.stopAnimation();
    this.emit("sleep");
  }

  wake(): void {
    this.setMood("idle");
    this.startAnimation();
    this.emit("wake");
  }

  setStyle(style: BuddyConfig["style"]): void {
    this.config.style = style;
    this.loadFrames();
    this.emit("styleChanged", style);
  }

  setAnimationSpeed(speed: number): void {
    this.config.animationSpeed = speed;
    if (this.animationTimer) {
      this.stopAnimation();
      this.startAnimation();
    }
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (enabled) {
      this.startAnimation();
    } else {
      this.stopAnimation();
    }
    this.emit("enabledChanged", enabled);
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): BuddyConfig {
    return { ...this.config };
  }

  render(): string {
    if (!this.config.enabled) return "";

    const frame = this.getCurrentFrame();
    const moodEmoji = {
      idle: "",
      happy: " 😊",
      thinking: " 🤔",
      working: " ⚙️",
      error: " ❗",
      sleeping: " 💤",
    };

    const emoji = moodEmoji[this.state.mood] ?? "";
    const message = this.state.message ? ` "${this.state.message}"` : "";

    return `${frame}${emoji}${message}`;
  }

  dispose(): void {
    this.stopAnimation();
    this.removeAllListeners();
  }
}
