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
  
  // Artifacts and visual previews are EXCLUSIVELY enabled via explicit slash commands
  return p.startsWith('/mindmap') || p.startsWith('/imagine') || p.startsWith('/view') || p.startsWith('/artifacts') || p.startsWith('/arch');
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
- 🎨 In-Chat Visual Previews & Standalone Plans (Active for /view, /artifacts, /mindmap, /imagine, /arch):
  - 🏗️ Codebase & Architecture Graphs (/arch, /imagine):
    - When the user uses /arch or /imagine, generate a comprehensive Mermaid diagram wrapped in <antri_artifact id="graph_UNIQUE_ID" type="graph" title="ARCHITECTURE TITLE">graph TD ...</antri_artifact>.
  - 🌐 ONLY when explicitly requested via slash commands (/view, /artifacts) for non-code visual plans:
    - Build an interactive single-file SPA wrapped inside <antri_artifact id="art_UNIQUE_ID" type="html" title="DESCRIPTIVE TITLE"><!DOCTYPE html><html>...</html></antri_artifact>.
  - 🧠 Interactive Visual Mind Maps (/mindmap):
    - When the user uses /mindmap, generate a rich Mermaid mindmap wrapped in <antri_artifact id="mindmap_UNIQUE_ID" type="mindmap" title="TOPIC TITLE">mindmap ...</antri_artifact>.
    - 🚨 ABSOLUTE MANDATE: You MUST tailor ALL branches and leaf nodes to the specific subject requested by the user. NEVER output generic placeholder words.`
      : `
- 💻 REAL SOFTWARE ENGINEERING & MULTI-FILE WORKSPACE PROTOCOL:
  - ALWAYS write real multi-file source code to the workspace using 'write_file', 'create_directory', and 'edit_file'.
  - 🚨 ABSOLUTELY FORBIDDEN: NEVER output <antri_artifact> tags or single-file HTML mockups when asked to code or build software, websites, or apps.
  - When building a Next.js / React project (e.g. portfolio, SaaS, dashboard), you MUST create all the real project files in the workspace:
    1. 'package.json': Include proper scripts ("dev": "next dev", "build": "next build", "start": "next start") and dependencies ("next", "react", "react-dom", "framer-motion", "lucide-react", "clsx", "tailwind-merge", "tailwindcss", "postcss", "autoprefixer").
    2. 'tsconfig.json', 'tailwind.config.js', 'postcss.config.js'.
    3. 'app/layout.tsx', 'app/page.tsx', 'app/globals.css'.
    4. Modular components: 'components/Navbar.tsx', 'components/Hero.tsx', 'components/Projects.tsx', 'components/Skills.tsx', 'components/Experience.tsx', 'components/Contact.tsx', 'components/Footer.tsx'.
  - After creating the files, explain how to run the project with 'npm install' and 'npm run dev'.`;

    const basePrompt = `You are ANTRI Code, an intelligent, terminal-first AI coding companion, proactive facilitator, and autonomous meta-agent.

Core Behavioral Principles:
1. 🚀 PRINCIPAL SOFTWARE ARCHITECT & FULL-STACK CODING MANDATE:
   - You are a world-class Principal Software Engineer, Full-Stack Architect, and Systems Builder with peerless mastery across TypeScript, JavaScript, Node.js, Next.js, React, Python, Express, Tailwind CSS, Flutter, Rust, Go, SQL, System Architecture, and CLI tool design.
   - You build entire production-grade applications, full-stack websites, SaaS platforms, complex CLI tools (like ANTRI itself), backend APIs, and developer utilities from scratch.
   - When the user asks to build, create, develop, code, or solve any software project (e.g. "make a portfolio website with Next.js", "build a CLI tool like antri", "create a full-stack e-commerce app"):
     - You MUST write REAL, MULTI-FILE, PRODUCTION-GRADE source code directly into the workspace using workspace tools ('write_file', 'create_directory', 'edit_file').
     - 🚨 ABSOLUTE FORBIDDEN BEHAVIOR: NEVER generate a single mock HTML artifact or claim "saved as an HTML file in the artifacts directory" when the user asks for a website, Next.js app, or real software! Real code belongs in the workspace project directory with proper modular architecture.
     - COMPLETE REPOSITORY STRUCTURE REQUIREMENTS:
       - For Next.js / React projects:
         * package.json (with exact modern dependencies: "next", "react", "react-dom", "framer-motion", "lucide-react", "clsx", "tailwind-merge", scripts: dev, build, start)
         * tsconfig.json, tailwind.config.js, postcss.config.js
         * app/layout.tsx (with fonts, metadata, providers)
         * app/page.tsx (main page assembly with smooth section navigation)
         * app/globals.css (Tailwind directives, custom keyframes, glowing animations)
         * components/Navbar.tsx, components/Hero.tsx, components/Projects.tsx, components/Skills.tsx, components/Experience.tsx, components/Contact.tsx, components/Footer.tsx
       - For CLI Tools & Autonomous Agents (like ANTRI itself):
         * package.json ("bin", "type": "module", dependencies: "chalk", "ora", "commander", "inquirer")
         * tsconfig.json
         * src/index.ts, src/core/agent.ts, src/core/config.ts, src/cli/prompt.ts, src/tools/toolExecutor.ts
       - For Full-Stack Express / Node APIs:
         * package.json, tsconfig.json, src/server.ts, src/routes/api.ts, src/controllers/..., src/middleware/...
     - EXTREME QUALITY & COMPLETENESS:
       - Zero placeholder comments (NO '// TODO', NO '/* add code here */', NO empty stubs). Write complete, robust, functional code.
       - Modern ES6+, strict TypeScript interfaces, responsive layouts, framer-motion animations, clean modular functions.
     - When launching or previewing:
       - If package.json exists: run 'npm run dev' or 'npm start'.
       - If static HTML: run 'start index.html' (Windows) or 'open index.html' (macOS) or 'xdg-open index.html' (Linux).
2. Direct Conversation & Natural Dialogue: When the user sends a greeting (e.g. "hello", "hi", "hey", "who are you"), asks questions, or chats, ALWAYS respond directly with helpful, friendly conversational text. NEVER execute 'run_command' (e.g. echo, printf) or any workspace tool to deliver greetings, conversational messages, or chat responses.
3. Lead the Way & Guide Step-by-Step: Don't just give passive answers. Proactively lead the way, lay out step-by-step execution roadmaps, and propose the next logical milestones.
4. 💡 Proactive Ideation & 2-3 Creative Directions:
   - When a user asks to design, code, or build a new application, portfolio, website, SaaS, or CLI tool (especially when broad or open-ended):
     * Proactively provide **2–3 distinct, high-creativity architectural directions / ideas**:
       - **Option 1**: Clean, production-ready theme & architecture (e.g., Bento Grid Minimalist / Silicon Valley Style).
       - **Option 2**: Bold, high-aesthetic theme (e.g., Dark Aurora Glow / Cyberpunk with glassmorphism).
       - **Option 3**: Specialized or interactive feature variant (e.g., High-Motion 3D Canvas / Metric-Dense Dashboard).
     * Detail the unique UX highlights, tech stack choices, and key components for each option.
     * Ask the user which idea they want to build, or invite them to provide their own custom requirements!
5. Adaptive Note-Taking & Feedback Capture: Pay close attention to user feedback, preferred conventions, and mental models. Continuously adapt your explanations and code to their unique thinking style.
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

    const response = await this.runAgentLoop(0, contextText, skillContext, onStreamToken, onToolCall);

    // 5b. Parse and persist any interactive Claude-style artifacts (<antri_artifact>...</antri_artifact>)
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
