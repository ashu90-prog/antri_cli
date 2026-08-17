# 📱 ANTRI Mobile — Standalone Android App & APK

**ANTRI Mobile** is a standalone, lightweight mobile application and Android APK project designed for autonomous AI coding, multi-persona dialectic self-debates, iterative goal pipelines, and on-device thinking profile management.

---

## 🌟 Key Features

1. **Standalone On-Device Thinking Profiles**:
   - Stores custom markdown profiles directly on the mobile device (`localStorage` / SQLite).
   - No connection to the PC is needed.

2. **Multimodal File & Photo Uploads (`+` Button)**:
   - Tap the `+` button in chat to take live camera photos, upload screenshots from the phone gallery, or attach code files.

3. **Direct AI Provider Integration**:
   - Supports 11+ AI providers directly from your phone:
     - **⚡ Cerebras** (`llama-3.3-70b`)
     - **🏢 Cohere** (`command-r-plus-08-2024`)
     - **🌀 Vortex API** (`vortex-llama-3.3-70b-instruct`)
     - **💻 OpenCode** (`opencode/deepseek-coder-v2.5`)
     - **🔮 DeepSeek** (`deepseek-chat`, `deepseek-reasoner`)
     - **🟢 NVIDIA NIM** (`meta/llama-3.1-8b-instruct`)
     - **🤖 OpenAI** (`gpt-4o`, `gpt-4o-mini`, `o1`)
     - **🧠 Anthropic** (`claude-3-7-sonnet`, `claude-3-5-sonnet`)
     - **✨ Google Gemini** (`gemini-2.5-flash`, `gemini-2.5-pro`)
     - **🦙 Ollama / Custom Server**

4. **Dialectic Arena & Goal Loop**:
   - Multi-persona self-debating engine (Proposer, Adversary, Researcher, Judge).
   - 3-stage iterative self-refinement goal engine.

---

## 📦 How to Build the APK

### Method 1: Android Studio (Easiest & Recommended)
1. Open **Android Studio**.
2. Click **Open an Existing Project** and select the `antri-mobile/android/` folder.
3. Wait for Gradle sync to complete.
4. Click **Build** $\rightarrow$ **Build Bundle(s) / APK(s)** $\rightarrow$ **Build APK(s)**.
5. Your output `.apk` file will be generated at:
   ```
   antri-mobile/android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

### Method 2: Command Line (Gradle)
If you have the Android SDK and Java installed:

```bash
cd antri-mobile/android
./gradlew assembleDebug
```

---

### Method 3: Live PWA Mode (No Build Required)
Run the live mobile server from the main ANTRI CLI repository:

```bash
antri mobile
```
Open the provided Network URL (e.g. `http://192.168.1.x:3457`) on your smartphone and tap **Add to Home Screen**.
