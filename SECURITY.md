# 🛡️ Security Policy for Jim

Security is a core consideration for Jim. As an autonomous agent capable of running tools, modifying files, and executing shell commands, Jim features multi-layered defenses.

## 🧱 The Guardrails

Jim implements several lines of defense to prevent unintended actions:

### 1. **Plan Approval Required**

In `plan`, `default`, and `acceptEdits` modes, Jim MUST create a plan and receive USER approval (`/approve`) before executing any mutation tools (like `edit_file`, `write_file`, or `run_command`).

### 2. **Explicit Permissions**

Permissions can be configured via `PERMISSION_MODE`. The default behavior prompts the user for every sensitive tool call.

- `/auto-approve` can be toggled, but is NOT recommended for unknown codebases.
- Filesystem snapshots are taken before destructive operations (when using `TreeSearchEngine`).

### 3. **Prompt Injection Mitigation**

Jim is aware of prompt injection risks.

- **Skill Scanning**: External skills (from ClawHub/MCP) are analyzed for injection patterns.
- **Sanitization**: Tool outputs are truncated and sanitized to prevent "System Instruction" leakage or hijacking.

## 🔐 Data Privacy

- **Local First**: All sessions, checkpoints, and user models are stored locally on your machine under `~/.jim`.
- **No Cloud Sync**: Jim does not automatically sync your data to any cloud service.
- **Provider Choice**: You choose which LLM provider to use (OpenAI, Anthropic, Ollama, etc.). Be aware of the privacy policy of your selected provider.

## 🤝 Responsible Use

- **Human-in-the-Loop**: Never run Jim on highly sensitive production environments without explicit plan review.
- **Audit Logs**: Jim maintains structured logs of every tool call and its arguments. Review `.jim.log` for full auditability.

## 🛑 Reporting Vulnerabilities

If you discover a security risk in Jim's logic or a way to bypass its permission system, please report it via GitHub Issues or contact the maintainers directly. Do NOT share prompt injection techniques publicly before a fix is available.
