import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { AntriConfig, ChatMessage, ToolCall, ToolResult, ToolDefinition } from '../types.js';
import { createProvider } from '../providers/index.js';
import { ConversationHistory } from './history.js';
import { getAllActiveTools, ToolExecutor } from './tools.js';
import { TerminalRenderer } from '../cli/renderer.js';
import { FilePickerService } from '../cli/dialogs/filePicker.js';
import { CitationEngine } from './citations.js';
import { memoryManager } from '../memory/manager.js';
import { profileManager } from '../profiles/profileManager.js';
import { skillManager, SkillHarness } from '../skills/skillManager.js';
import { SelfDebugger } from './debugger.js';
import { metaOptimizer } from './metaOptimizer.js';
import { sessionManager } from './sessionManager.js';
import { log } from '../utils/logger.js';

export function isArtifactOrVisualPrompt(prompt: string): boolean {
  if (!prompt || typeof prompt !== 'string') return false;
  const p = prompt.trim().toLowerCase();
  
  return p.startsWith('/mindmap') ||
         p.startsWith('/imagine') ||
         p.startsWith('/view') ||
         p.startsWith('/artifacts') ||
         p.startsWith('/arch') ||
         p.includes('create artifact') ||
         p.includes('create an artifact') ||
         p.includes('make an artifact') ||
         p.includes('generate artifact') ||
         p.includes('make artifact') ||
         p.includes('build an artifact') ||
         p.includes('html artifact') ||
         p.includes('visual artifact');
}

export function isGoalOrPlanQuery(prompt: string): boolean {
  if (!prompt || typeof prompt !== 'string') return false;
  const p = prompt.trim().toLowerCase();
  if (p.startsWith('/goal') || p.startsWith('/silent-goal') || p.startsWith('goal:') || p.startsWith('objective:')) {
    return true;
  }
  // Matches structured multi-day/week/month plans, workouts, diets, roadmaps, and routines
  const pattern = /\b(\d+[\s-]day|\d+[\s-]week|\d+[\s-]month|workout plan|diet plan|fitness plan|training plan|exercise routine|study plan|learning roadmap|study schedule|launch roadmap|routine plan|curriculum plan|meal plan|travel itinerary)\b/i;
  return pattern.test(p);
}

export function isDebateOrTradeoffQuery(prompt: string): boolean {
  if (!prompt || typeof prompt !== 'string') return false;
  const p = prompt.trim().toLowerCase();
  if (p.startsWith('/debate') || p.startsWith('/silent-debate') || p.startsWith('/dialectic') || p.startsWith('research on ') || p.startsWith('debate on ')) {
    return true;
  }
  // Matches deep architectural trade-offs, pros & cons, and vs comparisons
  const pattern = /\b(vs\b|versus\b|trade-?offs?\b|debate on\b|pros and cons of\b|which is better\b|should i use .+ or)\b/i;
  return pattern.test(p);
}

export class AntriAgent {
  private config: AntriConfig;
  private history: ConversationHistory;
  private toolExecutor: ToolExecutor;
  private citationEngine: CitationEngine;

  constructor(config: AntriConfig, history?: ConversationHistory) {
    this.config = config;
    this.history = history || new ConversationHistory();
    if (!history) {
      this.syncHistoryFromActiveSession();
    }
    this.toolExecutor = new ToolExecutor(config.workingDir);
    this.citationEngine = new CitationEngine();
  }

  public syncHistoryFromActiveSession(): void {
    const active = sessionManager.getActiveSession();
    this.history.setMessages(active.messages || []);
  }

  public getHistory(): ConversationHistory {
    return this.history;
  }

  public updateConfig(newConfig: AntriConfig): void {
    this.config = newConfig;
    this.toolExecutor = new ToolExecutor(newConfig.workingDir);
  }

