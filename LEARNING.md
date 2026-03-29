# 🧠 Learning & Personalization in Jim

Jim is designed to evolve. Unlike static agents, Jim features a proactive learning loop (inspired by the Hermes framework) that allows it to adapt to your style and master complex workflows over time.

## 👥 The User Model (Persona)

Jim maintains a **User Persona** that captures your unique coding DNA. This isn't just about facts; it's about *how* you work.

- **Coding Style**: Do you prefer functional programming? Semicolons? Strict typing? Jim learns these and applies them to every file edit.
- **Preferences**: Do you use `pnpm` or `npm`? `vitest` or `jest`? Jim remembers so you don't have to keep repeating yourself.
- **Communication**: Jim adapts its tone to match your level of technical depth and directness.

**Where it lives**: `.jim/user_persona.json`

## 🛠️ Self-Improving Skills (Workflows)

When Jim successfully completes a complex task involving multiple steps, it doesn't just forget. It extracts a **Skill**—a reusable blueprint for that specific workflow.

- **Automated Extraction**: After a session, Jim analyzes its successes and writes new skill definitions.
- **Repertoire**: Next time you ask for something similar, Jim will consult its learned skills and follow the proven path.
- **Category-based**: Skills are grouped into `dev`, `test`, `ops`, and `mcp`.

**Where it lives**: `.jim/skills/*.json`

## 🔄 The Proactive Learning Loop (RL)

Jim implements a lightweight Reinforcement Learning (RL) cycle:

1. **Execution**: Jim performs the task using its available tools.
2. **Reflection**: After completion, a `ConsolidationEngine` runs a background task to analyze the entire session history.
3. **Optimization**: Successful patterns are turned into skills; repeated interactions update the persona.
4. **Feedback**: The learned persona and skills are injected into the *next* session's core system prompt.

## 🚀 How to Help Jim Learn

- **Be Explicit**: If you tell Jim "I always prefer X over Y", it will update your persona more accurately.
- **Reward Success**: Completing a session with a successful outcome is the strongest signal for skill extraction.
- **Review Skills**: You can manually check and edit `.jim/skills/` if you want to fine-tune a specific workflow.
