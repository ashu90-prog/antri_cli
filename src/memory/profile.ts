import fs from 'fs';
import path from 'path';
import os from 'os';
import { UserProfileMemory } from './types.js';

const MEMORY_DIR = path.join(os.homedir(), '.antri', 'memory');
const PROFILE_FILE = path.join(MEMORY_DIR, 'profile.json');

const DEFAULT_PROFILE: UserProfileMemory = {
  preferredLanguage: 'TypeScript',
  codeStyle: {
    indentation: '2 spaces',
    typingStrictness: 'strict',
    testFramework: 'node:test',
  },
  customRules: [
    'Always use functional clean architecture with explicit TypeScript types.',
    'Write self-documenting code with informative comments.',
    'Keep CLI responses concise, crisp, and beautifully styled.',
  ],
  totalSessions: 1,
  totalQueries: 0,
};

export class ProfileMemory {
  private profile: UserProfileMemory;

  constructor() {
    this.ensureDirectory();
    this.profile = this.load();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
  }

  private load(): UserProfileMemory {
    try {
      if (fs.existsSync(PROFILE_FILE)) {
        const raw = fs.readFileSync(PROFILE_FILE, 'utf-8');
        return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
      }
    } catch {}
    return { ...DEFAULT_PROFILE };
  }

  public save(): void {
    try {
      this.ensureDirectory();
      fs.writeFileSync(PROFILE_FILE, JSON.stringify(this.profile, null, 2), 'utf-8');
    } catch {}
  }

  public getProfile(): UserProfileMemory {
    return this.profile;
  }

  public incrementQuery(): void {
    this.profile.totalQueries += 1;
    this.save();
  }

  public incrementSession(): void {
    this.profile.totalSessions += 1;
    this.save();
  }

  public addCustomRule(rule: string): void {
    if (!this.profile.customRules.includes(rule)) {
      this.profile.customRules.push(rule);
      this.save();
    }
  }

  /**
   * Retrieves workspace-level conventions from .antri/conventions.md if present
   */
  public getWorkspaceConventions(workingDir: string): string[] {
    const localConventionsFile = path.join(workingDir, '.antri', 'conventions.md');
    const conventions: string[] = [];

    if (fs.existsSync(localConventionsFile)) {
      try {
        const content = fs.readFileSync(localConventionsFile, 'utf-8');
        const lines = content.split('\n').filter((l) => l.trim().startsWith('-') || l.trim().startsWith('*') || l.trim().startsWith('•'));
        for (const line of lines) {
          const clean = line.replace(/^[-*•]\s*/, '').trim();
          if (clean) conventions.push(clean);
        }
      } catch {}
    }

    return conventions;
  }

  /**
   * Records a new project convention to .antri/conventions.md
   */
  public recordWorkspaceConvention(workingDir: string, convention: string): void {
    const dir = path.join(workingDir, '.antri');
    const file = path.join(dir, 'conventions.md');

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let existing = '';
      if (fs.existsSync(file)) {
        existing = fs.readFileSync(file, 'utf-8');
      } else {
        existing = '# 📜 Project Conventions & Learned Patterns\n\n';
      }

      if (!existing.includes(convention)) {
        existing += `- ${convention}\n`;
        fs.writeFileSync(file, existing, 'utf-8');
      }
    } catch {}
  }
}
