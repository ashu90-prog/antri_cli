import fs from 'fs';
import path from 'path';
import os from 'os';
import { Episode } from './types.js';

const MEMORY_DIR = path.join(os.homedir(), '.antri', 'memory');
const EPISODIC_FILE = path.join(MEMORY_DIR, 'episodic_store.json');

export class EpisodicMemory {
  private episodes: Episode[] = [];

  constructor() {
    this.ensureDirectory();
    this.load();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(EPISODIC_FILE)) {
        const raw = fs.readFileSync(EPISODIC_FILE, 'utf-8');
        this.episodes = JSON.parse(raw);
      }
    } catch {
      this.episodes = [];
    }
  }

  private save(): void {
    try {
      this.ensureDirectory();
      // Keep last 1000 episodes to balance storage and speed
      if (this.episodes.length > 1000) {
        this.episodes = this.episodes.slice(-1000);
      }
      fs.writeFileSync(EPISODIC_FILE, JSON.stringify(this.episodes, null, 2), 'utf-8');
    } catch {}
  }

  public record(
    query: string,
    response: string,
    toolsUsed: string[] = [],
    debateStages?: string[],
    sessionId = 'session'
  ): Episode {
    const episode: Episode = {
      id: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      sessionId,
      query,
      response,
      toolsUsed,
      debateStages,
      tags: this.extractTags(query + ' ' + response),
    };

    this.episodes.push(episode);
    this.save();
    return episode;
  }

  public getAll(): Episode[] {
    return this.episodes;
  }

  public getRecent(limit = 5): Episode[] {
    return this.episodes.slice(-limit);
  }

  public search(query: string, limit = 5): Episode[] {
    const qLower = query.toLowerCase();
    const tokens = qLower.split(/\s+/).filter((t) => t.length > 2);

    const scored = this.episodes.map((ep) => {
      let score = 0;
      const text = (ep.query + ' ' + ep.response).toLowerCase();
      for (const t of tokens) {
        if (text.includes(t)) score += 1;
      }
      return { ep, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || b.ep.timestamp - a.ep.timestamp)
      .slice(0, limit)
      .map((s) => s.ep);
  }

  public count(): number {
    return this.episodes.length;
  }

  public clear(): void {
    this.episodes = [];
    this.save();
  }

  private extractTags(text: string): string[] {
    const tags: Set<string> = new Set();
    const keywords = [
      'typescript', 'javascript', 'python', 'react', 'next.js', 'docker',
      'git', 'sql', 'database', 'auth', 'api', 'performance', 'security',
      'refactor', 'test', 'bug', 'architecture', 'css', 'html', 'node.js'
    ];
    const lower = text.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw)) tags.add(kw);
    }
    return Array.from(tags);
  }
}
