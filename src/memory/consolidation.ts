import { EpisodicMemory } from './episodic.js';
import { SemanticMemory } from './semantic.js';
import { ProfileMemory } from './profile.js';

export class MemoryConsolidator {
  private episodic: EpisodicMemory;
  private semantic: SemanticMemory;
  private profile: ProfileMemory;

  constructor(episodic: EpisodicMemory, semantic: SemanticMemory, profile: ProfileMemory) {
    this.episodic = episodic;
    this.semantic = semantic;
    this.profile = profile;
  }

  /**
   * Consolidates recent episodes into semantic memory and updates profile knowledge
   */
  public async consolidate(workingDir: string, geminiApiKey?: string): Promise<{ newLessons: number; summary: string }> {
    const recent = this.episodic.getRecent(5);
    if (recent.length === 0) {
      return { newLessons: 0, summary: 'No new episodes to consolidate.' };
    }

    let lessonsCount = 0;

    for (const ep of recent) {
      const q = ep.query.trim();
      const r = ep.response.trim();

      // Check if episode contains high-value actionable insight or solved bug
      const isCodeFix = q.toLowerCase().includes('fix') || q.toLowerCase().includes('error') || q.toLowerCase().includes('bug');
      const isArchitecture = q.toLowerCase().includes('how') || q.toLowerCase().includes('architecture') || q.toLowerCase().includes('pattern');
      const isDebate = ep.debateStages && ep.debateStages.length > 0;

      if (isCodeFix || isArchitecture || isDebate) {
        const category = isCodeFix ? 'problem_solution' : isDebate ? 'architecture_insight' : 'lesson_learned';
        const summaryText = `[Context: ${q.slice(0, 120)}...] Solution/Insight: ${r.slice(0, 250)}...`;

        await this.semantic.store(
          summaryText,
          category,
          { sourceQuery: q, workspace: workingDir, tags: ep.tags },
          geminiApiKey
        );
        lessonsCount++;
      }
    }

    const prof = this.profile.getProfile();
    prof.lastConsolidatedAt = Date.now();
    this.profile.save();

    return {
      newLessons: lessonsCount,
      summary: `Consolidated ${recent.length} recent episodes into ${lessonsCount} semantic knowledge units.`,
    };
  }
}