  private buildSystemPrompt(recalledMemoryContext = '', activeSkillContext = '', isVisual = false): string {
    const activeProfileName = profileManager.getActiveProfileName();
    const activeProfileContent = profileManager.getActiveProfileContent();
    const mode = this.config.mode || 'vibe';

    let modeDirective = '';
    if (mode === 'plan') {
      modeDirective = `
⚡ ACTIVE OPERATING MODE: PLAN MODE
- You are in PLAN MODE. Your primary goal is to collaborate with the user on high-level architecture, design specifications, and step-by-step implementation blueprints BEFORE writing code.
- Propose structured phased roadmaps (Phase 1, Phase 2, etc.) and list necessary file additions/modifications.
- Ask sharp clarifying questions regarding trade-offs, tech choices, or edge cases.
- Do NOT prematurely modify codebase files or execute destructive actions without presenting the plan first and getting user alignment.`;
    } else {
      modeDirective = `
⚡ ACTIVE OPERATING MODE: VIBE MODE
- You are in VIBE MODE. You directly chat with the user and immediately implement features, write code, run commands, and execute tools in continuous flow.
- Deliver working, high-quality, production-ready code with maximum speed and precision.`;
    }

    const allSkills = skillManager.listSkills();
    const skillListSummary = allSkills
      .slice(0, 15)
      .map((s) => `- ${s.name} (${s.id}): ${s.description.slice(0, 80)}`)
      .join('\n');

    const visualArtifactSection = isVisual
      ? `
- 🎨 DESIGN-FIRST VISUAL ARTIFACT & INTERACTIVE APP MANDATE (Active for /view, /artifacts, /mindmap, /imagine, /arch, and visual artifact queries):
  - 🧠 PHASE 1: DELIBERATE DESIGN & ARCHITECTURAL THINKING (NEVER RUSH):
    - Do NOT rush to generate a 20-line bare HTML snippet! Take all the time needed to build a comprehensive, multi-section, highly polished, and feature-complete application (300+ to 600+ lines of complete, working HTML/CSS/JS).
    - Formulate a clear design vision:
      * Visual Theme & Aesthetic: (e.g., Deep Obsidian Glassmorphism, Neon Cyberpunk Aura, Silicon Valley Modern Bento, Radiant Gradient Mesh).
      * Color Harmony & Typography: Curated Google Fonts (Inter, Plus Jakarta Sans, Outfit, Fira Code), vibrant multi-color accents (#6366f1 indigo, #ec4899 pink, #06b6d4 cyan, #10b981 emerald, #f59e0b amber).
      * UX & Interaction Architecture: 3-6 distinct tabbed views/pages, dynamic interactive widgets, real-time calculation sliders, animated charts, audio feedback synthesizer, particle effects, and toast notifications.
  - 🎨 PHASE 2: MODERN ANIMATED CSS ARCHITECTURE:
    - Include Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script> with customized theme config script.
    - Include Google Fonts & Lucide Icons CDN (<script src="https://unpkg.com/lucide@latest"></script>).
    - Include Chart.js (<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>) and Canvas-Confetti (<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>).
    - Rich Custom Keyframe Animations:
      * @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
      * @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 15px rgba(99,102,241,0.35); } 50% { box-shadow: 0 0 30px rgba(236,72,153,0.55); } }
      * @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      * @keyframes gradientMove { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    - Glassmorphism & UI Polishing:
      * backdrop-blur-xl, frosted semi-transparent cards (background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.1)), radiant mesh gradients, custom scrollbars, and smooth hover/active micro-interactions.
  - ⚡ PHASE 3: ROBUST & REACTIVE JAVASCRIPT:
    - 100+ lines of robust, modular, strict-mode ES6+ JavaScript.
    - Full reactive state management: 'const state = { ... }; function render() { ... }'.
    - Sound Synthesizer: Synthesize pleasant UI audio feedback (clicks, beeps, chimes) using the Web Audio API (new (window.AudioContext || window.webkitAudioContext)()) for button presses and milestone completions.
    - Interactive Widgets: Working timers/stopwatches, real-time dynamic search/filter/sort, live updating Chart.js instances, confetti celebration triggers, local storage persistence, modal dialogs, and toast notifications.
    - 🚨 ZERO PLACEHOLDER RULE: Every single button, slider, toggle, and tab must be 100% implemented and functional!
  - 🌐 Output Enclosure:
    - Wrap the entire complete HTML inside <antri_artifact id="art_UNIQUE_ID" type="html" title="DESCRIPTIVE TITLE"><!DOCTYPE html><html lang="en">...</html></antri_artifact>.
  - 🧠 Interactive Visual Mind Maps (/mindmap):
    - Generate a rich Mermaid mindmap wrapped in <antri_artifact id="mindmap_UNIQUE_ID" type="mindmap" title="TOPIC TITLE">mindmap ...</antri_artifact>.
    - 🚨 ABSOLUTE MANDATE: Tailor ALL branches and leaf nodes with deep, factual domain concepts. Never output generic placeholder words.`
      : `
- 💻 REAL MULTI-FILE WORKSPACE CODING PROTOCOL (Claude Code & Antigravity Standard):
  - ALWAYS write real multi-file source code directly into the workspace using 'write_file', 'create_directory', and 'edit_file'.
  - 🚨 ABSOLUTE PROHIBITION OF SAMPLE / DUMMY / PLACEHOLDER TEXT:
    * STRICTLY BANNED: Never write "This is a sample...", "Sample portfolio", "This is an about section", "Sample project", "Lorem ipsum", "Edit", "Click here to edit", or raw unstyled mockups.
    * MANDATORY: Populate every website and app with rich, believable, professional domain content (e.g. Senior Full-Stack & AI Systems Engineer, deep technical project case studies, metrics like "10x throughput, 50k+ stars", animated skills matrix, real career milestones, and working interactive tools).
  - For Modern Web Applications (HTML / CSS / JavaScript):
    * Create clean, modular separate files:
      1. 'index.html':
         - Modern semantic HTML5 (<header>, <nav>, <main>, <section id="hero">, <section id="about">, <section id="projects">, <section id="skills">, <section id="experience">, <section id="contact">, <footer>).
         - Responsive viewport: <meta name="viewport" content="width=device-width, initial-scale=1.0">.
         - CDNs: Tailwind CSS (<script src="https://cdn.tailwindcss.com"></script>), Google Fonts (Inter, Plus Jakarta Sans, Outfit), Lucide Icons (<script src="https://unpkg.com/lucide@latest"></script>), Canvas-Confetti (<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>).
         - High-craft UI layout: sticky glassmorphic navbar with mobile drawer, hero section with dynamic typing badge and dual CTAs, project showcase grid with category filters and detail modals, interactive skill progress meters, working contact form with validation, copy-to-clipboard social badges, and back-to-top button.
         - Proper <link rel="stylesheet" href="style.css"> & <script src="app.js"></script>.
      2. 'style.css':
         - 150+ lines of modern CSS3: :root custom properties for dark/light theme palettes, glassmorphism (.glass-card { backdrop-filter: blur(16px); background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.1); }), radiant mesh gradients (radial-gradient), keyframe animations (@keyframes float, @keyframes pulseGlow, @keyframes shimmer, @keyframes gradientShift), custom scrollbars, card hover lifts with colored shadow auras, and 100% mobile responsiveness (@media (max-width: 768px)).
      3. 'app.js':
         - 120+ lines of robust, strict-mode ES6+ JavaScript:
           * Theme switcher (Dark / Light / Cyberpunk) with localStorage persistence.
           * Dynamic category filters for projects ("All", "AI / LLMs", "Full-Stack", "Cloud / DevOps") with animated card transitions.
           * Interactive project detail modal system (opens modal with tech breakdown, architecture details, and live links).
           * Interactive contact form handling: real-time validation, character counter, simulated submission loading state, confetti celebration trigger, and toast notification.
           * Interactive audio synthesizer via Web Audio API for tactile button clicks.
           * Smooth scrolling with active navbar link spy (IntersectionObserver).
           * ZERO dummy or placeholder stubs.
  - For React / Next.js / Vite Projects:
    * Create 'package.json' with exact modern dependencies and scripts (dev, build, start).
    * Create config files: 'tsconfig.json', 'tailwind.config.js', 'postcss.config.js'.
    * Create modular components: 'app/layout.tsx', 'app/page.tsx', 'components/Navbar.tsx', 'components/Hero.tsx', 'components/...'.
  - For Node.js / Express / Backend APIs:
    * Create 'package.json', 'tsconfig.json', 'src/server.ts', 'src/routes/', 'src/controllers/', 'src/middleware/'.
  - For Python Projects:
    * Create 'requirements.txt', 'main.py', and modular packages ('app/', 'tests/').
  - After creating files, provide clear execution instructions (e.g. 'npm install && npm run dev', 'start index.html', 'python -m http.server 8000').`;

    const basePrompt = `You are ANTRI Code, an elite terminal-first AI software engineer, autonomous pair-programming agent, and full-stack systems builder (modeled after Claude Code and Google Antigravity).

Core Behavioral Principles:
1. 🚀 AUTONOMOUS WORKSPACE ENGINEERING & CODEBASE BUILDER:
   - You are a world-class Principal Software Engineer and Systems Builder with peerless mastery across TypeScript, JavaScript, Node.js, Next.js, React, Python, Express, Tailwind CSS, HTML5, CSS3, Flutter, Rust, Go, SQL, System Architecture, and CLI tool design.
   - When the user asks to build, create, develop, code, fix, or modify any software project (e.g. "code a website", "build a todo app", "make a portfolio with Next.js", "build a CLI tool like antri", "create an e-commerce store", "fix this bug"):
     - **STEP 1: INSPECT & PLAN**: Call 'list_dir', 'find_files', or 'read_file' to understand workspace structure and existing codebase context.
     - **STEP 2: DIRECT MULTI-FILE FILE GENERATION**:
       - You MUST write REAL, MULTI-FILE, PRODUCTION-GRADE source code directly into the workspace using workspace tools ('write_file', 'create_directory', 'edit_file').
       - 🚨 CRITICAL MANDATE: NEVER output <antri_artifact> tags or fake single-file mockups when asked to code or build software in a workspace! Real code belongs in the workspace project directory with proper modular architecture.
     - **STEP 3: EXTREME QUALITY & ZERO PLACEHOLDERS**:
       - Zero placeholder comments (NO '// TODO', NO '/* add code here */', NO empty stubs). Write complete, robust, functional code.
       - Modern ES6+, strict types, responsive layouts, smooth animations, clean modular functions.
     - **STEP 4: EXECUTION & LAUNCH GUIDES**:
       - If package.json exists: run or explain 'npm install && npm run dev'.
       - If static HTML: run or explain 'start index.html' (Windows) or 'open index.html' (macOS) or 'xdg-open index.html' (Linux).
2. Direct Conversation & Natural Dialogue: When the user sends a greeting (e.g. "hello", "hi", "hey", "who are you"), asks questions, or chats, ALWAYS respond directly with helpful, friendly conversational text. NEVER execute 'run_command' (e.g. echo, printf) or any workspace tool to deliver greetings, conversational messages, or chat responses.
3. Lead the Way & Guide Step-by-Step: Don't just give passive answers. Proactively lead the way, lay out step-by-step execution roadmaps, and propose the next logical milestones.
4. 💡 Interactive Inquiries, Creative Directions & "Just Code It" Fast-Path:
   - **When specifications are open-ended or underspecified** (e.g. user says "make a website", "code a portfolio", "create a todo app", "build an e-commerce store" without details):
     * Do NOT blindly race through or make arbitrary assumptions.
     * Directly ask **2–3 sharp, direct clarifying questions in the chat** (e.g. preferred visual aesthetic, essential features/sections, tech stack/framework preference) and offer **2–3 creative architectural directions/options** (Option 1: Minimalist Bento Grid, Option 2: Dark Aurora Neon Glow, Option 3: High-Motion Interactive).
   - **The "Just Code It" & Immediate Execution Fast-Path**:
     * If the user already provided specific instructions (e.g. "code a snake game in vanilla js", "build a fastapi app for blog posts"), OR if the user declines to give ideas (e.g. "just code it", "you decide", "build whatever", "skip questions", "i don't care, just make it", "proceed with option 1"):
       - **DO NOT endlessly stall or ask repetitive questions.**
       - **IMMEDIATELY make the best, most elegant architectural choices autonomously and directly write the entire codebase** into the workspace files using 'write_file' and 'create_directory'!
       - Deliver 100% complete, fully implemented code and explain how to run and test it.
5. Adaptive Note-Taking & Feedback Capture: Pay close attention to user feedback, preferred conventions, and mental models. Continuously adapt your explanations and code to their unique thinking style.
6. 🌐 Dual-Delivery Synergy & Clear Differentiation:
   - Understand and clearly communicate the distinct roles of **Workspace Codebase** vs. **Interactive Live Artifact**:
     * 📁 **Workspace Codebase (Physical Files on Disk)**: Real, modular source files written directly into the project directory using 'write_file' (index.html, style.css, app.js, package.json, etc.) for production deployment, terminal execution, and Git version control.
     * 🎨 **Interactive Live Artifact (In-Chat / Desktop Preview)**: Standalone, self-contained single-file HTML/CSS/JS preview enclosed in '<antri_artifact id="art_UNIQUE_ID" type="html" title="TITLE">...</antri_artifact>' so the user can instantly click **"👁️ View Artifact"** to preview and interact with the application directly inside the Desktop/Mobile UI or CLI.
   - **Self-Inspection & Polish Loop**: When building a website or web app, ensure both the modular workspace files on disk AND the live preview artifact contain rich domain content, modern animated CSS, and full reactive JS state logic with zero dummy stubs. In your final response, clearly explain where the physical files were created and highlight the live artifact preview card.
${modeDirective}

Tooling & Workspace Capabilities:
1. Workspace & Coding Tools: read_file (inspect files with line ranges), write_file (create/overwrite files), edit_file (precise search & replace block editing), create_directory (folder creation), delete_file (remove files/folders), find_files (glob/name discovery), grep_search (regex/text code search with line numbers), file_info (inspect size, lines, dates), git_diff (inspect git changes/diffs), list_dir, search_files, run_command (terminal execution).
2. Autonomous Silent Debate & Goal Engines: run_silent_debate (secret multi-perspective adversarial consensus for deep research & architecture), run_silent_goal (secret 3-step goal loop optimizer).
3. Sandboxed Runtime: execute_python (run safe isolated Python code scripts).
4. Markdown Skills System: activate_skill (activate specialized expert instructions from .md skills).
5. Web & Research Tools: web_search (multi-provider search without API key), scrape_url (deep readable content extraction into Markdown), and crawl_docs (recursive documentation crawler).
6. Persistent Lifelong Memory & Active RAG Context: Utilize user profile preferences, project conventions, and accumulated notes in active context naturally.

Available Skills in Ecosystem:
${skillListSummary}

Autonomous Guidelines:
- 🚨 CONVERSATIONAL & GREETING RULE: ALWAYS respond directly in plain text for greetings, general conversation, or conceptual questions. NEVER call 'run_command' (echo/printf) to send messages or say hello to the user.
- 🚨 EMOJI USAGE RULE: You MUST use emojis, but keep them minimal and tasteful — MAXIMUM 2 EMOJIS in your entire response (e.g. in a section header or key bullet point). Never exceed 2 emojis total across your entire response.
- 🚨 STRICT TRUTHFULNESS & FAILURE INTEGRITY: If any tool execution fails (returns an error, ENOENT, command failed, or authentication required), you MUST truthfully state that the action failed and explain the exact reason. NEVER hallucinate or claim that an application or website was launched successfully when the command failed!
${visualArtifactSection}
- 💡 Autonomous Silent Debate & Goal Execution: For complex research queries or multi-step goal planning, you can autonomously execute 'run_silent_debate' or 'run_silent_goal' to debate and harden the solution secretly behind the scenes.
- If a task involves specialized engineering domains (e.g. code review, system design, debugging, security, API design, database modeling, performance, test automation, UX, DevOps), apply relevant skill guidelines.
- If a user asks for complex calculation, data analysis, or scripting, use 'execute_python'.
- If a user asks for external technical documentation, library APIs, or external code facts, autonomously call 'web_search', 'scrape_url', or 'crawl_docs'.
- 🚨 STRICT CONVERSATIONAL & EMPATHY RULE: NEVER call 'web_search' or any research tool on personal statements, personal life events, grief, bereavement, emotional expressions, personal names, or conversational sharing. Respond directly and authentically with genuine human empathy, warmth, and active listening.
- 🧠 PERMANENT COGNITIVE RECALL & MOTIVATION MEMORY: When the user shares personal history, loved ones, loss, or foundational motivations, recognize that this is permanently preserved in your active profile notes. Honor this connection in your responses.
- 'web_search' is STRICTLY for software frameworks, coding syntax, API documentation, error traces, and explicit web queries.
- Cite sources clearly when using web research.
- Write clean, production-grade, typed code.`;

    const profileContext = profileManager.getAllProfileContext(this.config.workingDir);

    const context = `\n\nWorkspace context:
- Current Working Directory: ${this.config.workingDir}
- Active Model: ${this.config.model}
- Active Mode: ${mode.toUpperCase()}
- Active Profile: ${activeProfileName}${profileContext}${recalledMemoryContext}${activeSkillContext}`;

    return basePrompt + context;
  }

