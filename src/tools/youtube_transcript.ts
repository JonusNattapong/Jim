import { execFileAsync } from "../utils/exec.js";
import type { ToolDefinition, ToolHandler } from "./types.js";

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function checkYtDlp(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("yt-dlp", ["--version"], { timeout: 5000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

export const youtube_transcript_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "youtube_transcript",
    description:
      "Extract YouTube video information and subtitles/transcript using yt-dlp. " +
      "Returns video metadata (title, duration, description) and available subtitles. " +
      "Requires yt-dlp installed (pip install yt-dlp).",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "YouTube video URL (youtube.com or youtu.be)",
        },
        lang: {
          type: "string",
          description: "Preferred subtitle language code (default: en). Use 'all' for all languages.",
        },
        max_chars: {
          type: "number",
          description: "Max characters of transcript to return (default: 15000)",
        },
      },
      required: ["url"],
    },
  },
};

export const youtube_transcript_handler: ToolHandler = async (args) => {
  const url = args.url as string;
  const lang = (args.lang as string) ?? "en";
  const maxChars = (args.max_chars as number) ?? 15000;

  const videoId = extractVideoId(url);
  if (!videoId) {
    return { content: `Error: Invalid YouTube URL: ${url}`, isError: true };
  }

  const version = await checkYtDlp();
  if (!version) {
    return {
      content: "yt-dlp is not installed. Install it with: pip install yt-dlp\nAlso requires a JS runtime (Node.js or deno) for YouTube.",
      isError: true,
    };
  }

  try {
    // Dump video metadata as JSON
    const { stdout: jsonStdout } = await execFileAsync(
      "yt-dlp",
      ["--dump-json", "--no-download", `https://www.youtube.com/watch?v=${videoId}`],
      { timeout: 30000 }
    );

    const info = JSON.parse(jsonStdout) as {
      title?: string;
      duration?: number;
      description?: string;
      channel?: string;
      upload_date?: string;
      view_count?: number;
      subtitles?: Record<string, Array<{ ext: string; url: string }>>;
      automatic_captions?: Record<string, Array<{ ext: string; url: string }>>;
    };

    const durationMin = info.duration ? Math.floor(info.duration / 60) : "?";
    const durationSec = info.duration ? info.duration % 60 : "?";

    let output = `Title: ${info.title ?? "Unknown"}\n`;
    output += `Channel: ${info.channel ?? "Unknown"}\n`;
    output += `Duration: ${durationMin}m ${durationSec}s\n`;
    output += `Views: ${info.view_count?.toLocaleString() ?? "?"}\n`;
    output += `Upload: ${info.upload_date ?? "?"}\n`;
    if (info.description) {
      output += `\nDescription:\n${info.description.slice(0, 2000)}\n`;
    }

    // Try to get subtitles
    const subLangs = lang === "all"
      ? Object.keys(info.subtitles ?? {})
      : [lang, "en"];

    let transcript = "";
    for (const l of subLangs) {
      // Try manual subtitles first, then auto-generated
      const subs = info.subtitles?.[l] ?? info.automatic_captions?.[l];
      if (!subs || subs.length === 0) continue;

      // Prefer vtt or srt format
      const subEntry = subs.find((s) => s.ext === "vtt") ?? subs.find((s) => s.ext === "json3") ?? subs[0];
      if (!subEntry?.url) continue;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const subRes = await fetch(subEntry.url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!subRes.ok) continue;

        const subText = await subRes.text();

        if (subEntry.ext === "vtt") {
          transcript = subText
            .replace(/WEBVTT[\s\S]*?\n\n/, "")
            .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->.*\n/g, "")
            .replace(/\{\\an\d\}/g, "")
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.match(/^\d+$/))
            .join(" ");
        } else if (subEntry.ext === "json3") {
          const json3 = JSON.parse(subText) as {
            events?: Array<{ segs?: Array<{ utf8?: string }> }>;
          };
          transcript = (json3.events ?? [])
            .flatMap((e) => (e.segs ?? []).map((s) => s.utf8 ?? ""))
            .join("")
            .trim();
        }

        if (transcript) {
          output += `\nTranscript (${l}):\n`;
          if (transcript.length > maxChars) {
            output += transcript.slice(0, maxChars) + `\n\n... (${transcript.length - maxChars} chars truncated)`;
          } else {
            output += transcript;
          }
          break;
        }
      } catch {
        continue;
      }
    }

    if (!transcript) {
      const availableLangs = [
        ...Object.keys(info.subtitles ?? {}),
        ...Object.keys(info.automatic_captions ?? {}),
      ];
      const unique = [...new Set(availableLangs)];
      output += `\nNo transcript available for language "${lang}".`;
      if (unique.length > 0) {
        output += ` Available languages: ${unique.join(", ")}`;
      }
    }

    return { content: output };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `yt-dlp error: ${msg}`, isError: true };
  }
};
