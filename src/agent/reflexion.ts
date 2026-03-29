import { childLogger } from "../utils/logger.js";
import type { LLMProvider } from "./provider.js";

export interface ErrorEntry {
  turn: number;
  tool: string;
  error: string;
  pattern: string;
  timestamp: number;
  context: string;
}

export interface Reflection {
  id: string;
  errorPattern: string;
  rootCause: string;
  diagnosis: string;
  suggestedFix: string;
  confidence: number;
  timestamp: number;
  relatedErrors: string[];
}

export interface ReflexionState {
  errorHistory: ErrorEntry[];
  reflections: Reflection[];
  consecutiveFailures: number;
  lastReflectionTurn: number;
  stuckPatterns: Map<string, number>;
}

export class ReflexionEngine {
  private state: ReflexionState;
  private log;
  private provider: LLMProvider;
  private model: string;
  private errorThreshold: number;
  private reflectionCooldown: number;

  constructor(
    provider: LLMProvider,
    model: string,
    errorThreshold: number = 2,
    reflectionCooldown: number = 3,
  ) {
    this.provider = provider;
    this.model = model;
    this.errorThreshold = errorThreshold;
    this.reflectionCooldown = reflectionCooldown;
    this.log = childLogger({ component: "reflexion" });
    this.state = {
      errorHistory: [],
      reflections: [],
      consecutiveFailures: 0,
      lastReflectionTurn: 0,
      stuckPatterns: new Map(),
    };
  }

  recordError(turn: number, tool: string, error: string, context: string): void {
    const pattern = this.normalizeError(error);
    const entry: ErrorEntry = {
      turn,
      tool,
      error: error.slice(0, 500),
      pattern,
      timestamp: Date.now(),
      context: context.slice(0, 1000),
    };

    this.state.errorHistory.push(entry);
    this.state.consecutiveFailures++;

    const count = this.state.stuckPatterns.get(pattern) ?? 0;
    this.state.stuckPatterns.set(pattern, count + 1);

    this.log.debug({ turn, tool, pattern, count: count + 1 }, "error recorded");
  }

  recordSuccess(): void {
    this.state.consecutiveFailures = 0;
  }

  needsReflection(currentTurn: number): boolean {
    if (this.state.consecutiveFailures < this.errorThreshold) return false;
    if (currentTurn - this.state.lastReflectionTurn < this.reflectionCooldown) return false;

    for (const [, count] of this.state.stuckPatterns) {
      if (count >= this.errorThreshold) return true;
    }

    return false;
  }

  isRepeatingPattern(error: string, lookback: number = 5): boolean {
    const pattern = this.normalizeError(error);
    const recent = this.state.errorHistory.slice(-lookback);
    const matches = recent.filter((e) => e.pattern === pattern);
    return matches.length >= 2;
  }