  public async chat(
    userPrompt: string,
    onStreamToken?: (token: string) => void,
    onToolCall?: (toolCall: ToolCall) => void
  ): Promise<string> {
    const { AuthManager } = await import('../cloud/auth.js');
    const { RateLimiter } = await import('../security/rateLimiter.js');

    if (!AuthManager.isAuthenticated()) {
      const authRequiredMsg = `🔒 **AUTHENTICATION REQUIRED**\n\nYou must be logged in to chat with ANTRI, execute tools, and synchronize profiles across devices.\n\n👉 Please type \`/login <your-email>\` (or \`/register <email> <password>\`) to proceed.`;
      console.log(chalk.hex('#f43f5e')(authRequiredMsg));
      return authRequiredMsg;
    }

    const currentUser = AuthManager.getCurrentUser()!;

    const rateCheck = RateLimiter.checkLimit(currentUser.userId, 'chat');
    if (!rateCheck.allowed) {
      const throttledMsg = `⚠️ **RATE LIMIT EXCEEDED**\n\nRequest throttled for security. Please wait **${rateCheck.retryAfterSeconds}s** before sending another message.`;
      console.log(chalk.yellow(throttledMsg));
      return throttledMsg;
    }

    const startTime = Date.now();
    const activeProfileName = profileManager.getActiveProfileName();

    // 1. Extract Real-Time Insights, Identity, Philosophy & Thinking Style Preferences into Profile & Notes Silently
    const notedInsight = profileManager.extractAndRecordNotes(userPrompt, this.config.workingDir);
    if (notedInsight) {
      await memoryManager.learn(notedInsight, 'lesson_learned', this.config.workingDir);
    }

    // 2. Check for Relevant or Triggered Markdown Skills (.md) via Dedicated Skill Harness
    let skillContext = '';
    const relevantSkills = skillManager.findRelevantSkills(userPrompt);
    if (relevantSkills.length > 0) {
      const skillNames = relevantSkills.map((s) => chalk.bold.cyan(s.name)).join(', ');
      console.log(chalk.hex('#f59e0b')(`⚡ Activated Skill(s): ${skillNames}`));
      skillContext = SkillHarness.formatSkillExecutionDirectives(relevantSkills);
    }

    // 3. Autonomous Self-Recall into Persistent Memory Hierarchy with fast timeout guard
    const geminiKey = this.config.apiKeys.gemini || process.env.GEMINI_API_KEY;
    let contextText = '';
    try {
      const recallPromise = memoryManager.selfRecall(userPrompt, this.config.workingDir, geminiKey);
      const timeoutPromise = new Promise<{ contextText: string; recalled: any }>((res) =>
        setTimeout(() => res({ contextText: '', recalled: { hasMemories: false, semanticInsights: [], workspaceConventions: [] } }), 400)
      );
      const { contextText: recalledText, recalled } = await Promise.race([recallPromise, timeoutPromise]);
      contextText = recalledText;
      if (recalled && recalled.hasMemories && (recalled.semanticInsights?.length > 0 || recalled.workspaceConventions?.length > 0)) {
        const matchCount = (recalled.semanticInsights?.length || 0) + (recalled.workspaceConventions?.length || 0);
        console.log(chalk.hex('#818cf8')(`🧠 Recalled ${matchCount} relevant memory item(s) from persistent store`));
      }
    } catch {}

    // 4. Resolve any @file attachments in userPrompt
    const { enhancedPrompt, attachedFiles } = FilePickerService.extractAndReadAttachments(
      userPrompt,
      this.config.workingDir
    );

    if (attachedFiles.length > 0) {
      console.log(chalk.hex('#64748b')(`📎 Attached file(s): ${attachedFiles.map((f) => chalk.cyan(f)).join(', ')}`));
    }

    // 5. Add user message to active session & history
    const userMsg: ChatMessage = {
      role: 'user',
      content: enhancedPrompt,
    };
    this.history.addMessage(userMsg);
    sessionManager.addMessageToActiveSession(userMsg);

    // 5a. Auto-Initialize Autonomous Goal Loop for multi-day plans, workouts, diets, and structured roadmaps
    if (isGoalOrPlanQuery(userPrompt)) {
      const { GoalLoopEngine } = await import('./goalLoop.js');
      const { artifactManager } = await import('./artifactManager.js');
      const goalEngine = new GoalLoopEngine(this.config);

      const statusNote = chalk.bold.hex('#818cf8')('\n🎯 [Initializing Autonomous Silent Goal Loop for multi-stage plan...]');
      console.log(statusNote);
      if (onStreamToken) onStreamToken('🎯 *[Synthesizing multi-stage goal plan...]*\n\n');

      // Step 1: Run 3-stage silent goal optimization for deep, battle-tested plain text plan
      const planSolution = await goalEngine.runSilentGoal(userPrompt);
      const cleanPlan = planSolution.replace(/^>\s*🎯\s*\[Goal Loop Plan Synthesized\]\s*/i, '').trim();

      // Step 2: Stream the complete plain-text plan to user first
      if (onStreamToken) {
        onStreamToken(cleanPlan + '\n\n');
      }

      // Step 3: Bundle interactive visual SPA artifact with tabs, rest timer, progress tracker
      const planTitle = userPrompt
        .replace(/^(\/goal|\/silent-goal|goal:|objective:)\s*/i, '')
        .trim()
        .slice(0, 50) || 'Multi-Stage Interactive Plan';
      
      const artifactId = 'art_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const visualSpaHtml = artifactManager.generateRichTodoHtml ? artifactManager.generateRichTodoHtml(planTitle) : '';
      
      let fullResponse = cleanPlan;
      if (visualSpaHtml) {
        fullResponse += `\n\n<antri_artifact id="${artifactId}" type="html" title="${planTitle}">\n${visualSpaHtml}\n</antri_artifact>`;
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: fullResponse,
      };
      this.history.addMessage(assistantMsg);
      sessionManager.addMessageToActiveSession(assistantMsg);

      const activeSession = sessionManager.getActiveSession();
      const parsed = artifactManager.parseAndStoreArtifacts(
        fullResponse,
        activeSession?.id || 'cli_session',
        activeSession?.title || 'CLI Session'
      );

      if (parsed.artifacts && parsed.artifacts.length > 0) {
        const os = await import('os');
        const path = await import('path');
        for (const art of parsed.artifacts) {
          const icon = '🌐';
          const typeLabel = 'Interactive Multi-Page SPA';
          const filePath = artifactManager.getArtifactFilePath(art.id) || path.join(os.homedir(), '.antri', 'artifacts', `${art.id}.html`);
          const fileUri = `file:///${filePath.replace(/\\/g, '/')}`;

          console.log(chalk.bold.hex('#c084fc')(`\n┌─ ${icon} ${typeLabel}: ${art.title} ─────────────────┐`));
          console.log(`  ${chalk.bold.white('• ID:')}          ${chalk.cyan(art.id)}`);
          console.log(`  ${chalk.bold.white('• Live View:')}   ${chalk.green(fileUri)}`);
          console.log(`  ${chalk.bold.white('• Desktop:')}     ${chalk.hex('#818cf8')('Launch Desktop Control Plane with: antri --desktop')}`);
          console.log(chalk.bold.hex('#c084fc')(`└────────────────────────────────────────────────────────────┘\n`));
        }
      }

      memoryManager.recordInteraction(userPrompt, fullResponse);
      const duration = Date.now() - startTime;
      metaOptimizer.recordQuerySuccess(duration);

      const elapsed = Math.max(0.1, duration / 1000).toFixed(0);
      const modeTag = (this.config.mode || 'vibe').toUpperCase();
      console.log(chalk.hex('#64748b')(`* Worked for ${elapsed}s · Mode: ${modeTag} · Profile: ${activeProfileName}`));
      console.log();
      return fullResponse;
    }

    // 5b. Auto-Initialize Background Dialectic Consensus Debate for trade-off & vs queries
    if (isDebateOrTradeoffQuery(userPrompt)) {
      const { DialecticEngine } = await import('./dialectic.js');
      const { artifactManager } = await import('./artifactManager.js');
      const dialecticEngine = new DialecticEngine(this.config);

      const statusNote = chalk.bold.hex('#c084fc')('\n⚔️ [Initializing Background Dialectic Consensus Debate...]');
      console.log(statusNote);
      if (onStreamToken) onStreamToken('⚔️ *[Conducting multi-perspective dialectic debate in background...]*\n\n');

      const debateQuery = userPrompt
        .replace(/^(\/debate|\/silent-debate|\/dialectic|research on|debate on)\s*/i, '')
        .trim();
      
      const consensus = await dialecticEngine.silentDebate(debateQuery || userPrompt, this.config.debateDepth || 'deep');
      const cleanConsensus = consensus.replace(/^>\s*⚔️\s*\[Dialectic Consensus Synthesized\]\s*/i, '').trim();

      if (onStreamToken) {
        onStreamToken(cleanConsensus + '\n\n');
      }

      const debateTitle = `${(debateQuery || userPrompt).slice(0, 45)} · Dialectic Consensus`;
      const artifactId = 'mindmap_' + Date.now().toString(36);
      const rawMindmap = `mindmap\n  root((${debateTitle}))\n    Primary Case & Structural Strengths\n    Critical Trade-offs & Counter-Perspectives\n    Empirical Evidence & Production Metrics\n    Strategic Decision Heuristics`;
      const mindmapSnippet = artifactManager.sanitizeAndEnhanceMindmap(rawMindmap, debateTitle);

      const fullResponse = `${cleanConsensus}\n\n<antri_artifact id="${artifactId}" type="mindmap" title="${debateTitle}">\n${mindmapSnippet}\n</antri_artifact>`;

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: fullResponse,
      };
      this.history.addMessage(assistantMsg);
      sessionManager.addMessageToActiveSession(assistantMsg);

      const activeSession = sessionManager.getActiveSession();
      const parsed = artifactManager.parseAndStoreArtifacts(
        fullResponse,
        activeSession?.id || 'cli_session',
        activeSession?.title || 'CLI Session'
      );

      if (parsed.artifacts && parsed.artifacts.length > 0) {
        const os = await import('os');
        const path = await import('path');
        for (const art of parsed.artifacts) {
          const icon = '🧠';
          const typeLabel = 'Interactive Markmap Mind Map';
          const filePath = artifactManager.getArtifactFilePath(art.id) || path.join(os.homedir(), '.antri', 'artifacts', `${art.id}.html`);
          const fileUri = `file:///${filePath.replace(/\\/g, '/')}`;

          console.log(chalk.bold.hex('#c084fc')(`\n┌─ ${icon} ${typeLabel}: ${art.title} ─────────────────┐`));
          console.log(`  ${chalk.bold.white('• ID:')}          ${chalk.cyan(art.id)}`);
          console.log(`  ${chalk.bold.white('• Live View:')}   ${chalk.green(fileUri)}`);
          console.log(`  ${chalk.bold.white('• Desktop:')}     ${chalk.hex('#818cf8')('Launch Desktop Control Plane with: antri --desktop')}`);
          console.log(chalk.bold.hex('#c084fc')(`└────────────────────────────────────────────────────────────┘\n`));
        }
      }

      memoryManager.recordInteraction(userPrompt, fullResponse);
      const duration = Date.now() - startTime;
      metaOptimizer.recordQuerySuccess(duration);

      const elapsed = Math.max(0.1, duration / 1000).toFixed(0);
      const modeTag = (this.config.mode || 'vibe').toUpperCase();
      console.log(chalk.hex('#64748b')(`* Worked for ${elapsed}s · Mode: ${modeTag} · Profile: ${activeProfileName}`));
      console.log();
      return fullResponse;
    }

