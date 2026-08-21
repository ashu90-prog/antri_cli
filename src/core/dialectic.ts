import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { AntriConfig, ChatMessage, DebateDepth, DialecticResult, DialecticStage, ToolCall } from '../types.js';
import { createProvider } from '../providers/index.js';
import { AVAILABLE_TOOLS, ToolExecutor } from './tools.js';
import { TerminalRenderer } from '../cli/renderer.js';
import { CitationEngine } from './citations.js';

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
  public async debate(query: string, depth: DebateDepth = 'deep'): Promise<DialecticResult> {
    this.citationEngine.clear();
    const stages: DialecticStage[] = [];

    this.renderHeader(query, depth);

    // ==========================================
    // STAGE 1: The Proposer (Thesis)
    // ==========================================
    this.renderPersonaBanner('💡 The Proposer (Thesis)', '#34d399', 'Generating primary hypothesis and architectural solution...');
    const thesisPrompt = `You are The Proposer in a dialectic consensus engine.
User Query: "${query}"

Your task:
1. Provide a comprehensive, creative, and well-structured initial solution, code implementation, or hypothesis.
2. Outline key architectural decisions and assumptions.
3. Be clear, precise, and practical.`;

    const thesisContent = await this.runPersona('proposer', thesisPrompt, []);
    stages.push({
      persona: 'proposer',
      title: 'Initial Thesis & Solution',
      content: thesisContent,
    });

    // ==========================================
    // STAGE 2: The Adversary / Critic (Antithesis)
    // ==========================================
    this.renderPersonaBanner('⚔️ The Adversary / Critic (Antithesis)', '#f87171', 'Stress-testing thesis for vulnerabilities, flaws, and edge cases...');
    const antithesisPrompt = `You are The Adversary and Security/Logic Critic in a dialectic consensus engine.
User Query: "${query}"

Proposer's Thesis:
"""
${thesisContent}
"""

Your task:
1. Ruthlessly challenge the Proposer's assumptions and solution.
2. Hunt for edge cases, performance bottlenecks, concurrency/race conditions, security vulnerabilities, or API misuse.
3. Identify potential real-world failure points.
4. Be rigorous, objective, and constructive.`;

    const antithesisContent = await this.runPersona('adversary', antithesisPrompt, []);
    stages.push({
      persona: 'adversary',
      title: 'Critical Antithesis & Edge-Case Analysis',
      content: antithesisContent,
    });

    let verificationContent = '';
    let revisedThesisContent = '';

    // ==========================================
    // STAGE 3: The Researcher / Verifier (Deep & Rigorous)
    // ==========================================
    if (depth === 'deep' || depth === 'rigorous') {
      this.renderPersonaBanner('🔬 The Researcher / Verifier', '#38bdf8', 'Autonomously deploying Level 2 web & workspace tools to verify contested claims...');
      const researchPrompt = `You are The Researcher and Empirical Verifier.
User Query: "${query}"

Thesis:
"""
${thesisContent}
"""

Antithesis Criticisms:
"""
${antithesisContent}
"""

Your task:
1. Fact-check disputed claims between Thesis and Antithesis.
2. Use tools (web_search, scrape_url, run_command, read_file) if needed to verify documentation, library versions, or empirical behaviors.
3. Deliver a concise verification report summarizing what holds true and what is debunked.`;

      verificationContent = await this.runPersonaWithTools('researcher', researchPrompt);
      stages.push({
        persona: 'researcher',
        title: 'Empirical Fact-Check & Tool Verification',
        content: verificationContent,
      });
    }

    // ==========================================
    // STAGE 4 (Rigorous Only): Second Round Debate
    // ==========================================
    if (depth === 'rigorous') {
      this.renderPersonaBanner('💡 The Proposer (Refined Thesis - Round 2)', '#34d399', 'Refining solution against adversarial critiques and empirical data...');
      const round2ProposerPrompt = `You are The Proposer incorporating feedback.
User Query: "${query}"
Criticisms:
"""
${antithesisContent}
"""
Verification Results:
"""
${verificationContent}
"""

Your task:
Provide an updated, hardened revision of the solution addressing all valid points while defending key design choices.`;

      revisedThesisContent = await this.runPersona('proposer', round2ProposerPrompt, []);
      stages.push({
        persona: 'proposer',
        title: 'Hardened Revised Thesis',
        content: revisedThesisContent,
      });
    }

    // ==========================================
    // FINAL STAGE: The Judge / Synthesizer (Synthesis)
    // ==========================================
    this.renderPersonaBanner('⚖️ The Judge / Synthesizer (Final Consensus)', '#c084fc', 'Merging valid counterpoints, resolving contradictions, delivering final consensus...');
    const judgePrompt = `You are The Judge and Master Synthesizer.
User Query: "${query}"

1. Original Thesis:
"""
${thesisContent}
"""

2. Adversarial Critique:
"""
${antithesisContent}
"""

${verificationContent ? `3. Empirical Verification:\n"""\n${verificationContent}\n"""\n` : ''}
${revisedThesisContent ? `4. Revised Hardened Proposal:\n"""\n${revisedThesisContent}\n"""\n` : ''}

Your task:
1. Deliver the authoritative, battle-tested FINAL SOLUTION and consensus answer.
2. Clearly explain which criticisms were integrated, which were resolved, and why the final design is robust.
3. Provide production-ready, clean code and architecture.`;

    const synthesisContent = await this.runPersona('judge', judgePrompt, []);
    stages.push({
      persona: 'judge',
      title: 'Supreme Consensus & Battle-Tested Synthesis',
      content: synthesisContent,
    });

    this.renderConsensusFooter(stages, depth);

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

  /**
   * Runs an individual persona without tools
   */
  private async runPersona(persona: string, promptText: string, chatHistory: ChatMessage[]): Promise<string> {
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
  private async runPersonaWithTools(persona: string, promptText: string, depth = 0): Promise<string> {
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
      const thesisPrompt = `You are The Proposer in a dialectic consensus engine.
User Query: "${query}"

Your task:
1. Provide a comprehensive, creative, and well-structured initial solution, code implementation, or hypothesis.
2. Outline key architectural decisions and assumptions.
3. Be clear, precise, and practical.`;

      const thesisContent = await provider.sendMessageStream(
        [{ role: 'user', content: thesisPrompt }],
        [],
        { onToken: () => {} }
      );

      // 2. Adversary (Antithesis)
      const antithesisPrompt = `You are The Adversary and Security/Logic Critic in a dialectic consensus engine.
User Query: "${query}"

Proposer's Thesis:
"""
${thesisContent}
"""

Your task:
1. Challenge the Proposer's assumptions and solution.
2. Hunt for edge cases, performance bottlenecks, race conditions, security vulnerabilities, or API misuse.
3. Identify real-world failure points.`;

      const antithesisContent = await provider.sendMessageStream(
        [{ role: 'user', content: antithesisPrompt }],
        [],
        { onToken: () => {} }
      );

      // 3. Researcher Verification (if deep or rigorous)
      let verificationContent = '';
      if (depth === 'deep' || depth === 'rigorous') {
        const researchPrompt = `You are The Researcher and Empirical Verifier.
User Query: "${query}"

Thesis:
"""
${thesisContent}
"""

Antithesis Criticisms:
"""
${antithesisContent}
"""

Your task:
Fact-check disputed claims between Thesis and Antithesis. Summarize what holds true and what is debunked.`;

        verificationContent = await provider.sendMessageStream(
          [{ role: 'user', content: researchPrompt }],
          [],
          { onToken: () => {} }
        );
      }

      // 4. Judge / Final Synthesizer
      const judgePrompt = `You are The Judge and Master Synthesizer.
User Query: "${query}"

1. Original Thesis:
"""
${thesisContent}
"""

2. Adversarial Critique:
"""
${antithesisContent}
"""

${verificationContent ? `3. Empirical Verification:\n"""\n${verificationContent}\n"""\n` : ''}

Your task:
1. Deliver the authoritative, battle-tested FINAL SOLUTION and consensus answer.
2. Clearly explain which criticisms were integrated, which were resolved, and why the final design is robust.
3. Provide production-ready, clean code and architecture.
4. Emoji Usage Rule: Keep emojis tasteful and minimal — maximum 2 emojis in your entire response.`;

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

