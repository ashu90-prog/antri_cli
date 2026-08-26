# ⚡ AI Providers & Model Catalog

ANTRI Code provides native integration with over 10 enterprise AI inference providers, supporting ultra-low latency hardware accelerators (Cerebras CS-3), distributed clusters (Vortex, NVIDIA NIM), and frontier reasoning models.

---

## 🌐 Supported Providers Matrix

| Provider | Key Identifier | Default Model | Typical Latency | Key Strengths |
| :--- | :--- | :--- | :--- | :--- |
| **NVIDIA NIM** | `nvidia-nim` | `meta/llama-3.2-11b-vision-instruct` | ~250ms | Multimodal vision/code, enterprise GPU clusters |
| **Cerebras** | `cerebras` | `gpt-oss-120b` | **< 15ms** | Wafer-scale CS-3 engine, ~2,000 tokens/sec |
| **Cohere** | `cohere` | `command-r-plus-08-2024` | ~300ms | Enterprise RAG, multilingual coding, citation verification |
| **Vortex** | `vortex` | `vortex-llama-3.3-70b-instruct` | ~150ms | High-throughput distributed inference cluster |
| **OpenCode** | `opencode` | `opencode/deepseek-coder-v2.5` | ~200ms | Dedicated multi-language code generation & refactoring |
| **DeepSeek** | `deepseek` | `deepseek-v4-flash-(latest)` | ~280ms | Chain-of-thought reasoning & algorithmic synthesis |
| **OpenAI** | `openai` | `gpt-4o` | ~400ms | General reasoning, tool execution, JSON mode |
| **Anthropic** | `anthropic` | `claude-3-7-sonnet-20250219` | ~450ms | Long-context understanding, high-craft web UI generation |
| **Google Gemini** | `gemini` | `gemini-2.5-flash` | ~220ms | Multimodal context, 1M+ token window |
| **Ollama** | `ollama` | `llama3.3:70b` | Local | 100% offline, privacy-first local hardware execution |
| **Custom / Local** | `custom` | Custom model | Local | OpenAI-compatible custom endpoints (`http://localhost:8000/v1`) |

---

## 🔄 Switching Providers & Models

### Via CLI Commands
```text
# Switch active provider
/provider cerebras

# View models for active provider
/models

# Set active model
antri -m gpt-4o

# Configure provider API key
/key nvidia-nim <your-api-key>
```

### Via Desktop Control Plane
- Open **Desktop Control Plane** (`antri --desktop`).
- Click the **Provider / Model** dropdown in the top navbar to switch providers on the fly.

---

## 🛡️ EOL Auto-Migration & Fallback Engine

When working with fast-evolving cloud providers like NVIDIA NIM, models may periodically be deprecated or retired. ANTRI Code includes an automatic fallback and migration engine:
- If a configured model returns `410 Gone` or `404 Not Found`, the provider automatically logs an alert and re-executes the query using the verified active fallback model with zero crash interruption.
- Legacy configuration files in `~/.antri/config.json` are automatically upgraded on startup.

---

👉 Next: Learn about autonomous diagnostics in [**Self-Debugger & Project Fixer**](./self-debugger-and-fixer.md).
