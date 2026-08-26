# ⚔️ Multi-Agent Dialectic & Goal Loop Engine

ANTRI Code features an advanced multi-agent orchestration architecture that moves beyond single-turn prompt answering. Complex architectural trade-offs and multi-day engineering goals are resolved using specialized sub-agent pipelines: the **Dialectic Arena** and the **Goal Loop Engine**.

---

## 1. ⚔️ The Multi-Agent Dialectic Arena (`src/core/dialectic.ts`)

When addressing nuanced architectural dilemmas (e.g., "Should we use Kafka or RabbitMQ for our order processing event bus?"), ANTRI deploys a 4-agent adversarial debate:

```mermaid
graph TD
    Topic["🤔 Architectural Dilemma / Trade-Off Query"] --> Arena["⚔️ Dialectic Engine"]

    subgraph "The 4-Agent Debate Pipeline"
        Proposer["1. 🟢 Proposer\nAdvocates primary architecture, highlights throughput & advantages"]
        Adversary["2. 🔴 Adversary\nChallenges design, exposes edge cases, hidden costs & security flaws"]
        Researcher["3. 🔵 Researcher\nFetches empirical benchmarks, latency figures & CVE documentation"]
        Judge["4. ⚖️ Senior Judge\nSynthesizes trade-offs into an authoritative, actionable verdict"]
    end

    Arena --> Proposer
    Proposer --> Adversary
    Adversary --> Researcher
    Researcher --> Judge

    Judge --> DualOutput["📊 Deliverables:\n1. Structured Text Consensus\n2. Interactive Markmap/Mermaid Artifact"]
```

### Triggering a Dialectic Debate
- Command: `/debate <topic>` (e.g. `/debate Microservices vs Monolith for Seed Stage Startup`)
- Desktop: Tab 2 (**Dialectic Arena**) with visual agent message cards and live debate transcripts.

---

## 2. 🎯 The Autonomous Goal Loop Engine (`src/core/goalLoop.ts`)

For long-running, multi-step engineering missions (e.g., "Scaffold a complete authentication system with JWT, refresh tokens, and rate limiting"), the Goal Loop executes a 3-stage iterative optimization protocol:

```mermaid
graph LR
    Goal["🎯 Engineering Goal"] --> S1["Stage 1: Exploration\n(Index files & analyze requirements)"]
    S1 --> S2["Stage 2: Execution\n(Generate modules, write tests, install packages)"]
    S2 --> S3["Stage 3: Verification\n(Run test suites, linting, and compile checks)"]
    S3 --> Done["✅ Verified Complete"]
```

### Key Capabilities
- **Silent Background Execution**: Runs multi-step tasks with clean header badges (`⚡ [Goal Loop: Step 2/3]`).
- **Autonomous Error Interception**: If a compilation or test fails during Stage 3, the Goal Loop loops back to Stage 2 with failure context to self-heal.
- **Trigger**: `/goal <objective>` (e.g. `/goal Refactor database queries to use indexed Prisma batch operations`).

---

👉 Next: View the AI inference provider catalog in [**AI Providers & Model Catalog**](./providers-and-models.md).
