# 🤝 Contributing to Jim

Jim is an AI-centric project where the codebase is designed to be easily modified by both humans and AI agents. This guide will help you understand how to extend and maintain Jim.

## 📁 Project Structure

- `src/agent/`: The core agent loop, LLM provider adapters, sub-agent logic, and the learning (RL) engine.
- `src/tools/`: Definitions and handlers for all 15+ built-in tools.
- `src/cli/`: The Ink/React-based terminal user interface.
- `src/context/`: Memory, session persistence, and user persona management.
- `src/permissions/`: Guardrails and permission logic.
- `src/config/`: Configuration schemas and provider presets.

## 🛠️ Adding a New Tool

To add a new tool to Jim:

1. **Create a new file** in `src/tools/` (e.g., `my_new_tool.ts`).
2. **Follow the tool definition pattern** from `AGENTS.md`.
3. **Register the tool** in `src/tools/index.ts`.
4. **Add a vitest unit test** in `src/tools/my_new_tool.test.ts`.

## 🧪 Testing

Jim uses **Vitest** for all testing.

- Run all tests: `npm test`
- Watch mode: `npm run test:watch`
- Each core component should have a co-located `.test.ts` file.

## 📜 Code Style

- Use **Strict TypeScript**.
- Prefer `type` over `interface` when defining data shapes.
- Use `node:` prefix for all Node.js built-ins.
- Ensure all relative imports include the `.js` extension (NodeNext resolution).

## 🧩 Learning System

1. **Execution**: Jim performs the task using its available tools.
2. **Reflection**: After completion, a `ConsolidationEngine` runs a background task to analyze the entire session history.
3. **Optimization**: Successful patterns are turned into skills; repeated interactions update the persona.
4. **Feedback**: The learned persona and skills are injected into the *next* session's core system prompt.

If you are modifying the `UserPersonaManager` or `ConsolidationEngine`, ensure that your changes do not compromise the integrity of the user's persisted data. Test with various prompt scenarios to ensure learning remains proactive and relevant.

## 🚀 Releasing

- Build the project: `npm run build`
- Ensure tests pass: `npm test`
- Submit a Pull Request with a clear description of changes.