    const response = await this.runAgentLoop(0, contextText, skillContext, onStreamToken, onToolCall);

    // 5c. Parse and persist any interactive Claude-style artifacts (<antri_artifact>...</antri_artifact>)
    const { artifactManager } = await import('./artifactManager.js');
    const activeSession = sessionManager.getActiveSession();
    const parsed = artifactManager.parseAndStoreArtifacts(
      response,
      activeSession?.id || 'cli_session',
      activeSession?.title || 'CLI Session'
    );

    if (parsed.artifacts && parsed.artifacts.length > 0) {
      const os = await import('os');
      const path = await import('path');
      for (const art of parsed.artifacts) {
        const isMindmap = art.type === 'mindmap';
        const isGraph = art.type === 'graph';
        const icon = isMindmap ? '🧠' : isGraph ? '📊' : '🌐';
        const typeLabel = isMindmap ? 'Interactive Markmap Mind Map' : isGraph ? 'Code Architecture Graph' : 'Interactive Multi-Page SPA';
        const filePath = artifactManager.getArtifactFilePath(art.id) || path.join(os.homedir(), '.antri', 'artifacts', `${art.id}.html`);
        const fileUri = `file:///${filePath.replace(/\\/g, '/')}`;

        console.log(chalk.bold.hex('#c084fc')(`\n┌─ ${icon} ${typeLabel}: ${art.title} ─────────────────┐`));
        console.log(`  ${chalk.bold.white('• ID:')}          ${chalk.cyan(art.id)}`);
        console.log(`  ${chalk.bold.white('• Live View:')}   ${chalk.green(fileUri)}`);
        console.log(`  ${chalk.bold.white('• Desktop:')}     ${chalk.hex('#818cf8')('Launch Desktop Control Plane with: antri --desktop')}`);
        console.log(chalk.bold.hex('#c084fc')(`└────────────────────────────────────────────────────────────┘\n`));
      }
    }

