import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { AntriConfig, ChatMessage, DebateDepth, DialecticResult, DialecticStage, ToolCall } from '../types.js';
import { createProvider } from '../providers/index.js';
import { AVAILABLE_TOOLS, ToolExecutor } from './tools.js';
import { TerminalRenderer } from '../cli/renderer.js';
import { CitationEngine } from './citations.js';

export interface DialecticCallbacks {
  onStatus?: (status: { stage: string; message: string; persona: string }) => void;
  onStage?: (stage: DialecticStage) => void;
  onToken?: (persona: string, token: string) => void;
}

export class DialecticEngine {
  private config: AntriConfig;
  private toolExecutor: ToolExecutor;
  private citationEngine: CitationEngine;

  constructor(config: AntriConfig) {
    this.config = config;
    this.toolExecutor = new ToolExecutor(config.workingDir);
    this.citationEngine = new CitationEngine();
  }

  /**
   * Executes the full Dialectic Reasoning Pipeline with visual rendering
   */
  public async debate(query: string, depth: DebateDepth = 'deep', callbacks?: DialecticCallbacks): Promise<DialecticResult> {
    this.citationEngine.clear();
    const stages: DialecticStage[] = [];

    this.renderHeader(query, depth);

    // ==========================================
    // STAGE 1: The Proposer (Thesis)
    // ==========================================
    this.renderPersonaBanner('💡 The Proposer (Thesis)', '#34d399', 'Generating primary hypothesis and strategic argument...');
    callbacks?.onStatus?.({ stage: 'proposer', message: 'Generating primary hypothesis and strategic argument...', persona: 'proposer' });

    const thesisPrompt = `You are The Proposer & Chief Strategist in a multi-perspective dialectic consensus engine.
User Query / Debate Topic: "${query}"

Your task:
1. Provide a comprehensive, authoritative, and fact-grounded initial case, architectural proposal, or comparative hypothesis.
2. Clearly articulate key strengths, distinct advantages (pros), and strategic value.
3. Use real domain data, accurate metrics, structural principles, and empirical facts.
4. Do NOT write toy boilerplate script files unless explicitly requested to write software. Focus deeply on domain substance, comparison factors, and mechanics.`;

    const thesisContent = await this.runPersona('proposer', thesisPrompt, [], (token) => {
      callbacks?.onToken?.('proposer', token);
    });
    const thesisStage: DialecticStage = {
      persona: 'proposer',
      title: 'Initial Thesis & Solution',
      content: thesisContent,
    };
    stages.push(thesisStage);
    callbacks?.onStage?.(thesisStage);

    // ==========================================
    // STAGE 2: The Adversary / Critic (Antithesis)
    // ==========================================
    this.renderPersonaBanner('⚔️ The Adversary / Critic (Antithesis)', '#f87171', 'Stress-testing thesis for vulnerabilities, flaws, and trade-offs...');
    callbacks?.onStatus?.({ stage: 'adversary', message: 'Stress-testing thesis for vulnerabilities, flaws, and trade-offs...', persona: 'adversary' });

    const antithesisPrompt = `You are The Adversary, Chief Security/Economics Critic, and Logic Inquisitor in a dialectic consensus engine.
User Query / Debate Topic: "${query}"

Proposer's Thesis:
"""
${thesisContent}
"""

Your task:
1. Ruthlessly challenge the Proposer's assumptions, blind spots, and proposed direction.
2. Detail critical vulnerabilities, disadvantages (cons), operational bottlenecks, scalability failure points, hidden costs, or superior alternative paradigms.
3. Ground your critique in hard realities, real-world case studies, counter-metrics, and edge cases.
4. Be rigorous, objective, and analytically sharp.`;

    const antithesisContent = await this.runPersona('adversary', antithesisPrompt, [], (token) => {
      callbacks?.onToken?.('adversary', token);
    });
    const antithesisStage: DialecticStage = {
      persona: 'adversary',
      title: 'Critical Antithesis & Edge-Case Analysis',
      content: antithesisContent,
    };
    stages.push(antithesisStage);
    callbacks?.onStage?.(antithesisStage);

    let verificationContent = '';
    let revisedThesisContent = '';

    // ==========================================
    // STAGE 3: The Researcher / Verifier (Deep & Rigorous)
    // ==========================================
    if (depth === 'deep' || depth === 'rigorous') {
      this.renderPersonaBanner('🔬 The Researcher / Verifier', '#38bdf8', 'Autonomously deploying Level 2 web & workspace tools to verify contested claims...');
      callbacks?.onStatus?.({ stage: 'researcher', message: 'Autonomously deploying Level 2 web & workspace tools to verify contested claims...', persona: 'researcher' });

      const researchPrompt = `You are The Researcher and Empirical Verifier.
User Query / Debate Topic: "${query}"

Thesis:
"""
${thesisContent}
"""

Antithesis Criticisms:
"""
${antithesisContent}
"""

Your task:
1. Fact-check disputed claims between Thesis and Antithesis using empirical data and verifiable benchmarks.
2. Use tools (web_search, scrape_url, run_command, read_file) if needed to verify documentation, library versions, or empirical behaviors.
3. Deliver a concise verification report summarizing what holds true and what is debunked with concrete facts.`;

      verificationContent = await this.runPersonaWithTools('researcher', researchPrompt, 0, (token) => {
        callbacks?.onToken?.('researcher', token);
      });
      const verifierStage: DialecticStage = {
        persona: 'researcher',
        title: 'Empirical Fact-Check & Tool Verification',
        content: verificationContent,
      };
      stages.push(verifierStage);
      callbacks?.onStage?.(verifierStage);
    }

    // ==========================================
    // STAGE 4 (Rigorous Only): Second Round Debate
    // ==========================================
    if (depth === 'rigorous') {
      this.renderPersonaBanner('💡 The Proposer (Refined Thesis - Round 2)', '#34d399', 'Refining solution against adversarial critiques and empirical data...');
      callbacks?.onStatus?.({ stage: 'proposer_round2', message: 'Refining solution against adversarial critiques and empirical data...', persona: 'proposer' });

      const round2ProposerPrompt = `You are The Proposer incorporating feedback.
User Query / Debate Topic: "${query}"
Criticisms:
"""
${antithesisContent}
"""
Verification Results:
"""
${verificationContent}
"""

Your task:
Provide an updated, hardened revision of the argument addressing all valid points while defending key strengths.`;

      revisedThesisContent = await this.runPersona('proposer', round2ProposerPrompt, [], (token) => {
        callbacks?.onToken?.('proposer', token);
      });
      const revisedStage: DialecticStage = {
        persona: 'proposer',
        title: 'Hardened Revised Thesis',
        content: revisedThesisContent,
      };
      stages.push(revisedStage);
      callbacks?.onStage?.(revisedStage);
    }

    // ==========================================
    // FINAL STAGE: The Judge / Synthesizer (Synthesis)
    // ==========================================
    this.renderPersonaBanner('⚖️ The Judge / Synthesizer (Final Consensus)', '#c084fc', 'Merging valid counterpoints, resolving contradictions, delivering final consensus...');
    callbacks?.onStatus?.({ stage: 'judge', message: 'Merging valid counterpoints, resolving contradictions, delivering final consensus...', persona: 'judge' });

    const judgePrompt = `You are The Supreme Judge and Master Synthesizer in a dialectic consensus engine.
User Query / Debate Topic: "${query}"

1. Thesis (Primary Argument & Strengths):
"""
${thesisContent}
"""

2. Antithesis (Adversarial Critique & Disadvantages):
"""
${antithesisContent}
"""

${verificationContent ? `3. Empirical Verification:\n"""\n${verificationContent}\n"""\n` : ''}
${revisedThesisContent ? `4. Revised Hardened Proposal:\n"""\n${revisedThesisContent}\n"""\n` : ''}

Your task:
Deliver the definitive, high-impact, battle-tested EXECUTIVE CONSENSUS and comparative synthesis.
Structure your response into clear, comprehensive markdown sections:
1. 🏆 **Executive Verdict & Core Takeaways**: Definitive summary and overarching outcome of the analysis.
2. 📊 **Side-by-Side Factor Comparison Matrix**: Comparative markdown table evaluating key dimensions (e.g. Performance, Scalability, Cost / Economic Output, Reliability, Labor / Talent, Maturity, Trade-offs).
3. ⚡ **Core Strengths & Advantages (Pros)**: Deep domain breakdown of where each side excels.
4. ⚠️ **Critical Vulnerabilities & Limitations (Cons)**: Objective analysis of drawbacks, bottlenecks, failure modes, and trade-offs.
5. 🔬 **Empirical Reality & Real-World Precedents**: Verified metrics, official statistics, benchmark figures, or industry case studies.
6. 🎯 **Strategic Decision Framework**: Clear, actionable heuristics for when to choose or invest in each path.

CRITICAL INSTRUCTIONS:
- Do NOT output generic boilerplate code (such as mock pandas/sklearn toy models) unless explicitly requested to write software. Provide deep, authentic, substantive domain intelligence.
- Keep emojis tasteful and minimal — maximum 2 emojis in your entire response.`;

    const synthesisContent = await this.runPersona('judge', judgePrompt, [], (token) => {
      callbacks?.onToken?.('judge', token);
    });
    const judgeStage: DialecticStage = {
      persona: 'judge',
      title: 'Supreme Consensus & Battle-Tested Synthesis',
      content: synthesisContent,
    };
    stages.push(judgeStage);
    callbacks?.onStage?.(judgeStage);

    this.renderConsensusFooter(stages, depth);

    // Persist into sessionManager and artifactManager so Desktop UI displays it
    try {
      const { sessionManager } = await import('./sessionManager.js');
      const { artifactManager } = await import('./artifactManager.js');
      const activeSession = sessionManager.getActiveSession();
      const sessionId = activeSession?.id || 'cli_session';
      const sessionTitle = activeSession?.title || 'CLI Session';

      const fullDebateReport = `### 🧠 Dialectic Self-Debate: "${query}" (Depth: ${depth.toUpperCase()})

#### 💡 1. The Proposer (Thesis)
${thesisContent}

#### ⚔️ 2. The Adversary (Antithesis)
${antithesisContent}

${verificationContent ? `#### 🔬 3. Empirical Verification\n${verificationContent}\n\n` : ''}
${revisedThesisContent ? `#### 🛡️ 4. Revised Proposal\n${revisedThesisContent}\n\n` : ''}
#### ⚖️ 5. Supreme Consensus & Synthesis
${synthesisContent}`;

      sessionManager.addMessageToActiveSession({
        role: 'user',
        content: `/debate ${query}`,
      });
      sessionManager.addMessageToActiveSession({
        role: 'assistant',
        content: fullDebateReport,
      });

      const artifactId = 'debate_' + Date.now().toString(36);
      const htmlContent = this.generateInteractiveDebateHtml(query, depth, stages);
      artifactManager.saveArtifact({
        id: artifactId,
        sessionId,
        sessionTitle,
        title: `Debate: ${query.slice(0, 40)}`,
        type: 'html',
        content: htmlContent,
        createdAt: Date.now(),
      });
    } catch (_) {}

    return {
      query,
      depth,
      thesis: thesisContent,
      antithesis: antithesisContent,
      verification: verificationContent || undefined,
      synthesis: synthesisContent,
      stages,
      sources: this.citationEngine.getSources().map((s) => s.url),
    };
  }

  public generateInteractiveDebateHtml(query: string, depth: string, stages: DialecticStage[]): string {
    const thesis = stages.find(s => s.persona === 'proposer')?.content || '';
    const adversary = stages.find(s => s.persona === 'adversary')?.content || '';
    const judge = stages.find(s => s.persona === 'judge')?.content || '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dialectic Arena: ${query.replace(/"/g, '&quot;')}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0f172a; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; }
    .glass { background: rgba(30, 41, 59, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }
  </style>
</head>
<body class="p-6 md:p-10 max-w-6xl mx-auto">
  <header class="mb-8 border-b border-slate-800 pb-6">
    <div class="inline-block px-3 py-1 bg-purple-950 text-purple-300 rounded-full text-xs font-bold tracking-wide uppercase mb-2">
      🧠 ANTRI Dialectic Multi-Persona Arena · Depth: ${depth.toUpperCase()}
    </div>
    <h1 class="text-2xl md:text-3xl font-extrabold text-white">${query.replace(/</g, '&lt;')}</h1>
  </header>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
    <!-- Thesis -->
    <div class="glass p-6 rounded-xl border-l-4 border-emerald-400">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-xl">💡</span>
        <h2 class="text-lg font-bold text-emerald-400">The Proposer (Thesis)</h2>
      </div>
      <div class="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">${thesis.replace(/</g, '&lt;')}</div>
    </div>

    <!-- Antithesis -->
    <div class="glass p-6 rounded-xl border-l-4 border-rose-400">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-xl">⚔️</span>
        <h2 class="text-lg font-bold text-rose-400">The Adversary (Antithesis)</h2>
      </div>
      <div class="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">${adversary.replace(/</g, '&lt;')}</div>
    </div>
  </div>

  <!-- Synthesis -->
  <div class="glass p-8 rounded-xl border-l-4 border-purple-500 bg-slate-900/90 shadow-2xl">
    <div class="flex items-center gap-2 mb-4">
      <span class="text-2xl">⚖️</span>
      <h2 class="text-xl font-bold text-purple-300">Supreme Consensus & Battle-Tested Synthesis</h2>
    </div>
    <div class="text-slate-200 text-sm md:text-base leading-relaxed whitespace-pre-wrap">${judge.replace(/</g, '&lt;')}</div>
  </div>
</body>
</html>`;
  }

  /**
   * Runs an individual persona without tools
   */
  private async runPersona(persona: string, promptText: string, chatHistory: ChatMessage[], onToken?: (token: string) => void): Promise<string> {
    const provider = createProvider(this.config);
    const messages: ChatMessage[] = [
      ...chatHistory,
      { role: 'user', content: promptText },
    ];

    let spinner: Ora | null = ora({
      text: chalk.hex('#94a3b8')(`Persona [${persona}] generating thoughts...`),
      spinner: 'dots',
      color: 'magenta',
    }).start();

    let hasStreamed = false;
    let fullOutput = '';

    try {
      fullOutput = await provider.sendMessageStream(messages, [], {
        onToken: (token: string) => {
          if (spinner) {
            spinner.stop();
            spinner = null;
          }
          if (!hasStreamed) {
            hasStreamed = true;
          }
          TerminalRenderer.printToken(token);
          if (onToken) onToken(token);
        },
      });

      if (spinner) spinner.stop();
      if (hasStreamed) {
        console.log();
        console.log();
      }
      return fullOutput;
    } catch (err: any) {
      if (spinner) spinner.stop();
      console.log(chalk.red(`\nPersona execution error: ${err.message}`));
      return `[Error in ${persona}: ${err.message}]`;
    }
  }

  /**
   * Runs the Researcher persona with full autonomous tool calling
   */
  private async runPersonaWithTools(persona: string, promptText: string, depth = 0, onToken?: (token: string) => void): Promise<string> {
    if (depth > 4) return '';
    const provider = createProvider(this.config);
    const messages: ChatMessage[] = [{ role: 'user', content: promptText }];

    let spinner: Ora | null = ora({
      text: chalk.hex('#38bdf8')('Researcher investigating with live tools...'),
      spinner: 'dots',
      color: 'blue',
    }).start();

    const pendingToolCalls: ToolCall[] = [];
    let hasStreamed = false;
    let fullOutput = '';

    try {
      fullOutput = await provider.sendMessageStream(messages, AVAILABLE_TOOLS, {
        onToken: (token: string) => {
          if (spinner) {
            spinner.stop();
            spinner = null;
          }
          if (!hasStreamed) {
            hasStreamed = true;
          }
          TerminalRenderer.printToken(token);
          if (onToken) onToken(token);
        },
        onToolCall: (tc: ToolCall) => {
          if (spinner) {
            spinner.stop();
            spinner = null;
          }
          pendingToolCalls.push(tc);
        },
      });

      if (spinner) spinner.stop();
      if (hasStreamed) {
        console.log();
        console.log();
      }

      if (pendingToolCalls.length > 0) {
        for (const tc of pendingToolCalls) {
          let parsedArgs: any = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch {
            parsedArgs = {};
          }

          const result = await this.toolExecutor.execute(tc.function.name, parsedArgs, tc.id);
          TerminalRenderer.printToolCompact(tc, result);

          if (tc.function.name === 'web_search' && parsedArgs.query) {
            this.citationEngine.addSource(`Debate Verification: ${parsedArgs.query}`, `https://duckduckgo.com/?q=${encodeURIComponent(parsedArgs.query)}`, undefined, 'DuckDuckGo');
          }
        }
      }

      return fullOutput;
    } catch (err: any) {
      if (spinner) spinner.stop();
      return `[Researcher error: ${err.message}]`;
    }
  }

  // Visual formatting utilities
  private renderHeader(query: string, depth: DebateDepth): void {
    const divider = chalk.hex('#475569')('━'.repeat(Math.min(process.stdout.columns || 80, 80)));
    console.log();
    console.log(divider);
    console.log(
      chalk.bold.hex('#c084fc')(' 🧠 DIALECTIC ENGINE ') +
      chalk.hex('#94a3b8')('· Multi-Persona Self-Debate & Consensus')
    );
    console.log(chalk.hex('#64748b')(` Depth: `) + chalk.bold.cyan(depth.toUpperCase()) + chalk.hex('#64748b')(` · Topic: "${query}"`));
    console.log(divider);
    console.log();
  }

  private renderPersonaBanner(personaTitle: string, hexColor: string, subtitle: string): void {
    const badge = chalk.bgHex(hexColor).bold.black(` ${personaTitle} `);
    console.log(badge + ' ' + chalk.hex('#94a3b8')(subtitle));
    console.log(chalk.hex('#334155')('─'.repeat(Math.min(process.stdout.columns || 80, 80))));
  }

  private renderConsensusFooter(stages: DialecticStage[], depth: DebateDepth): void {
    const divider = chalk.hex('#475569')('━'.repeat(Math.min(process.stdout.columns || 80, 80)));
    console.log(divider);
    console.log(chalk.bold.hex('#4ade80')(' ✔ DIALECTIC CONSENSUS REACHED'));
    console.log(chalk.hex('#94a3b8')(` Stages Completed: ${stages.length} · Protocol: ${depth.toUpperCase()}`));

    const citations = this.citationEngine.generateBibliography();
    if (citations) {
      console.log(citations);
    }
    console.log(divider);
    console.log();
  }

  /**
   * Executes the Dialectic Reasoning Pipeline silently in the background
   * and returns only the final battle-tested consensus with the synthesized header.
   */
  public async silentDebate(query: string, depth: DebateDepth = 'deep'): Promise<string> {
    this.citationEngine.clear();
    const provider = createProvider(this.config);

    let spinner: Ora | null = null;
    if (process.stdout.isTTY) {
      spinner = ora({
        text: chalk.hex('#c084fc')('⚔️ Conducting background dialectic consensus debate...'),
        spinner: 'dots',
        color: 'magenta',
      }).start();
    }

    try {
      // 1. Proposer (Thesis)
      const thesisPrompt = `You are The Proposer & Chief Strategist in a multi-perspective dialectic consensus engine.
User Query / Debate Topic: "${query}"

Your task:
1. Provide a comprehensive, authoritative, and fact-grounded initial case, architectural proposal, or comparative hypothesis.
2. Clearly articulate key strengths, distinct advantages (pros), and strategic value.
3. Use real domain data, accurate metrics, structural principles, and empirical facts.
4. Do NOT write toy boilerplate script files (e.g. mock pandas/sklearn LinearRegression) unless the user explicitly requested code. Focus deeply on domain substance, comparison factors, and mechanics.`;

      const thesisContent = await provider.sendMessageStream(
        [{ role: 'user', content: thesisPrompt }],
        [],
        { onToken: () => {} }
      );

      // 2. Adversary (Antithesis)
      const antithesisPrompt = `You are The Adversary, Chief Security/Economics Critic, and Logic Inquisitor in a dialectic consensus engine.
User Query / Debate Topic: "${query}"

Proposer's Thesis:
"""
${thesisContent}
"""

Your task:
1. Ruthlessly challenge the Proposer's assumptions, blind spots, and proposed direction.
2. Detail critical vulnerabilities, disadvantages (cons), operational bottlenecks, scalability failure points, hidden costs, or superior alternative paradigms.
3. Ground your critique in hard realities, real-world case studies, counter-metrics, and edge cases.
4. Be rigorous, objective, and analytically sharp.`;

      const antithesisContent = await provider.sendMessageStream(
        [{ role: 'user', content: antithesisPrompt }],
        [],
        { onToken: () => {} }
      );

      // 3. Researcher Verification (if deep or rigorous)
      let verificationContent = '';
      if (depth === 'deep' || depth === 'rigorous') {
        const researchPrompt = `You are The Researcher and Empirical Verifier.
User Query / Debate Topic: "${query}"

Thesis:
"""
${thesisContent}
"""

Antithesis Criticisms:
"""
${antithesisContent}
"""

Your task:
1. Fact-check disputed claims between Thesis and Antithesis using empirical data and verifiable benchmarks.
2. Determine which claims are objectively true, which are exaggerated, and which are context-dependent.
3. Summarize the validated empirical reality clearly with concrete numbers and facts.`;

        verificationContent = await provider.sendMessageStream(
          [{ role: 'user', content: researchPrompt }],
          [],
          { onToken: () => {} }
        );
      }

      // 4. Judge / Final Synthesizer
      const judgePrompt = `You are The Supreme Judge and Master Synthesizer in a dialectic consensus engine.
User Query / Debate Topic: "${query}"

1. Thesis (Primary Argument & Strengths):
"""
${thesisContent}
"""

2. Antithesis (Adversarial Critique & Disadvantages):
"""
${antithesisContent}
"""

${verificationContent ? `3. Empirical Verification:\n"""\n${verificationContent}\n"""\n` : ''}

Your task:
Deliver the definitive, high-impact, battle-tested EXECUTIVE CONSENSUS and comparative synthesis.
Structure your response into clear, comprehensive markdown sections:
1. 🏆 **Executive Verdict & Core Takeaways**: Definitive summary and overarching outcome of the analysis.
2. 📊 **Side-by-Side Factor Comparison Matrix**: Comparative markdown table evaluating key dimensions (e.g. Performance, Scalability, Cost / Economic Output, Reliability, Labor / Talent, Maturity, Trade-offs).
3. ⚡ **Core Strengths & Advantages (Pros)**: Deep domain breakdown of where each side excels.
4. ⚠️ **Critical Vulnerabilities & Limitations (Cons)**: Objective analysis of drawbacks, bottlenecks, failure modes, and trade-offs.
5. 🔬 **Empirical Reality & Real-World Precedents**: Verified metrics, official statistics, benchmark figures, or industry case studies.
6. 🎯 **Strategic Decision Framework**: Clear, actionable heuristics for when to choose or invest in each path.

CRITICAL INSTRUCTIONS:
- Do NOT output generic boilerplate code (such as mock pandas/sklearn toy models) unless explicitly requested to write software. Provide deep, authentic, substantive domain intelligence.
- Keep emojis tasteful and minimal — maximum 2 emojis in your entire response.`;

      const finalSynthesis = await provider.sendMessageStream(
        [{ role: 'user', content: judgePrompt }],
        [],
        { onToken: () => {} }
      );

      if (spinner) spinner.stop();

      return `> ⚔️ [Dialectic Debate Synthesized]\n\n${finalSynthesis.trim()}`;
    } catch (err: any) {
      if (spinner) spinner.stop();
      return `> ⚔️ [Dialectic Debate Synthesized]\n\n[Background Debate Fallback: ${err.message}]`;
    }
  }
}