  private normalizeError(error: string): string {
    const normalized = error
      .replace(/\d+/g, "N")
      .replace(/["'`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    if (/typeerror/i.test(normalized)) return "TypeError";
    if (/referenceerror/i.test(normalized)) return "ReferenceError";
    if (/syntaxerror/i.test(normalized)) return "SyntaxError";
    if (/cannot find module/i.test(normalized)) return "ModuleNotFound";
    if (/enoent/i.test(normalized)) return "FileNotFound";
    if (/permission denied/i.test(normalized)) return "PermissionDenied";
    if (/timeout/i.test(normalized)) return "Timeout";
    if (/econnrefused/i.test(normalized)) return "ConnectionRefused";
    if (/command failed/i.test(normalized)) return "CommandFailed";
    if (/test.*fail/i.test(normalized)) return "TestFailure";
    if (/build.*fail/i.test(normalized)) return "BuildFailure";

    return normalized.slice(0, 100);
  }

  async reflect(currentTurn: number): Promise<Reflection> {
    this.state.lastReflectionTurn = currentTurn;

    const recentErrors = this.state.errorHistory.slice(-5);
    const stuckInfo = Array.from(this.state.stuckPatterns.entries())
      .filter(([, count]) => count >= 2)
      .map(([pattern, count]) => `${pattern}: ${count} times`)
      .join(", ");

    const errorSummary = recentErrors
      .map((e) => `[Turn ${e.turn}] ${e.tool}: ${e.error.slice(0, 200)}`)
      .join("\n");

    const previousReflections = this.state.reflections
      .slice(-3)
      .map((r) => `- ${r.rootCause}: ${r.suggestedFix}`)
      .join("\n");

    const prompt = `You are a debugging expert. Analyze these repeated failures and provide a structured diagnosis.

## Recent Errors
${errorSummary}

## Stuck Patterns
${stuckInfo || "Multiple consecutive failures"}

${previousReflections ? `## Previous Reflections (already tried)\n${previousReflections}\n` : ""}

## Task
Provide a JSON response with these fields:
{
  "rootCause": "One-line root cause analysis",
  "diagnosis": "Detailed explanation of WHY this keeps happening",
  "suggestedFix": "Concrete action to fix this (be specific about what to change)",
  "confidence": 0.0-1.0
}

Be specific. Do NOT suggest things from Previous Reflections. Focus on the underlying cause, not symptoms.`;

    try {
      const result = await this.provider.complete(
        [
          {
            role: "system",
            content: "You are a root-cause analysis expert. Respond ONLY with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        [],
        { model: this.model, maxTokens: 500, temperature: 0 },
      );

      const reflection = this.parseReflection(result.content, recentErrors);
      this.state.reflections.push(reflection);
      this.state.consecutiveFailures = 0;
      this.state.stuckPatterns.clear();

      this.log.info({ id: reflection.id, rootCause: reflection.rootCause }, "reflection generated");
      return reflection;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn({ err: msg }, "reflection failed, creating fallback");

      const fallback: Reflection = {
        id: `refl-${Date.now()}`,
        errorPattern: stuckInfo || "consecutive_failures",
        rootCause: "Reflection generation failed, manual analysis needed",
        diagnosis: `Errors: ${errorSummary.slice(0, 300)}`,
        suggestedFix: "Review the error messages carefully and try a different approach",
        confidence: 0.3,
        timestamp: Date.now(),
        relatedErrors: recentErrors.map((e) => e.error.slice(0, 100)),
      };

      this.state.reflections.push(fallback);
      return fallback;
    }
  }

  private parseReflection(content: string, recentErrors: ErrorEntry[]): Reflection {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          id: `refl-${Date.now()}`,
          errorPattern: this.state.stuckPatterns.size > 0
            ? Array.from(this.state.stuckPatterns.keys()).join(", ")
            : "unknown",
          rootCause: parsed.rootCause ?? "Unknown",
          diagnosis: parsed.diagnosis ?? "Could not parse diagnosis",
          suggestedFix: parsed.suggestedFix ?? "Review manually",
          confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
          timestamp: Date.now(),
          relatedErrors: recentErrors.map((e) => e.pattern),
        };
      }
    } catch {
      // parse failed, fall through
    }

    return {
      id: `refl-${Date.now()}`,
      errorPattern: "parse_failed",
      rootCause: content.slice(0, 200),
      diagnosis: content.slice(0, 500),
      suggestedFix: "Review the analysis output manually",
      confidence: 0.4,
      timestamp: Date.now(),
      relatedErrors: recentErrors.map((e) => e.pattern),
    };
  }

  getReflections(): Reflection[] {
    return this.state.reflections;
  }

  getErrorHistory(): ErrorEntry[] {
    return this.state.errorHistory;
  }

  getConsecutiveFailures(): number {
    return this.state.consecutiveFailures;
  }

  getStuckPatterns(): Map<string, number> {
    return new Map(this.state.stuckPatterns);
  }

  formatReflectionPrompt(reflection: Reflection): string {
    return `\n\n## 🔍 SELF-REFLECTION (Forced Analysis)

**Root Cause**: ${reflection.rootCause}

**Diagnosis**: ${reflection.diagnosis}

**Suggested Fix**: ${reflection.suggestedFix}

**Confidence**: ${(reflection.confidence * 100).toFixed(0)}%

⚠️ You have been stuck with repeated errors. Before proceeding:
1. Consider the diagnosis above carefully
2. Try a DIFFERENT approach than before
3. Do NOT repeat the same failed actions
4. If the suggested fix doesn't apply, think about what else could be wrong
`;
  }
}
