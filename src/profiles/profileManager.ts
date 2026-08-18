import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { ProfileInfo } from '../types.js';

const PROFILES_DIR = path.join(os.homedir(), '.antri', 'profiles');
const ACTIVE_PROFILE_FILE = path.join(PROFILES_DIR, '.active_profile');
const GLOBAL_NOTES_FILE = path.join(PROFILES_DIR, 'notes.md');

export class ProfileManager {
  private profilesDir: string;
  private activeProfile: string = 'profile_1';
  private userName: string = '';

  constructor(customDir?: string) {
    this.profilesDir = customDir || PROFILES_DIR;
    this.ensureDirectory();
    this.initDefaultProfile();
    this.initGlobalNotes();
    this.loadActiveProfileName();
    this.ensureWorkspaceProfiles(process.cwd());
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

  private initGlobalNotes(): void {
    if (!fs.existsSync(GLOBAL_NOTES_FILE)) {
      const template = `# 📝 Global User Notes & Identity
- Initialized: ${new Date().toISOString()}

## 👤 User Identity & Known Facts
- User Name: 

## 🧠 Personal Preferences & Communication Style
- Proactively lead the way and provide architectural clarity.

## 📌 Cross-Project Directives
- Standard clean code principles across all workspaces.
`;
      fs.writeFileSync(GLOBAL_NOTES_FILE, template, 'utf-8');
    }
  }

  /**
   * Initializes per-workspace folder containing profiles and workspace notes.md
   */
  public ensureWorkspaceProfiles(workingDir: string): string {
    const targetDir = workingDir || process.cwd();
    const wsProfilesDir = path.join(targetDir, '.antri', 'profiles');
    if (!fs.existsSync(wsProfilesDir)) {
      fs.mkdirSync(wsProfilesDir, { recursive: true });
    }

    const wsNotesPath = path.join(wsProfilesDir, 'notes.md');
    if (!fs.existsSync(wsNotesPath)) {
      const dirName = path.basename(targetDir);
      const template = `# 📝 Workspace Notes & Directives: ${dirName}
- Workspace Path: ${targetDir}
- Initialized: ${new Date().toISOString()}

## 👤 User Identity & Project Role
- User Name: ${this.userName || '(Not specified yet)'}

## 🧠 Workspace Conventions & Observed Preferences
- (Agent automatically appends observed directives and insights here)
`;
      fs.writeFileSync(wsNotesPath, template, 'utf-8');
    }

    const wsProfile1 = path.join(wsProfilesDir, 'profile_1.md');
    if (!fs.existsSync(wsProfile1)) {
      const activeContent = this.getActiveProfileContent();
      fs.writeFileSync(wsProfile1, activeContent || '# profile_1\nDefault workspace profile.', 'utf-8');
    }

    return wsProfilesDir;
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
    const files = fs.readdirSync(this.profilesDir).filter((f) => f.endsWith('.md') && f !== 'notes.md');
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

  public getGlobalNotesContent(): string {
    if (fs.existsSync(GLOBAL_NOTES_FILE)) {
      try {
        return fs.readFileSync(GLOBAL_NOTES_FILE, 'utf-8');
      } catch {}
    }
    return '';
  }

  public getWorkspaceNotesContent(workingDir?: string): string {
    const targetDir = workingDir || process.cwd();
    const wsNotesPath = path.join(targetDir, '.antri', 'profiles', 'notes.md');
    if (fs.existsSync(wsNotesPath)) {
      try {
        return fs.readFileSync(wsNotesPath, 'utf-8');
      } catch {}
    }
    return '';
  }

  /**
   * Compiles comprehensive profile, user identity, and notes context for prompt injection
   */
  public getAllProfileContext(workingDir?: string): string {
    const activeName = this.getActiveProfileName();
    const profileContent = this.getActiveProfileContent();
    const globalNotes = this.getGlobalNotesContent();
    const wsNotes = this.getWorkspaceNotesContent(workingDir);

    let result = `\n\n================================================================================
[MANDATORY USER IDENTITY, PROFILE & NOTES DIRECTIVE]
You MUST ALWAYS adhere to the user's identity, preferences, and accumulated notes below.
Do NOT ask the user to repeat their name, preferences, or established conventions.
================================================================================\n`;

    if (profileContent) {
      result += `### Active Profile: ${activeName}.md\n${profileContent}\n\n`;
    }

    if (globalNotes) {
      result += `### Global User Notes & Identity (notes.md)\n${globalNotes}\n\n`;
    }

    if (wsNotes) {
      result += `### Workspace Local Notes (.antri/profiles/notes.md)\n${wsNotes}\n\n`;
    }

    result += `================================================================================\n`;
    return result;
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

  public appendNoteToActiveProfile(note: string): void {
    const filePath = path.join(this.profilesDir, `${this.activeProfile}.md`);
    if (!fs.existsSync(filePath)) return;

    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      const timestamp = new Date().toLocaleDateString();
      const entry = `- [${timestamp}]: ${note.trim()}`;

      if (content.includes(entry)) return;

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

  public appendToNotesFiles(entry: string, workingDir?: string): void {
    // 1. Global notes
    try {
      if (fs.existsSync(GLOBAL_NOTES_FILE)) {
        let globalText = fs.readFileSync(GLOBAL_NOTES_FILE, 'utf-8');
        if (!globalText.includes(entry)) {
          globalText += `\n- [${new Date().toLocaleDateString()}]: ${entry}`;
          fs.writeFileSync(GLOBAL_NOTES_FILE, globalText, 'utf-8');
        }
      }
    } catch {}

    // 2. Workspace notes
    try {
      const targetDir = workingDir || process.cwd();
      const wsNotesPath = path.join(targetDir, '.antri', 'profiles', 'notes.md');
      if (fs.existsSync(wsNotesPath)) {
        let wsText = fs.readFileSync(wsNotesPath, 'utf-8');
        if (!wsText.includes(entry)) {
          wsText += `\n- [${new Date().toLocaleDateString()}]: ${entry}`;
          fs.writeFileSync(wsNotesPath, wsText, 'utf-8');
        }
      }
    } catch {}
  }

  /**
   * Real-time feedback, identity and preference extractor
   */
  public extractAndRecordNotes(userPrompt: string, workingDir?: string): string | null {
    this.ensureWorkspaceProfiles(workingDir || process.cwd());

    // 1. Check for Name / Identity patterns
    const namePatterns = [
      /(?:my name is|call me|i am|i'm)\s+([a-zA-Z0-9_\s]{2,30})/i,
      /(?:remember that my name is|remember my name is)\s+([a-zA-Z0-9_\s]{2,30})/i,
    ];

    for (const pattern of namePatterns) {
      const match = userPrompt.match(pattern);
      if (match && match[1]) {
        const rawName = match[1].replace(/[.!?\n].*$/, '').trim();
        // Ignore generic verbs or common words
        if (rawName && !['a', 'an', 'the', 'trying', 'working', 'building', 'ready', 'here'].includes(rawName.toLowerCase())) {
          this.userName = rawName;
          const noteEntry = `User Name is ${rawName}`;
          this.appendNoteToActiveProfile(noteEntry);
          this.appendToNotesFiles(noteEntry, workingDir);
          return noteEntry;
        }
      }
    }

    // 2. Check for explicit preference / feedback patterns
    const prefPatterns = [
      /(?:i prefer|i like|i always use|my style is|always use|never use|don't use|do not use)\s+([^.!?\n]+)/i,
      /(?:from now on|remember that|keep in mind that|note that)\s+([^.!?\n]+)/i,
      /(?:i want you to|make sure to|focus on|i think of this as)\s+([^.!?\n]+)/i,
      /(?:let's do|instead of .+ let's use)\s+([^.!?\n]+)/i,
    ];

    for (const pattern of prefPatterns) {
      const match = userPrompt.match(pattern);
      if (match && match[1] && match[1].length > 4 && match[1].length < 200) {
        const extracted = match[0].trim();
        this.appendNoteToActiveProfile(extracted);
        this.appendToNotesFiles(extracted, workingDir);
        return extracted;
      }
    }

    return null;
  }

  public importProfile(name: string, content: string): ProfileInfo {
    const cleanName = name.toLowerCase().replace(/\.md$/, '').replace(/[^a-z0-9_-]/g, '_').trim() || `profile_${Date.now()}`;
    const filePath = path.join(this.profilesDir, `${cleanName}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');
    this.setActiveProfile(cleanName);

    const stat = fs.statSync(filePath);
    return {
      id: cleanName,
      name: cleanName,
      filePath,
      isActive: true,
      notesCount: 0,
      lastModified: stat.mtimeMs,
      preview: content.slice(0, 300),
    };
  }

  public saveProfile(name: string, content: string): boolean {
    const cleanName = name.toLowerCase().replace(/\.md$/, '').trim();
    const filePath = path.join(this.profilesDir, `${cleanName}.md`);
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  public deleteProfile(name: string): boolean {
    const cleanName = name.toLowerCase().replace(/\.md$/, '').trim();
    if (cleanName === 'profile_1') {
      return false;
    }
    const filePath = path.join(this.profilesDir, `${cleanName}.md`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (this.activeProfile === cleanName) {
        this.setActiveProfile('profile_1');
      }
      return true;
    } catch {
      return false;
    }
  }

  public renderActiveProfile(): void {
    const content = this.getActiveProfileContent();
    const notes = this.getGlobalNotesContent();
    console.log(chalk.bold.hex('#c084fc')(`\n👤 Active Profile: ${this.activeProfile}`));
    console.log(chalk.hex('#334155')('─'.repeat(72)));
    console.log(chalk.hex('#94a3b8')(content));
    if (notes) {
      console.log(chalk.bold.hex('#38bdf8')(`\n📝 Global notes.md:`));
      console.log(chalk.hex('#94a3b8')(notes));
    }
    console.log(chalk.hex('#334155')('─'.repeat(72)));
    console.log();
  }
}

export const profileManager = new ProfileManager();
