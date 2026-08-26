# 🧩 Markdown Skills Ecosystem

ANTRI Code provides an extensible **Markdown Skills System** that empowers the AI agent with specialized engineering personas, domain knowledge, and autonomous workflows. Skills are stored as portable Markdown files with YAML frontmatter at `~/.antri/skills/`.

---

## 🏛️ How Skills Work

When a user prompt triggers a skill's activation criteria (via trigger keywords, explicit `/skills` command, or tool invocation), the `SkillManager` injects the specialized instructions directly into the agent's reasoning loop.

```yaml
---
name: production_fullstack_architect
description: Senior Principal Fullstack Systems Architect
triggers:
  - architecture
  - fullstack
  - database
  - backend
  - design system
---

# Specialist Instructions: Production Fullstack Architect
When this skill is active:
1. Always construct multi-file solutions with typed data contracts.
2. Implement defensive error boundaries, middleware validation, and structured logging.
3. Guarantee dual-delivery (workspace disk files + live interactive preview).
```

---

## 🛠️ Core Hardcoded Specialist Skills

ANTRI Code includes a suite of production-grade engineering skills out of the box:

### 1. 🏗️ `production_fullstack_architect`
- **Focus**: High-scale multi-tier web applications, microservices, and database schemas.
- **Rules**: Strict typing, repository design patterns, REST/GraphQL endpoints, and transaction boundaries.

### 2. 🎨 `frontend_craftsman`
- **Focus**: Modern UI engineering, dark obsidian aesthetics, micro-interactions, and accessibility.
- **Rules**: Tailwind CSS, Lucide icons, glassmorphism, responsive grid layouts, and zero visual stutter.

### 3. ⚙️ `backend_systems_engineer`
- **Focus**: Node.js/Express, Go, Rust, and Python high-throughput servers.
- **Rules**: Connection pooling, rate limiting, token authentication, and robust error handling.

### 4. 🧮 `algorithm_engineer`
- **Focus**: Algorithmic optimization, time/space complexity analysis ($O(N \log N)$), and data structures.
- **Rules**: Benchmarking, memory efficiency, and mathematical proofs where applicable.

### 5. 🧪 `test_automation_architect`
- **Focus**: Unit tests, integration tests, mock harnesses, and end-to-end test suites.
- **Rules**: 100% test coverage for critical paths, edge cases, failure states, and regression prevention.

### 6. 🧹 `codebase_refactor_pro`
- **Focus**: Dead code elimination, modularization, DRY enforcement, and technical debt remediation.
- **Rules**: Safe step-by-step refactoring with zero breaking changes to public APIs.

### 7. 🤖 `autonomous_coder`
- **Focus**: Complete, production-grade, multi-file code synthesis without toy scripts or placeholder stubs.
- **Rules**: Strict adherence to the Anti-Shallow Codebase Mandate.

### 8. 🎨 `artifact_maker`
- **Focus**: Interactive Claude-style HTML artifacts, Markmap mind maps, Mermaid flowcharts, and multi-page SPAs.
- **Rules**: Embeds CDN assets (Tailwind, Lucide, Web Audio synth) and renders rich glassmorphism UI.

---

## ⚡ Dynamic Skill Synthesis (`SkillSynthesizer`)

In addition to static skills, ANTRI Code features an autonomous **Skill Synthesizer** (`src/core/skillSynthesizer.ts`). When faced with a novel domain or repeated custom pattern, ANTRI can synthesize, verify, and store a new Markdown skill on the fly:

```text
> Create a custom skill for optimizing WebAssembly SIMD kernels
✨ Synthesizing new skill: 'wasm_simd_optimizer' at ~/.antri/skills/wasm_simd_optimizer.md
✔ Skill verified and loaded into active registry.
```

---

## 💻 Managing Skills via CLI & Desktop

- **List & Activate in REPL**: `/skills`
- **Desktop Skills Studio**: Inspect, edit, and create skills visually in Tab 5 of the Desktop Control Plane.

---

👉 Next: Learn about repository pre-warming in [**Codebase Breather Engine**](./codebase-breather.md).
