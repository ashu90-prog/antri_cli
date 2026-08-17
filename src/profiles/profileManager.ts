import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { ProfileInfo } from '../types.js';

const PROFILES_DIR = path.join(os.homedir(), '.antri', 'profiles');
const ACTIVE_PROFILE_FILE = path.join(PROFILES_DIR, '.active_profile');

export class ProfileManager {
  private profilesDir: string;
  private activeProfile: string = 'profile_1';

  constructor(customDir?: string) {
    this.profilesDir = customDir || PROFILES_DIR;
    this.ensureDirectory();
    this.initDefaultProfile();
    this.loadActiveProfileName();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
    }
  }

  private initDefaultProfile(): void {
    const profile1Path = path.join(this.profilesDir, 'profile_1.md');
    if (!fs.existsSync(profile1Path)) {
      const template = `# 👤 User Profile: profile_1
- Created: ${new Date().toISOString()}
- Description: Default user profile for proactive guidance, step-by-step roadmaps, and adaptive notes.

## 🧠 Style of Thinking & Preferences
- Communication: Direct, structured, asks clarifying questions when decisions have trade-offs.
- Execution: Leads the way step-by-step with clear explanations.
- Adaptability: Continuously incorporates user feedback and refines solutions.

## 📝 Notes & Captured Insights
- [${new Date().toLocaleDateString()}]: Initialized profile_1. Leading the way and taking notes on user thinking style.

## 🛠️ Code Conventions & Architectural Preferences
- Architecture: Modular, clean, idiomatic code with explicit type safety.
- Documentation: Self-documenting code with concise explanations.
`;
      fs.writeFileSync(profile1Path, template, 'utf-8');
    }
  }

  private loadActiveProfileName(): void {
    try {
      if (fs.existsSync(ACTIVE_PROFILE_FILE)) {
        const name = fs.readFileSync(ACTIVE_PROFILE_FILE, 'utf-8').trim();
        if (name && fs.existsSync(path.join(this.profilesDir, `${name}.md`))) {
          this.activeProfile = name;
          return;
        }
      }
    } catch {}
    this.activeProfile = 'profile_1';
  }

  public getActiveProfileName(): string {
    return this.activeProfile;
  }

  public setActiveProfile(name: string): boolean {
    const cleanName = name.replace(/\.md$/, '').trim();
    const targetPath = path.join(this.profilesDir, `${cleanName}.md`);

    if (!fs.existsSync(targetPath)) {
      // Auto-create if not exists
      this.createProfile(cleanName);
    }

    this.activeProfile = cleanName;
    try {
      fs.writeFileSync(ACTIVE_PROFILE_FILE, cleanName, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  public listProfiles(): ProfileInfo[] {
    this.ensureDirectory();
    const files = fs.readdirSync(this.profilesDir).filter((f) => f.endsWith('.md'));
    const profiles: ProfileInfo[] = [];

    for (const file of files) {
      const id = file.replace(/\.md$/, '');
      const filePath = path.join(this.profilesDir, file);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      let notesCount = 0;
      let inNotesSection = false;
      for (const l of lines) {
        if (l.startsWith('## 📝 Notes')) {
          inNotesSection = true;
          continue;
        }
        if (inNotesSection && l.startsWith('## ')) {
          inNotesSection = false;
        }
        if (inNotesSection && l.trim().startsWith('- [')) {
          notesCount++;
        }
      }

      profiles.push({
        id,
        name: id,
        filePath,
        isActive: id === this.activeProfile,
        notesCount,
        lastModified: stat.mtimeMs,
        preview: lines.slice(0, 10).join('\n'),
      });
    }

    return profiles.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
  }

  public getActiveProfileContent(): string {
    const filePath = path.join(this.profilesDir, `${this.activeProfile}.md`);
    if (fs.existsSync(filePath)) {
      try {
        return fs.readFileSync(filePath, 'utf-8');
      } catch {}
    }
    return '';
  }

  public createProfile(name: string, description?: string): ProfileInfo {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_').trim() || `profile_${Date.now()}`;
    const filePath = path.join(this.profilesDir, `${cleanName}.md`);

    const template = `# 👤 User Profile: ${cleanName}
- Created: ${new Date().toISOString()}
- Description: ${description || `Custom thinking style and preference profile for ${cleanName}.`}

## 🧠 Style of Thinking & Preferences
- Communication: Proactively leads the way, asks clarifying questions, and adapts step-by-step.
- Pace: Fast and iterative.

## 📝 Notes & Captured Insights
- [${new Date().toLocaleDateString()}]: Created profile '${cleanName}'. Ready to capture feedback and thinking style.

## 🛠️ Code Conventions & Architectural Preferences
- Standard conventions apply. Will adapt as user chats in this profile.
`;

    fs.writeFileSync(filePath, template, 'utf-8');
    this.setActiveProfile(cleanName);

    return {
      id: cleanName,
      name: cleanName,
      filePath,
      isActive: true,
      notesCount: 1,
      lastModified: Date.now(),
      preview: template,
    };
  }

  /**
   * Appends an observed user insight, preference, or feedback item to active profile markdown
   */
  public appendNoteToActiveProfile(note: string): void {
    const filePath = path.join(this.profilesDir, `${this.activeProfile}.md`);
    if (!fs.existsSync(filePath)) return;

    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      const timestamp = new Date().toLocaleDateString();
      const entry = `- [${timestamp}]: ${note.trim()}`;

      if (content.includes(entry)) return; // Avoid exact duplicates

      if (content.includes('## 📝 Notes & Captured Insights')) {
        content = content.replace(
          '## 📝 Notes & Captured Insights',
          `## 📝 Notes & Captured Insights\n${entry}`
        );
      } else {
        content += `\n## 📝 Notes & Captured Insights\n${entry}\n`;
      }

      fs.writeFileSync(filePath, content, 'utf-8');
    } catch {}
  }

  /**
   * Real-time feedback and preference extractor: Analyzes user prompt for thinking styles, feedback, or directives
   */
  public extractAndRecordNotes(userPrompt: string): string | null {
    const lower = userPrompt.toLowerCase().trim();

    // Check for explicit preference / feedback patterns
    const patterns = [
      /(?:i prefer|i like|i always use|my style is|always use|never use|don't use|do not use)\s+([^.!?\n]+)/i,
      /(?:from now on|remember that|keep in mind that|note that)\s+([^.!?\n]+)/i,
      /(?:i want you to|make sure to|focus on|i think of this as)\s+([^.!?\n]+)/i,
      /(?:let's do|instead of .+ let's use)\s+([^.!?\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = userPrompt.match(pattern);
      if (match && match[1] && match[1].length > 4 && match[1].length < 200) {
        const extracted = match[0].trim();
        this.appendNoteToActiveProfile(extracted);
        return extracted;
      }
    }

    return null;
  }

  public renderActiveProfile(): void {
    const content = this.getActiveProfileContent();
    console.log(chalk.bold.hex('#c084fc')(`\n👤 Active Profile: ${this.activeProfile}`));
    console.log(chalk.hex('#334155')('─'.repeat(72)));
    console.log(chalk.hex('#94a3b8')(content));
    console.log(chalk.hex('#334155')('─'.repeat(72)));
    console.log();
  }
}

export const profileManager = new ProfileManager();
