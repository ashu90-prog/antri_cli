import fs from 'fs';
import path from 'path';
import os from 'os';
import { UserProfileMemory } from './types.js';

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
  private customDir?: string;
  private currentUserId: string = 'default_user';
  private profile: UserProfileMemory;

  constructor(customDir?: string) {
    this.customDir = customDir;
    this.currentUserId = customDir ? 'custom' : getCurrentUserId();
    this.ensureDirectory();
    this.profile = this.load();
  }

  public switchUser(userId?: string): void {
    this.currentUserId = userId || getCurrentUserId();
    this.ensureDirectory();
    this.profile = this.load();
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

  public getProfileFile(): string {
    return path.join(this.getMemoryDir(), 'profile.json');
  }

  private ensureDirectory(): void {
    const dir = this.getMemoryDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private load(): UserProfileMemory {
    try {
      const file = this.getProfileFile();
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
      }
    } catch {}
    return { ...DEFAULT_PROFILE };
  }

  public save(): void {
    try {
      this.ensureDirectory();
      fs.writeFileSync(this.getProfileFile(), JSON.stringify(this.profile, null, 2), 'utf-8');
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