    // 6. Record interaction into persistent episodic memory & meta-optimizer
    memoryManager.recordInteraction(userPrompt, response);
    const duration = Date.now() - startTime;
    metaOptimizer.recordQuerySuccess(duration);

    const elapsed = Math.max(0.1, duration / 1000).toFixed(0);
    const modeTag = (this.config.mode || 'vibe').toUpperCase();
    console.log(chalk.hex('#64748b')(`* Worked for ${elapsed}s · Mode: ${modeTag} · Profile: ${activeProfileName}`));
    console.log();

    return response;
  }

  private async runAgentLoop(
    depth = 0,
    memoryContext = '',
    skillContext = '',
    onStreamToken?: (token: string) => void,
    onToolCall?: (toolCall: ToolCall) => void
  ): Promise<string> {
    if (depth > 6) {
      log.warn('Max agent tool iteration depth reached.');
      return '';
    }

    const provider = createProvider(this.config);
    const historyMsgs = this.history.getMessages();
    const lastUserMsg = historyMsgs.filter((m) => m.role === 'user').pop()?.content || '';
    const isVisual = isArtifactOrVisualPrompt(lastUserMsg);
    const systemPrompt = this.buildSystemPrompt(memoryContext, skillContext, isVisual);

    const messagesWithSystem: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMsgs,
    ];

    const modeLabel = this.config.mode === 'plan' ? 'Planning & Designing Roadmap...' : 'Thinking & Writing Code...';
    let spinner: Ora | null = ora({
      text: chalk.hex('#a5b4fc')(modeLabel),
      spinner: 'dots',
      color: 'cyan',
    }).start();

    let hasStreamedTokens = false;
    let fullResponse = '';
    const pendingToolCalls: ToolCall[] = [];

    try {
      let activeTools: ToolDefinition[] = [];
      if (this.config.autoExecuteTools) {
        activeTools = getAllActiveTools(isVisual);
      }

      fullResponse = await provider.sendMessageStream(
        messagesWithSystem,
        activeTools,
        {
          onToken: (token: string) => {
            if (spinner) {
              spinner.stop();
              spinner = null;
            }
            if (!hasStreamedTokens) {
              hasStreamedTokens = true;
            }
            TerminalRenderer.printToken(token);
            if (onStreamToken) {
              onStreamToken(token);
            }
          },
          onToolCall: (toolCall: ToolCall) => {
            if (spinner) {
              spinner.text = chalk.hex('#38bdf8')(`⚙️ Executing tool: ${toolCall.function.name}...`);
            }
            pendingToolCalls.push(toolCall);
            if (onToolCall) {
              onToolCall(toolCall);
            }
          },
        }
      );

      if (spinner) {
        spinner.stop();
        spinner = null;
      }

      if (hasStreamedTokens) {
        console.log(); // Newline after stream
        console.log();
      }

      // 1. Intercept pure conversational echo/printf commands so they render directly to user without tool badge or loop recursion
      if (pendingToolCalls.length === 1 && pendingToolCalls[0].function.name === 'run_command') {
        let parsedArgs: any = {};
        try {
          parsedArgs = JSON.parse(pendingToolCalls[0].function.arguments || '{}');
        } catch {
          parsedArgs = {};
        }
        const { extractEchoMessage } = await import('./tools.js');
        const echoMessage = extractEchoMessage(parsedArgs.command || '');
        if (echoMessage) {
          TerminalRenderer.printToken(echoMessage);
          console.log();
          console.log();
          if (onStreamToken) {
            onStreamToken(echoMessage);
          }

          const directMsg: ChatMessage = {
            role: 'assistant',
            content: echoMessage,
          };
          this.history.addMessage(directMsg);
          sessionManager.addMessageToActiveSession(directMsg);
          return echoMessage;
        }
      }

      // Record assistant message to active session & history
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: fullResponse,
        tool_calls: pendingToolCalls.length > 0 ? pendingToolCalls : undefined,
      };
      this.history.addMessage(assistantMsg);
      sessionManager.addMessageToActiveSession(assistantMsg);

      // If LLM produced tool calls, execute them and continue loop
      if (pendingToolCalls.length > 0) {
        for (const tc of pendingToolCalls) {
          let parsedArgs: any = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch {
            parsedArgs = {};
          }

          const toolStart = Date.now();
          let result: ToolResult = await this.toolExecutor.execute(tc.function.name, parsedArgs, tc.id);

          // If authentication is required, output immediately without letting the model hallucinate success
          if (result.error && (result.output.includes('AUTHENTICATION REQUIRED') || result.output.includes('You must be logged into'))) {
            TerminalRenderer.printToolCompact(tc, result);
            return `🔒 **Authentication Required**\n\nYou must be logged into an ANTRI account to execute tools or run commands.\n👉 Please log in by typing: \`/login <your-email>\``;
          }

          // Autonomous Self-Debugging Loop on tool failure
          if (result.error) {
            metaOptimizer.recordToolExecution(tc.function.name, Date.now() - toolStart, true);
            const repair = await SelfDebugger.autoDebugAndRepair(
              tc,
              result,
              this.config,
              (n, a, id) => this.toolExecutor.execute(n, a, id)
            );

            if (repair.repaired && repair.repairedResult) {
              result = repair.repairedResult;
              metaOptimizer.recordSelfHealing();
            }
          } else {
            metaOptimizer.recordToolExecution(tc.function.name, Date.now() - toolStart, false);
          }

          // Track citations if web search or scrape
          if (tc.function.name === 'web_search' && parsedArgs.query) {
            this.citationEngine.addSource(`Web Search: ${parsedArgs.query}`, `https://duckduckgo.com/?q=${encodeURIComponent(parsedArgs.query)}`, undefined, 'DuckDuckGo');
          } else if (tc.function.name === 'scrape_url' && parsedArgs.url) {
            this.citationEngine.addSource(`Scraped URL`, parsedArgs.url, undefined, 'Web Reader');
          } else if (tc.function.name === 'crawl_docs' && parsedArgs.url) {
            this.citationEngine.addSource(`Documentation Root`, parsedArgs.url, undefined, 'Doc Crawler');
          }

          // Output compact single-line tool usage
          TerminalRenderer.printToolCompact(tc, result);

          this.history.addMessage({
            role: 'tool',
            name: tc.function.name,
            tool_call_id: tc.id,
            content: result.output,
          });
        }

        // Loop back to let assistant interpret tool results
        return await this.runAgentLoop(depth + 1, memoryContext, skillContext, onStreamToken, onToolCall);
      }

      // Filter any accidental model boilerplate explaining the tool
      if (fullResponse.includes('The function `run_command` is used') || fullResponse.includes('echo statement that prints a greeting')) {
        fullResponse = fullResponse
          .replace(/The function `run_command` is used to execute a shell command in the workspace\. In this case, the command is an echo statement that prints a greeting message\./gi, '')
          .replace(/The function `run_command` is used[\s\S]*?greeting message\./gi, '')
          .trim();
      }

      return fullResponse;
    } catch (err: any) {
      if (spinner) {
        spinner.stop();
      }
      log.error(`Request failed: ${err.message}`);
      
      const debugResult = await SelfDebugger.handleAntriError(err, this.config);
      return debugResult.fallbackResponse;
    }
  }

  public getToolExecutor(): ToolExecutor {
    return this.toolExecutor;
  }
}
