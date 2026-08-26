# 🫁 Codebase Breather & Intelligence Cache Engine

The **Codebase Breather** (`src/core/codebaseBreather.ts`) is a startup warmup engine that solves one of the biggest friction points in AI coding assistants: **repetitive, slow codebase scanning**.

---

## ⚡ How It Works

When ANTRI Code boots in your terminal or desktop environment, the Breather executes a rapid, non-blocking 1.2-second warmup phase with an animated pulsation indicator:

```text
- ✨ ANTRI is breathing... Analyzing "Hackathon" architecture & indexing context...
✔ ✨ [ANTRI Breathed]: Indexed antri_cli (TypeScript, ESM, Chalk) · 185 files · Cache Warm
```

```mermaid
graph TD
    Boot["🚀 ANTRI Code Boot"] --> Breather["🫁 CodebaseBreather.breathe()"]

    subgraph "Warmup Analysis Phase (1.2s)"
        ProjectID["🏷️ Project Identity & Name\nDetects package.json, pubspec.yaml, Cargo.toml, go.mod"]
        TechStack["⚡ Tech Stack Discovery\nIdentifies language, framework, module system (ESM/CJS)"]
        TreeScan["🌳 File Tree Structure\nRecursively indexes subdirectories & files (ignoring .git, node_modules)"]
        Entrypoints["🚪 Entrypoint Detection\nLocates index.ts, main.dart, app.js, server.py"]
        Dependencies["📦 Dependencies Matrix\nExtracts production and dev dependencies"]
        GitContext["🌿 Git Status & Branch\nIdentifies active branch and uncommitted modifications"]
    end

    Breather --> ProjectID
    Breather --> TechStack
    Breather --> TreeScan
    Breather --> Entrypoints
    Breather --> Dependencies
    Breather --> GitContext

    ProjectID --> Cache["🗄️ ProjectContextCache (In-Memory)"]
    TechStack --> Cache
    TreeScan --> Cache
    Entrypoints --> Cache
    Dependencies --> Cache
    GitContext --> Cache

    Cache --> SystemPrompt["⚡ Pre-Injected LLM System Prompt\n(Zero scan latency on queries)"]
    Cache --> RadarUI["🖥️ Codebase Radar (Desktop Control Plane)"]
```

---

## 🎯 Key Advantages

1. **Zero-Latency Inquiries**: When you ask "How does our authentication middleware work?", ANTRI already knows the file location (`src/auth/middleware.ts`) without spending 5 seconds running `find_files` or `list_dir`.
2. **Context-Rich System Prompt**: Automatically provides the LLM with the exact tech stack, typing conventions, and framework version, eliminating hallucinations.
3. **Instant Desktop Radar**: Powers Tab 9 (**Codebase Intelligence Radar**) in the Desktop Control Plane with real-time stats and visual trees.

---

## 🔄 Re-Breathing (`/breathe`)

If you add new dependencies, create new subdirectories, or switch git branches, you can instantly refresh the cache:
- Inside REPL: `/breathe`
- Desktop UI: Click the **"🫁 Breathe & Re-Index Codebase"** button on the Codebase Radar tab.

---

👉 Next: Discover the dual-delivery artifact system in [**Interactive Artifacts & SPAs**](./artifacts-and-visuals.md).
