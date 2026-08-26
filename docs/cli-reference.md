# 💻 CLI Reference & Shortcuts

ANTRI Code provides an interactive terminal REPL powered by a custom Prompt Toolkit with inline slash commands, `@` file pickers, real-time command streaming, and keyboard navigation.

---

## 🚩 Command-Line Options

```text
Usage: antri [options] [command]

Options:
  -v, --version          output the current version number
  -p, --prompt <string>  Direct prompt execution without launching interactive REPL
  -m, --model <name>     Specify model to use (e.g. meta/llama-3.2-11b-vision-instruct, gpt-4o, claude-3-7-sonnet)
  --provider <name>      Specify AI provider (cerebras, cohere, vortex, opencode, nvidia-nim, openai, gemini, anthropic, ollama, deepseek, mock)
  --plan                 Launch directly in Plan Mode (Deep architectural synthesis)
  --vibe                 Launch directly in Vibe Mode (Rapid iterative coding)
  --alwaysallow          Execute sensitive tools (shell, web search, python) without interactive confirmation
  --desktop              Launch the lightweight Desktop Control Plane on port 3000
  --mobile               Launch the standalone Mobile Companion Server on port 3001
  -w, --dir <path>       Working directory for workspace tools (defaults to current directory)
  -h, --help             Display help for command
```

---

## ⌨️ Interactive Keyboard Shortcuts

Inside the ANTRI interactive prompt box:

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Enter` | **Submit Prompt** | Sends your query to the active agent loop. |
| `Shift + Enter` / `Ctrl + J` | **Multi-Line Newline** | Inserts a line break into the prompt box without submitting. |
| `Tab` | **Auto-Complete** | Completes selected slash command (`/plan`, `/arch`) or file path (`@src/...`). |
| `Up` / `Down` | **History / Menu Navigation** | Navigates previous prompt history or moves selection in popup menus. |
| `Esc` | **Close Menu / Clear** | Dismisses popup autocomplete menus or clears current input. |
| `Ctrl + C` | **Cancel / Exit** | Aborts current generation or exits REPL cleanly. |
| `Ctrl + O` | **File Picker** | Opens interactive file picker modal. |

---

## ⚡ Slash Commands Reference

Type `/` in the prompt box to trigger the popup command palette:

### 🎯 Workflow & Mode Controls
- `/plan` — Switch to **Plan Mode** for rigorous architectural decomposition, multi-file roadmaps, and trade-off analysis.
- `/vibe` — Switch to **Vibe Mode** for high-velocity, low-ceremony development and quick refactors.
- `/desktop` — Launch and open the Desktop Control Plane (`http://localhost:3000`).
- `/mobile` — Start the mobile PWA server (`http://localhost:3001`).
- `/alwaysallow` — Toggle automatic permission bypass for file edits, shell commands, and web searches.
- `/new` — Clear current conversation context and start a fresh session.
- `/clear` — Clear the terminal screen while preserving active session memory.

### 🧠 Thinking Profiles & Memory
- `/profile [name]` — View active thinking profile, list available profiles, or switch profile (`/profile architect`).
- `/profiles` — Interactive profile switcher and viewer.
- `/notes` — View global and workspace-specific persistent notes captured across sessions.
- `/memory` — Inspect episodic interactions, 128-D semantic vectors, and memory consolidation status.
- `/consolidate` — Trigger background memory consolidation to crystallize raw logs into permanent knowledge nuggets.

### 🛠️ Diagnostics & Codebase Intelligence
- `/arch` — Scan current project and generate a Mermaid architectural flowchart.
- `/breathe` — Trigger the Codebase Breather to re-index directory tree, dependencies, and entrypoints.
- `/fix` — Run the Autonomous Project Bug Fixer on the current directory.
- `/selfheal` — Execute system doctor diagnostics on permissions, keys, and storage.
- `/artifacts` — List all generated Claude-style HTML artifacts, Markmap mind maps, and live SPAs.
- `/view <id>` — Open a specific interactive artifact in your default browser.
- `/skills` — Browse, activate, or inspect Markdown agent skills.

### 🤖 Multi-Agent Dialectic & Goal Loop
- `/debate <topic>` — Run a 4-agent dialectic debate (Proposer, Adversary, Researcher, Judge).
- `/goal <objective>` — Execute a 3-stage silent goal optimization loop with real-time verification.
- `/mindmap <topic>` — Generate an interactive, collapsible Markmap mind map artifact.
- `/imagine <prompt>` — Synthesize a multi-page interactive web prototype with glassmorphism UI.

### 🔐 Authentication & Providers
- `/login <email>` — Authenticate your session and bind your encrypted cloud partition.
- `/logout` — Disconnect current user partition.
- `/provider [name]` — Switch active AI inference provider.
- `/models` — Display model catalog and latency metrics for the active provider.
- `/key <provider> <key>` — Set API key for a specified provider.
- `/connect` — Interactive wizard for configuring API credentials.

---

## 📁 The `@` File Picker

Type `@` anywhere in the prompt box to trigger intelligent file autocompletion:
```text
> Analyze @src/core/agent.ts and suggest optimizations for tool calling
```
ANTRI automatically searches your repository, indexes file paths, and embeds the target file's content directly into the prompt context for precise code analysis.

---

👉 Next: Explore the differences between Plan and Vibe modes in [**Modes: Plan vs. Vibe**](./modes.md).
