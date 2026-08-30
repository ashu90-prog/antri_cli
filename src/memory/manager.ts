import chalk from 'chalk';
import { EpisodicMemory } from './episodic.js';
import { SemanticMemory } from './semantic.js';
import { ProfileMemory } from './profile.js';
import { MemoryConsolidator } from './consolidation.js';
import { RecalledContext, SemanticVectorItem } from './types.js';

export class MemoryManager {
  private episodic: EpisodicMemory;
  private semantic: SemanticMemory;
  private profile: ProfileMemory;
  private consolidator: MemoryConsolidator;

  constructor() {
    this.episodic = new EpisodicMemory();
    this.semantic = new SemanticMemory();
    this.profile = new ProfileMemory();
    this.consolidator = new MemoryConsolidator(this.episodic, this.semantic, this.profile);
  }

  public switchUser(userId?: string): void {
    this.episodic.switchUser(userId);
    this.semantic.switchUser(userId);
    this.profile.switchUser(userId);
  }

  /**
   * Autonomous Self-Recall: Queries across Episodic, Semantic, and Profile memory
   */
  public async selfRecall(
    userPrompt: string,
    workingDir: string,
    geminiApiKey?: string
  ): Promise<{ contextText: string; recalled: RecalledContext }> {
    // 1. Semantic Vector Search
    const semanticMatches = await this.semantic.search(userPrompt, 2, 0.28, geminiApiKey);
    const semanticInsights: SemanticVectorItem[] = semanticMatches.map((m) => m.item);

    // 2. Episodic Search
    const episodes = this.episodic.search(userPrompt, 2);

    // 3. Workspace Conventions & Profile Rules
    const workspaceConventions = this.profile.getWorkspaceConventions(workingDir);
    const userPreferences = this.profile.getProfile().customRules;

    const hasMemories =
      semanticInsights.length > 0 ||
      episodes.length > 0 ||
      workspaceConventions.length > 0 ||
      userPreferences.length > 0;

    let contextText = '';

    if (hasMemories) {
      contextText += '\n[🧠 Recalled Memory & Knowledge Base Context]:\n';

      if (userPreferences.length > 0) {
        contextText += '• User Preferences & Personal Identity (Permanent Memory):\n';
        userPreferences.forEach((p) => (contextText += `  - ${p}\n`));
      }

      if (workspaceConventions.length > 0) {
        contextText += '• Established Project Conventions:\n';
        workspaceConventions.forEach((c) => (contextText += `  - ${c}\n`));
      }

      if (semanticInsights.length > 0) {
        contextText += '• Relevant Past Solutions & Insights (Semantic Memory):\n';
        semanticInsights.forEach((s) => (contextText += `  - [${s.category}] ${s.text}\n`));
      }

      if (episodes.length > 0) {
        contextText += '• Related Past Interaction (Episodic Memory):\n';
        episodes.forEach((ep) => (contextText += `  - Query: "${ep.query}" -> Solved: ${ep.response.slice(0, 150)}...\n`));
      }
    }

    return {
      contextText,
      recalled: {
        episodes,
        semanticInsights,
        workspaceConventions,
        userPreferences,
        hasMemories,
      },
    };
  }

  public recordInteraction(
    query: string,
    response: string,
    toolsUsed: string[] = [],
    debateStages?: string[]
  ): void {
    this.episodic.record(query, response, toolsUsed, debateStages);
    this.profile.incrementQuery();
  }

  public async consolidate(workingDir: string, geminiApiKey?: string): Promise<{ newLessons: number; summary: string }> {
    return await this.consolidator.consolidate(workingDir, geminiApiKey);
  }

  public async learn(text: string, category: SemanticVectorItem['category'] = 'lesson_learned', workingDir?: string): Promise<void> {
    await this.semantic.store(text, category, { workspace: workingDir });
    if (workingDir) {
      this.profile.recordWorkspaceConvention(workingDir, text);
    }
  }

  public getMemoryDetails(workingDir: string): { episodicCount: number; semanticCount: number; conventionsCount: number; semanticItems: SemanticVectorItem[]; episodes: any[] } {
    return {
      episodicCount: this.episodic.count(),
      semanticCount: this.semantic.count(),
      conventionsCount: this.profile.getWorkspaceConventions(workingDir).length,
      semanticItems: this.semantic.getAll(),
      episodes: this.episodic.getAll(),
    };
  }

  public renderMemoryStatus(workingDir: string): void {
    const prof = this.profile.getProfile();
    const conventions = this.profile.getWorkspaceConventions(workingDir);

    console.log(chalk.bold.hex('#c084fc')('\n🧠 Persistent Memory & Knowledge Base'));
    console.log(chalk.hex('#334155')('─'.repeat(72)));
    console.log(`• ${chalk.bold('Episodic Memory (Logs):')}       ${chalk.cyan(this.episodic.count())} session episodes`);
    console.log(`• ${chalk.bold('Semantic Memory (Vectors):')}    ${chalk.cyan(this.semantic.count())} indexed knowledge items`);
    console.log(`• ${chalk.bold('Workspace Conventions:')}        ${chalk.cyan(conventions.length)} rules in ${chalk.gray('.antri/conventions.md')}`);
    console.log(`• ${chalk.bold('Profile Queries Processed:')}    ${chalk.cyan(prof.totalQueries)}`);
    console.log(`• ${chalk.bold('Preferred Stack:')}              ${chalk.cyan(prof.preferredLanguage || 'TypeScript')} (${prof.codeStyle?.typingStrictness || 'strict'})`);

    if (conventions.length > 0) {
      console.log(chalk.bold.hex('#a5b4fc')('\n📜 Project Conventions:'));
      conventions.forEach((c) => console.log(`  - ${chalk.hex('#94a3b8')(c)}`));
    }

    const recentNuggets = this.semantic.getAll().slice(-3);
    if (recentNuggets.length > 0) {
      console.log(chalk.bold.hex('#a5b4fc')('\n💡 Recent Semantic Knowledge Nuggets:'));
      recentNuggets.forEach((n) => console.log(`  - ${chalk.hex('#64748b')(`[${n.category}]`)} ${chalk.hex('#94a3b8')(n.text.slice(0, 100))}...`));
    }

    console.log(chalk.hex('#334155')('─'.repeat(72)));
    console.log();
  }
}

export const memoryManager = new MemoryManager();
