/**
 * Voice Integration for Jim
 * Text-to-Speech and Speech-to-Text capabilities
 */

import { EventEmitter } from "events";

export interface VoiceConfig {
  enabled: boolean;
  ttsEngine: "native" | "openai" | "elevenlabs";
  sttEngine: "native" | "openai" | "whisper";
  language: string;
  voice?: string;
  rate?: number;
  pitch?: number;
}

export interface VoiceMessage {
  text: string;
  role: "user" | "assistant";
  timestamp: number;
}

export class VoiceManager extends EventEmitter {
  private config: VoiceConfig;
  private isListening = false;
  private isSpeaking = false;
  private history: VoiceMessage[] = [];

  constructor(config: Partial<VoiceConfig> = {}) {
    super();
    this.config = {
      enabled: config.enabled ?? false,
      ttsEngine: config.ttsEngine ?? "native",
      sttEngine: config.sttEngine ?? "native",
      language: config.language ?? "en-US",
      voice: config.voice,
      rate: config.rate ?? 1.0,
      pitch: config.pitch ?? 1.0,
    };
  }

  async speak(text: string): Promise<void> {
    if (!this.config.enabled) return;

    this.isSpeaking = true;
    this.emit("speaking", text);

    try {
      switch (this.config.ttsEngine) {
        case "native":
          await this.nativeSpeak(text);
          break;
        case "openai":
          await this.openaiTTS(text);
          break;
        case "elevenlabs":
          await this.elevenlabsTTS(text);
          break;
      }

      this.history.push({
        text,
        role: "assistant",
        timestamp: Date.now(),
      });
    } finally {
      this.isSpeaking = false;
      this.emit("speakingEnd");
    }
  }

  async listen(): Promise<string> {
    if (!this.config.enabled) return "";

    this.isListening = true;
    this.emit("listening");

    try {
      let text = "";

      switch (this.config.sttEngine) {
        case "native":
          text = await this.nativeListen();
          break;
        case "openai":
          text = await this.openaiSTT();
          break;
        case "whisper":
          text = await this.whisperSTT();
          break;
      }

      if (text) {
        this.history.push({
          text,
          role: "user",
          timestamp: Date.now(),
        });
      }

      return text;
    } finally {
      this.isListening = false;
      this.emit("listeningEnd");
    }
  }

