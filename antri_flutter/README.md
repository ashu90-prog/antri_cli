# 📱 ANTRI Mobile — Flutter Cross-Platform Client

**ANTRI Mobile** is a cross-platform mobile application for **iOS, Android, and Desktop** built with **Flutter**, featuring autonomous AI coding, multi-persona dialectic reasoning, iterative goal refinement, on-device thinking profile editing, and **Google Cloud Firestore synchronization**.

---

## 🎨 Design Philosophy
- **Minimalist Editorial Cream-White Palette**: Background `#FCFBF9`, subtle card container `#FFFFFF`, hairlines `#E6E0D4`, deep charcoal text `#1C1917`.
- **Zero Emojis**: Crisp typographic indicators and clean geometric status dots.
- **Fluid & Responsive**: Safe-area insets, auto-scrolling studio, adaptive keyboard handling, and bottom navigation bar.

---

## 🌟 Features Included

1. **Agent Studio (`AgentStudioView`)**:
   - Continuous chat streaming with Vibe Mode & Plan Mode toggle.
   - Multimodal `+` button for taking camera photos or selecting gallery images.
   - File attachment preview chips.

2. **Dialectic Arena (`DialecticArenaView`)**:
   - 4-persona autonomous self-debate engine (The Proposer $\rightarrow$ The Adversary $\rightarrow$ The Researcher $\rightarrow$ The Judge).

3. **Goal Loop Pipeline (`GoalLoopView`)**:
   - 3-stage iterative self-refinement engine:
     - **Stage 1**: Initial formulation & code drafting.
     - **Stage 2**: Adversarial critique, flaw detection & 0-100% quality score.
     - **Stage 3**: Production-ready hardened delivery.

4. **Thinking Profiles (`ProfilesView`)**:
   - View, create, and edit custom Markdown thinking profiles directly on your mobile device.
   - Real-time one-tap sync with Google Cloud Firestore.

5. **Multi-Provider AI Engine (`AIService`)**:
   - Direct on-device connections to **11+ AI providers**:
     - ⚡ Cerebras (`llama-3.3-70b`)
     - 🏢 Cohere (`command-r-plus-08-2024`)
     - 🌀 Vortex API
     - 💻 OpenCode
     - 🔮 DeepSeek (`deepseek-chat`, `deepseek-reasoner`)
     - 🟢 NVIDIA NIM
     - 🤖 OpenAI (`gpt-4o`, `o1`)
     - 🧠 Anthropic (`claude-3-7-sonnet`)
     - ✨ Google Gemini (`gemini-2.5-flash`, `gemini-2.5-pro`)
     - 🦙 Ollama / Custom Server

---

## ☁️ Google Cloud Firestore Synchronization

Connect your Laptop CLI (`antri`) and Flutter Mobile App in real-time using Google Cloud Firestore:

### Step 1: Create a Firestore Database in Google Cloud
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a project (e.g. `antri-hackathon-2026`).
3. Search for **Firestore** $\rightarrow$ Click **Create Database** $\rightarrow$ Select **Native Mode**.
4. Set Location (e.g. `nam5` or `asia-south1`) and click **Create**.

### Step 2: Configure Flutter Mobile App
1. Open the Flutter app $\rightarrow$ Tap the **Settings** tab.
2. Under **Google Cloud Firestore Sync**, enter your **Google Cloud Project ID** (e.g. `antri-hackathon-2026`).
3. Enter your **Sync Key** (e.g. `ashu90` or `my_device`).
4. Tap **Save Settings**.

### Step 3: Sync with Laptop CLI
On your laptop, configure the same project:
```bash
# Configure sync
antri sync config antri-hackathon-2026 ashu90

# Push local profiles from laptop to Google Cloud Firestore
antri sync push

# Pull updated profiles created on mobile to laptop
antri sync pull
```

---

## 🚀 How to Run the Flutter App

```bash
# 1. Navigate to the flutter app folder
cd antri_flutter

# 2. Get dependencies
flutter pub get

# 3. Run on connected Android / iOS device or emulator
flutter run
```
