# 🔌 API & Developer Guide

This guide details the internal HTTP/SSE REST APIs, WebSocket channels, and programmatic Node.js interfaces that power the ANTRI Code ecosystem.

---

## 🖥️ Desktop Server REST & SSE Endpoints (`port 3000`)

The `DesktopServer` (`src/desktop/server.ts`) exposes the following endpoints for web and IDE integrations:

### 1. `GET /api/status`
Returns current server status, active AI provider, model, permissions mode, and working directory.

### 2. `POST /api/chat`
Main agent chat endpoint.
- **Request Body**:
  ```json
  {
    "prompt": "Refactor auth middleware to use async/await",
    "provider": "nvidia-nim",
    "model": "meta/llama-3.2-11b-vision-instruct",
    "mode": "vibe",
    "sessionId": "session_123"
  }
  ```
- **Response**: Server-Sent Events (SSE) streaming tokens, tool execution updates, and Claude-style artifact tags.

### 3. `GET /api/codebase/cache`
Returns cached codebase intelligence from `ProjectContextCache` (file tree, tech stack, entrypoints, dependencies).

### 4. `POST /api/codebase/breathe`
Triggers `CodebaseBreather.breathe()` to re-index the repository in real-time.

### 5. `GET /api/workspace/tree`
Returns a recursive JSON directory tree of the current working directory, excluding `node_modules` and `.git`.

### 6. `GET /api/workspace/file?path=<relative_path>`
Reads and returns the text content of a specific workspace file for the in-browser code editor.

### 7. `POST /api/workspace/file`
Saves updated text content to a specific workspace file.
- **Request Body**:
  ```json
  {
    "path": "src/server.ts",
    "content": "import express from 'express';..."
  }
  ```

### 8. `GET /api/artifacts`
Returns an array of all generated Claude-style HTML, Markmap, and Mermaid artifacts.

### 9. `GET /api/profiles` / `POST /api/profiles/active`
Lists all available Markdown profiles or switches the active profile.

---

## 🛠️ Programmatic Node.js API

You can import ANTRI Code modules into custom Node.js scripts:

```typescript
import { Agent } from 'antri_cli';
import { configManager } from 'antri_cli';
import { memoryManager } from 'antri_cli';

// Initialize agent with custom working directory
const agent = new Agent({
  provider: 'nvidia-nim',
  model: 'meta/llama-3.2-11b-vision-instruct',
  mode: 'vibe',
  alwaysAllow: true,
  workingDir: process.cwd()
});

// Execute prompt with real-time token streaming
const response = await agent.run('Explain our distributed cache invalidation strategy', {
  onStreamToken: (token) => process.stdout.write(token),
  onToolCall: (name, args) => console.log(`Tool: ${name}`)
});
```

---

## 🧪 Running Tests & Building

```bash
# Compile TypeScript to dist/
npm run build

# Run complete automated test suite (63 unit tests)
npm test

# Run Flutter mobile client tests
cd antri_flutter && flutter test

# Run Flutter code analysis
cd antri_flutter && flutter analyze
```

---

## 🤝 Contributing Guidelines

1. **Adhere to the Anti-Shallow Mandate**: No toy scripts, stub implementations, or omitted error boundaries.
2. **Maintain 100% Test Coverage**: Add unit tests in `test/antri.test.js` for new core features.
3. **Preserve ESM & NodeNext Compatibility**: All imports must include `.js` file extensions.
4. **Follow the Memory Protocol**: Document updates in `Memory/CHANGELOG.md` and `Memory/ACTIVE_CONTEXT.md`.
