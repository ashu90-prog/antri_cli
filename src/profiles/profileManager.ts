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
      const template = `# 👤 Profile: profile_1

## 📋 Profile Info
- Profile Name: profile_1
- Description: Default user profile
- Role / Specialty: [e.g. Software Engineer, Full-Stack Developer]

## 🧠 User Thinking Style & Preferences
- Communication Style: [e.g. Concise, direct, step-by-step guidance]
- Problem Solving Approach: [e.g. First-principles, test-driven, proactive]
- Code Style & Architecture: [e.g. Modular, clean, typed, minimal dependencies]

## 🎯 User Hobbies & Interests
- Hobbies: [Add hobbies, music, gaming, or personal interests here]
- Technical Interests: [Add technical interests here]

## 📝 Personal Notes & Project Directives
- [Personal notes, rules, and facts captured during conversations will be recorded here]
`;
      fs.writeFileSync(profile1Path, template, 'utf-8');
    }
  }

  private initGlobalNotes(): void {
    if (!fs.existsSync(GLOBAL_NOTES_FILE)) {
      const template = `# 📝 Global User Notes & Identity

## 👤 User Identity & Facts
- Name: 
- Role: 
- Background: 

## 🧠 User Thinking Style & Preferences
- Preferred Communication: 
- Architectural Preferences: 

## 🎯 User Hobbies & Interests
- Hobbies & Interests: 

## 📌 Cross-Project Directives
- 
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

## 👤 User Identity & Project Role
- User Name: ${this.userName || ''}

## 🧠 Workspace Conventions & Observed Preferences
- 

## 📌 Project Directives
- 
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

  public getProfile(name: string): string {
    const cleanName = name.replace(/\.md$/, '').trim();
    const targetPath = path.join(this.profilesDir, `${cleanName}.md`);
    if (fs.existsSync(targetPath)) {
      try {
        return fs.readFileSync(targetPath, 'utf-8');
      } catch {}
    }
    return '';
  }

  public saveGlobalNotes(content: string): boolean {
    try {
      this.ensureDirectory();
      fs.writeFileSync(GLOBAL_NOTES_FILE, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  public saveWorkspaceNotes(content: string, workingDir?: string): boolean {
    const targetDir = workingDir || process.cwd();
    const wsNotesPath = path.join(targetDir, '.antri', 'profiles', 'notes.md');
    try {
      const dir = path.dirname(wsNotesPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(wsNotesPath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  public getNotesData(workingDir?: string): { globalNotes: string; workspaceNotes: string } {
    return {
      globalNotes: this.getGlobalNotesContent(),
      workspaceNotes: this.getWorkspaceNotesContent(workingDir),
    };
  }

  /**
   * Compiles comprehensive profile, user identity, and notes context for prompt injection (RAG style)
   */
  public getAllProfileContext(workingDir?: string): string {
    const activeName = this.getActiveProfileName();
    const profileContent = this.getActiveProfileContent();
    const globalNotes = this.getGlobalNotesContent();
    const wsNotes = this.getWorkspaceNotesContent(workingDir);

    let result = `\n\n================================================================================
[USER IDENTITY, PROFILE & NOTES (RAG ACTIVE CONTEXT)]
The following context contains the user's active thinking profile, preferences, identity facts, and accumulated notes.
Use this active knowledge naturally to inform responses, adhere to coding preferences, and recall user facts without forced persona changes.
🚨 Conversational Recall Rule: When the user asks what you know about them, their background, or preferences, answer naturally and conversationally like an intelligent human partner. Synthesize the relevant facts concisely. NEVER dump raw markdown files, JSON, or template boilerplate.
================================================================================\n`;

    if (profileContent) {
      result += `### Active Thinking Profile: ${activeName}.md\n${profileContent}\n\n`;
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

    const template = `# 👤 Profile: ${cleanName}

## 📋 Profile Info
- Profile Name: ${cleanName}
- Description: ${description || '[Add profile description here]'}
- Role / Specialty: [e.g. Full-Stack Developer, Backend Architect, Systems Engineer]

## 🧠 User Thinking Style & Preferences
- Communication Style: [e.g. Concise, direct, step-by-step guidance]
- Problem Solving Approach: [e.g. First-principles, test-driven, proactive]
- Code Style & Architecture: [e.g. Modular, clean, typed, minimal dependencies]

## 🎯 User Hobbies & Interests
- Hobbies: [Add hobbies, music, gaming, or personal interests here]
- Technical Interests: [Add technical interests here]

## 📝 Personal Notes & Project Directives
- [Personal notes, rules, and facts captured during conversations will be recorded here]
`;

    fs.writeFileSync(filePath, template, 'utf-8');
    this.setActiveProfile(cleanName);

    return {
      id: cleanName,
      name: cleanName,
      filePath,
      isActive: true,
      notesCount: 0,
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

      if (content.includes('## 📝 Personal Notes & Project Directives')) {
        content = content.replace(
          '## 📝 Personal Notes & Project Directives',
          `## 📝 Personal Notes & Project Directives\n${entry}`
        );
      } else if (content.includes('## 📝 Notes & Captured Insights')) {
        content = content.replace(
          '## 📝 Notes & Captured Insights',
          `## 📝 Notes & Captured Insights\n${entry}`
        );
      } else {
        content += `\n## 📝 Personal Notes & Project Directives\n${entry}\n`;
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
   * Real-time feedback, identity, personal context, and preference extractor
   */
  public extractAndRecordNotes(userPrompt: string, workingDir?: string): string | null {
    this.ensureWorkspaceProfiles(workingDir || process.cwd());
    const cleanPrompt = userPrompt.trim();
    if (!cleanPrompt || cleanPrompt.length < 5) return null;

    // 1. Check for Name / Identity patterns
    const namePatterns = [
      /(?:my name is|call me|i am|i'm)\s+([a-zA-Z0-9_\s]{2,40})/i,
      /(?:remember that my name is|remember my name is)\s+([a-zA-Z0-9_\s]{2,40})/i,
    ];

    for (const pattern of namePatterns) {
      const match = cleanPrompt.match(pattern);
      if (match && match[1]) {
        const namePart = match[1].split(/\s+(?:and|who|from|is|working|trying|who's|who\b|with)\b|[.!?,\n]/i)[0].trim();
        const ignoreList = ['a', 'an', 'the', 'trying', 'working', 'building', 'ready', 'here', 'sorry', 'going', 'not', 'just', 'also'];
        if (namePart && !ignoreList.includes(namePart.toLowerCase()) && namePart.split(' ').length <= 4) {
          this.userName = namePart;
          const noteEntry = `User Name is ${namePart}`;
          this.appendNoteToActiveProfile(noteEntry);
          this.appendToNotesFiles(noteEntry, workingDir);
          return noteEntry;
        }
      }
    }

    // 2. Check for Personal Life Events, Family, Bereavement & Milestones
    const lifeEventPatterns = [
      /(?:i lost (?:my )?(?:father|farher|mother|mom|dad|brother|sister|parent|family|friend)[^.!?\n]*)/i,
      /(?:my (?:father|farher|mother|mom|dad|brother|sister|parent) (?:passed away|died|left us)[^.!?\n]*)/i,
      /(?:in (?:19\d{2}|20\d{2}) (?:i lost|my father|my mother|i graduated|i started)[^.!?\n]*)/i,
      /(?:i work (?:as|at)|i live in|i am from|i study|my background is)\s+([^.!?\n]+)/i,
    ];

    for (const pattern of lifeEventPatterns) {
      const match = cleanPrompt.match(pattern);
      if (match) {
        const extracted = match[0].trim();
        if (extracted.length > 5 && extracted.length < 250) {
          const noteEntry = `Personal Context: ${extracted}`;
          this.appendNoteToActiveProfile(noteEntry);
          this.appendToNotesFiles(noteEntry, workingDir);
          return noteEntry;
        }
      }
    }

    // 3. Check for Hobbies, Interests & Music Preferences (with typo tolerance)
    const hobbyPatterns = [
      /(?:i like|i love|i enjoy|i listen|my hobby|my hobbies|in my free time)\s+(?:to |listening to |listning ot )?([^.!?\n]+)/i,
      /(?:i am into|i like listening|i listen to)\s+([^.!?\n]+)/i,
    ];

    for (const pattern of hobbyPatterns) {
      const match = cleanPrompt.match(pattern);
      if (match && match[0]) {
        const extracted = match[0].trim();
        if (extracted.length > 5 && extracted.length < 250) {
          const noteEntry = `Personal Interest/Hobby: ${extracted}`;
          this.appendNoteToActiveProfile(noteEntry);
          this.appendToNotesFiles(noteEntry, workingDir);
          return noteEntry;
        }
      }
    }

    // 4. Check for Coding Preferences, Directives & Architectural Rules
    const prefPatterns = [
      /(?:i prefer|i always use|my style is|always use|never use|don't use|do not use)\s+([^.!?\n]+)/i,
      /(?:from now on|remember that|keep in mind that|note that)\s+([^.!?\n]+)/i,
      /(?:i want you to|make sure to|focus on|i think of this as)\s+([^.!?\n]+)/i,
      /(?:let's do|instead of .+ let's use)\s+([^.!?\n]+)/i,
    ];

    for (const pattern of prefPatterns) {
      const match = cleanPrompt.match(pattern);
      if (match && match[1] && match[1].length > 4 && match[1].length < 200) {
        const extracted = match[0].trim();
        this.appendNoteToActiveProfile(extracted);
        this.appendToNotesFiles(extracted, workingDir);
        return extracted;
      }
    }

    // 5. Check for Philosophical Views, Mental Models, Ethical Beliefs & Worldview
    const philosophyPatterns = [
      /(?:i believe in|my philosophy is|philosophically|in life|i think that life|the way i see it|fundamentally|existentially|epistemically|my core belief|i live by|my worldview)\s+([^.!?\n]+)/i,
      /(?:i value|what matters most to me is|when it comes to life|my perspective is|human nature is|the purpose of)\s+([^.!?\n]+)/i,
      /(?:stoic|stoicism|nihilism|pragmatism|existentialism|utilitarianism|determinism|moral|ethics|first principles)\s+([^.!?\n]+)/i,
    ];

    for (const pattern of philosophyPatterns) {
      const match = cleanPrompt.match(pattern);
      if (match && match[0]) {
        const extracted = match[0].trim();
        if (extracted.length > 5 && extracted.length < 250) {
          const noteEntry = `Philosophy & Worldview: ${extracted}`;
          this.appendNoteToActiveProfile(noteEntry);
          this.appendToNotesFiles(noteEntry, workingDir);
          return noteEntry;
        }
      }
    }

    // 6. Check for Minute Nuances, Habits, Quirks & Mindset
    const nuancePatterns = [
      /(?:i tend to|my habit is|i get frustrated when|i feel best when|i usually think|my mindset is|i care deeply about)\s+([^.!?\n]+)/i,
    ];

    for (const pattern of nuancePatterns) {
      const match = cleanPrompt.match(pattern);
      if (match && match[0]) {
        const extracted = match[0].trim();
        if (extracted.length > 5 && extracted.length < 250) {
          const noteEntry = `Mindset & Nuance: ${extracted}`;
          this.appendNoteToActiveProfile(noteEntry);
          this.appendToNotesFiles(noteEntry, workingDir);
          return noteEntry;
        }
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