  private async nativeSpeak(text: string): Promise<void> {
    // Use platform-specific TTS
    const { execSync } = await import("child_process");

    try {
      if (process.platform === "darwin") {
        const voice = this.config.voice ? `-v ${this.config.voice}` : "";
        const rate = this.config.rate
          ? `-r ${Math.round(this.config.rate * 200)}`
          : "";
        execSync(`say ${voice} ${rate} "${text.replace(/"/g, '\\"')}"`);
      } else if (process.platform === "linux") {
        execSync(`espeak "${text.replace(/"/g, '\\"')}"`);
      } else if (process.platform === "win32") {
        const psScript = `
          Add-Type -AssemblyName System.Speech
          $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
          $synth.Rate = ${Math.round((this.config.rate ?? 1) * 10 - 10)}
          $synth.Speak("${text.replace(/"/g, '""')}")
        `;
        execSync(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`);
      }
    } catch {
      // Fallback: silent
    }
  }

  private async openaiTTS(text: string): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.emit("error", new Error("OPENAI_API_KEY not set"));
      return;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: this.config.voice ?? "alloy",
          speed: this.config.rate ?? 1.0,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI TTS failed: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const tempPath = `/tmp/jim-tts-${Date.now()}.mp3`;
      const fs = await import("fs/promises");
      await fs.writeFile(tempPath, buffer);

      const { execSync } = await import("child_process");
      if (process.platform === "darwin") {
        execSync(`afplay ${tempPath}`);
      } else if (process.platform === "linux") {
        execSync(`mpv ${tempPath} || ffplay -nodisp -autoexit ${tempPath}`);
      } else {
        execSync(
          `powershell -c "(New-Object Media.SoundPlayer '${tempPath}').PlaySync()"`,
        );
      }

      await fs.unlink(tempPath).catch(() => {});
    } catch (err) {
      this.emit("error", err);
    }
  }

  private async elevenlabsTTS(text: string): Promise<void> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      this.emit("error", new Error("ELEVENLABS_API_KEY not set"));
      return;
    }

    try {
      const voiceId = this.config.voice ?? "21m00Tcm4TlvDq8ikWAM";
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs TTS failed: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const tempPath = `/tmp/jim-tts-${Date.now()}.mp3`;
      const fs = await import("fs/promises");
      await fs.writeFile(tempPath, buffer);

      const { execSync } = await import("child_process");
      if (process.platform === "darwin") {
        execSync(`afplay ${tempPath}`);
      } else if (process.platform === "linux") {
        execSync(`mpv ${tempPath} || ffplay -nodisp -autoexit ${tempPath}`);
      } else {
        execSync(
          `powershell -c "(New-Object Media.SoundPlayer '${tempPath}').PlaySync()"`,
        );
      }

      await fs.unlink(tempPath).catch(() => {});
    } catch (err) {
      this.emit("error", err);
    }
  }

  private async nativeListen(): Promise<string> {
    return new Promise((resolve) => {
      const { execSync } = require("child_process");

      try {
        if (process.platform === "darwin") {
          // macOS: Use Siri speech recognition via shortcuts or dictate
          const result = execSync(
            'osascript -e "tell application \\"System Events\\" to keystroke \\"x\\" using {command down, shift down}" 2>/dev/null || echo ""',
            { timeout: 5000 },
          )
            .toString()
            .trim();
          resolve(result);
        } else if (process.platform === "linux") {
          // Linux: Use arecord + whisper or sphinx
          const result = execSync(
            'timeout 5 arecord -f S16_LE -r 16000 -c 1 /tmp/jim-stt.wav 2>/dev/null && whisper /tmp/jim-stt.wav --model tiny --output-format txt 2>/dev/null || echo ""',
            { timeout: 10000 },
          )
            .toString()
            .trim();
          resolve(result);
        } else {
          // Windows: Use System.Speech recognition
          const psScript = `
            Add-Type -AssemblyName System.Speech
            $rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
            $rec.SetInputToDefaultAudioDevice()
            $result = $rec.Recognize()
            Write-Output $result.Text
          `;
          const result = execSync(`powershell -Command "${psScript}"`, {
            timeout: 10000,
          })
            .toString()
            .trim();
          resolve(result);
        }
      } catch {
        resolve("");
      }
    });
  }

  private async openaiSTT(): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.emit("error", new Error("OPENAI_API_KEY not set"));
      return "";
    }

    try {
      const { execSync } = await import("child_process");
      const fs = await import("fs/promises");

      // Record audio
      const tempPath = `/tmp/jim-stt-${Date.now()}.wav`;
      if (process.platform === "darwin") {
        execSync(`rec -r 16000 -c 1 -b 16 ${tempPath} trim 0 5`, {
          timeout: 10000,
        });
      } else if (process.platform === "linux") {
        execSync(`arecord -f S16_LE -r 16000 -c 1 -d 5 ${tempPath}`, {
          timeout: 10000,
        });
      } else {
        execSync(
          `powershell -c "Start-Process ffmpeg -ArgumentList '-f dshow -i audio=\\"Microphone (Realtek(R) Audio)\\" -t 5 ${tempPath}' -Wait"`,
          { timeout: 10000 },
        );
      }

      // Send to OpenAI Whisper
      const formData = new FormData();
      const audioBuffer = await fs.readFile(tempPath);
      formData.append("file", new Blob([audioBuffer]), "audio.wav");
      formData.append("model", "whisper-1");

      const response = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
        },
      );

      await fs.unlink(tempPath).catch(() => {});

      if (!response.ok) {
        throw new Error(`OpenAI STT failed: ${response.statusText}`);
      }

      const result = (await response.json()) as { text: string };
      return result.text;
    } catch (err) {
      this.emit("error", err);
      return "";
    }
  }

  private async whisperSTT(): Promise<string> {
    try {
      const { execSync } = await import("child_process");

      // Record audio
      const tempPath = `/tmp/jim-stt-${Date.now()}.wav`;
      if (process.platform === "darwin") {
        execSync(`rec -r 16000 -c 1 -b 16 ${tempPath} trim 0 5`, {
          timeout: 10000,
        });
      } else if (process.platform === "linux") {
        execSync(`arecord -f S16_LE -r 16000 -c 1 -d 5 ${tempPath}`, {
          timeout: 10000,
        });
      } else {
        return "";
      }

      // Run local whisper
      const result = execSync(
        `whisper ${tempPath} --model tiny --output-format txt 2>/dev/null`,
        { timeout: 30000 },
      )
        .toString()
        .trim();

      const fs = await import("fs/promises");
      await fs.unlink(tempPath).catch(() => {});

      return result;
    } catch {
      return "";
    }
  }

  stopSpeaking(): void {
    this.isSpeaking = false;
    this.emit("speakingStopped");
  }

  stopListening(): void {
    this.isListening = false;
    this.emit("listeningStopped");
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  getHistory(): VoiceMessage[] {
    return [...this.history];
  }

  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.emit("enabledChanged", enabled);
  }

  setTTSEngine(engine: VoiceConfig["ttsEngine"]): void {
    this.config.ttsEngine = engine;
  }

  setSTTEngine(engine: VoiceConfig["sttEngine"]): void {
    this.config.sttEngine = engine;
  }

  setLanguage(language: string): void {
    this.config.language = language;
  }

  setVoice(voice: string): void {
    this.config.voice = voice;
  }

  setRate(rate: number): void {
    this.config.rate = rate;
  }

  setPitch(pitch: number): void {
    this.config.pitch = pitch;
  }
}
