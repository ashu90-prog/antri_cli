import fs from 'fs';
import path from 'path';
import os from 'os';
import { Episode } from './types.js';

function getCurrentUserId(): string {
  try {
    const authPath = path.join(os.homedir(), '.antri', 'auth.json');
    if (fs.existsSync(authPath)) {
      const raw = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
      const user = raw.user || raw;
      if (user && user.email && typeof user.email === 'string') {
        const clean = user.email.toLowerCase().trim();
        return user.userId || clean.replace(/[^a-z0-9_]/g, '_');
      }
    }
  } catch (_) {}
  return 'default_user';
}

export class EpisodicMemory {
  private customDir?: string;
  private currentUserId: string = 'default_user';
  private episodes: Episode[] = [];

  constructor(customDir?: string) {
    this.customDir = customDir;
    this.currentUserId = customDir ? 'custom' : getCurrentUserId();
    this.ensureDirectory();
    this.load();
  }

  public switchUser(userId?: string): void {
    this.currentUserId = userId || getCurrentUserId();
    this.ensureDirectory();
    this.load();
  }

  public getMemoryDir(): string {
    if (this.customDir) return this.customDir;
    const uid = this.currentUserId || getCurrentUserId();
    const dir = path.join(os.homedir(), '.antri', 'partitions', uid, 'memory');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public getEpisodicFile(): string {
    return path.join(this.getMemoryDir(), 'episodic_store.json');
  }

  private ensureDirectory(): void {
    const dir = this.getMemoryDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private load(): void {
    try {
      const file = this.getEpisodicFile();
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        this.episodes = JSON.parse(raw);
      } else {
        this.episodes = [];
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
      fs.writeFileSync(this.getEpisodicFile(), JSON.stringify(this.episodes, null, 2), 'utf-8');
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
