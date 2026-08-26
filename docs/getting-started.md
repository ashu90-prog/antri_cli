# 🚀 Getting Started with ANTRI Code

This guide walks you through installing, configuring, and launching ANTRI Code in under two minutes.

---

## 📋 System Requirements

- **Node.js**: `>= 18.0.0` (v20+ recommended)
- **Package Manager**: `npm`, `pnpm`, or `yarn`
- **Operating System**: Windows 10/11, macOS (Intel/Apple Silicon), or Linux (Ubuntu, Debian, Fedora, Arch)
- **Optional**: Flutter SDK `>= 3.0.0` (for mobile app compilation)

---

## 📦 Installation

### Global Installation (Recommended)
Install the `antri_cli` package globally via npm:

```bash
npm install -g antri_cli@latest
```

Verify your installation:
```bash
antri --version
```

You can also run commands using the alternative alias:
```bash
antri_cli --version
```

---

## 🔑 Initial Configuration & API Keys

ANTRI Code supports 10+ AI inference providers. You can configure your API key through environment variables or interactive CLI commands.

### Option 1: Interactive Key Setup
Launch ANTRI and set your active key:
```bash
antri
```
Inside the interactive REPL:
```text
/key nvidia-nim <your-nvidia-api-key>
# or
/key cerebras <your-cerebras-api-key>
# or
/key cohere <your-cohere-api-key>
# or
/key gemini <your-gemini-api-key>
# or
/key openai <your-openai-api-key>
```

### Option 2: Environment Variables (`.env`)
Create a `.env` file in your workspace or home directory (`~/.antri/.env`):

```bash
# NVIDIA NIM
NVIDIA_NIM_API_KEY=nvapi-...

# Cerebras Cloud
CEREBRAS_API_KEY=csk-...

# Cohere Command
COHERE_API_KEY=...

# Google Gemini
GEMINI_API_KEY=AIzaSy...

# OpenAI / OpenRouter / Anthropic
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
```

---

## ⚡ Launching ANTRI Code

### 1. Interactive Terminal REPL
Start the interactive developer terminal:
```bash
antri
```

### 2. One-Shot Command Execution
Ask a quick question or request code modification directly from your shell:
```bash
antri -p "Create an Express TypeScript health check endpoint with rate limiting"
```

### 3. Automated Execution with Always-Allow
Skip permission prompts when executing trusted tools:
```bash
antri --alwaysallow -p "Initialize a Next.js 14 task app with Tailwind CSS"
```

### 4. Lightweight Desktop Control Plane
Launch the full web GUI control plane in your browser:
```bash
antri --desktop
```
This opens `http://localhost:3000` with 11 specialized engineering tabs including Codebase Intelligence Radar, Live Workspace, Dialectic Arena, and Memory Studio.

### 5. Mobile Companion Server
Launch the mobile PWA companion:
```bash
antri --mobile
```
This opens `http://localhost:3001` with touch-optimized controls for monitoring agent progress on smartphones and tablets.

---

## 🩺 System Diagnostics (`/selfheal`)

Verify that your local environment, storage, and AI providers are 100% healthy:
```text
/selfheal
```
This runs automated checks on:
- Global config directory (`~/.antri`)
- Provider API key validity and active status
- Chat session storage integrity
- Workspace read/write file permissions
- Cloud sync partitions

---

👉 Next: Learn about full command flags and shortcuts in [**CLI Reference & Shortcuts**](./cli-reference.md).
