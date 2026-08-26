# 🎯 Operating Modes: Plan Mode vs. Vibe Mode

ANTRI Code features two operating modes tailored for distinct phases of software engineering: **Plan Mode** for deep systems architecture, multi-file roadmaps, and trade-off synthesis; and **Vibe Mode** for high-velocity, low-ceremony development and rapid prototyping.

---

## ⚖️ High-Level Comparison

| Dimension | 📐 Plan Mode (`/plan`) | ⚡ Vibe Mode (`/vibe`) |
| :--- | :--- | :--- |
| **Philosophy** | "Think deeply, verify first, execute deliberately" | "High speed, direct execution, iterative flow" |
| **Thinking Depth** | 5-stage architectural decomposition | Direct token generation and immediate tool calls |
| **Tool Execution** | Requires explicit approval per step (unless `--alwaysallow`) | Executes tools autonomously with progress announcements |
| **Artifact Generation** | Generates Mermaid diagrams, trade-off matrices, and mind maps | Generates workspace code files and live web SPAs |
| **Best For** | Greenfield architecture, database schema redesigns, major refactors | Feature implementation, bug fixes, script writing, rapid prototyping |

---

## 📐 Plan Mode (`/plan`)

Plan Mode transforms ANTRI Code into a rigorous Principal Architect. When operating in Plan Mode, ANTRI adheres to the following protocol:

### 1. The 5-Stage Thinking Pipeline
1. **Context & Requirement Ingestion**: Recursively reviews directory trees, package manifests, and existing conventions.
2. **Architectural Trade-Off Analysis**: Evaluates competing approaches (e.g., SQLite vs. PostgreSQL, REST vs. GraphQL, Redux vs. Zustand) highlighting latency, complexity, and maintenance costs.
3. **Structured Milestone Roadmap**: Breaks complex requests into numbered, self-contained implementation phases.
4. **Defensive Design & Type Contracts**: Defines TypeScript interfaces, data validation schemas (Zod/Pydantic), and error handling boundaries before writing implementation code.
5. **Empirical Verification Criteria**: Outlines exact unit tests, integration tests, and shell commands required to prove correctness.

### Enabling Plan Mode
- Terminal command flag: `antri --plan`
- Inside REPL: `/plan`
- Desktop UI: Click the **Mode: Plan** toggle button in the top navbar.

---

## ⚡ Vibe Mode (`/vibe`)

Vibe Mode is optimized for developer flow state. It minimizes friction, reduces conversational preamble, and focuses on fast, clean code delivery:

### Key Characteristics
- **Immediate Tool Calling**: Files are written, edited, and verified in real-time.
- **Dual-Delivery Guarantee**: Code is materialized both on disk in your working directory and into interactive HTML artifacts for immediate visual testing.
- **Anti-Shallow Codebase Mandate**: Even in high-speed Vibe Mode, ANTRI never produces 4-line toy scripts or empty stubs; every file contains complete, production-grade logic.

### Enabling Vibe Mode
- Terminal command flag: `antri --vibe` (Default mode)
- Inside REPL: `/vibe`
- Desktop UI: Click the **Mode: Vibe** toggle button in the top navbar.

---

## 🔄 Dynamic Mode Switching

You can switch modes at any time during an active session without losing conversational history or memory context:

```text
> /plan
✔ Switched to PLAN MODE · Deep architectural planning active.

> Design the database migration strategy for multi-tenant organizations
[ANTRI generates detailed architectural plan with Mermaid diagram]

> /vibe
✔ Switched to VIBE MODE · High-velocity coding active.

> Execute Phase 1: Create the tenant isolation middleware and Prisma schema
[ANTRI immediately generates and writes prisma/schema.prisma and middleware/tenant.ts]
```

---

👉 Next: Discover the full features of the Desktop Control Plane in [**Desktop Control Plane**](./desktop-control-plane.md).
