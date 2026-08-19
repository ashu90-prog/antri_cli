import fs from 'fs';
import path from 'path';
import os from 'os';
import { ChatMessage, ChatSession, ChatSessionSummary } from '../types.js';

const CHATS_DIR = path.join(os.homedir(), '.antri', 'chats');
const ACTIVE_SESSION_FILE = path.join(CHATS_DIR, '.active_session');

export class SessionManager {
  private chatsDir: string;
  private activeSessionId: string = '';

  constructor(customDir?: string) {
    this.chatsDir = customDir || CHATS_DIR;
    this.ensureDirectory();
    this.initActiveSession();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.chatsDir)) {
      fs.mkdirSync(this.chatsDir, { recursive: true });
    }
  }

  private initActiveSession(): void {
    try {
      if (fs.existsSync(ACTIVE_SESSION_FILE)) {
        const id = fs.readFileSync(ACTIVE_SESSION_FILE, 'utf-8').trim();
        if (id && fs.existsSync(this.getSessionFilePath(id))) {
          this.activeSessionId = id;
          return;
        }
      }
    } catch {}

    // Pick first existing session or create a default session
    const sessions = this.listSessions();
    if (sessions.length > 0) {
      this.activeSessionId = sessions[0].id;
    } else {
      const newSession = this.createSession('New Chat');
      this.activeSessionId = newSession.id;
    }
    this.saveActiveSessionId();
  }

  private getSessionFilePath(id: string): string {
    const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.chatsDir, `${cleanId}.json`);
  }

  private saveActiveSessionId(): void {
    try {
      this.ensureDirectory();
      fs.writeFileSync(ACTIVE_SESSION_FILE, this.activeSessionId, 'utf-8');
    } catch {}
  }

  public getActiveSessionId(): string {
    return this.activeSessionId;
  }

  public setActiveSessionId(id: string): ChatSession | null {
    const session = this.getSession(id);
    if (session) {
      this.activeSessionId = id;
      this.saveActiveSessionId();
      return session;
    }
    return null;
  }

  public createSession(title = 'New Chat'): ChatSession {
    this.ensureDirectory();
    const id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const session: ChatSession = {
      id,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };

    this.saveSession(session);
    this.activeSessionId = id;
    this.saveActiveSessionId();
    return session;
  }

  public getSession(id: string): ChatSession | null {
    const filePath = this.getSessionFilePath(id);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      } catch {}
    }
    return null;
  }

  public getActiveSession(): ChatSession {
    const session = this.getSession(this.activeSessionId);
    if (session) return session;
    return this.createSession('New Chat');
  }

  public saveSession(session: ChatSession): void {
    this.ensureDirectory();
    session.updatedAt = Date.now();
    const filePath = this.getSessionFilePath(session.id);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  public addMessageToActiveSession(message: ChatMessage): ChatSession {
    const session = this.getActiveSession();
    session.messages.push({
      ...message,
      timestamp: message.timestamp || Date.now(),
    });

    // Auto-generate title on first user message if title is "New Chat"
    if (session.title === 'New Chat' && message.role === 'user') {
      const cleanPrompt = message.content.replace(/\[Attached File:[^\]]+\]/g, '').trim();
      if (cleanPrompt) {
        session.title = cleanPrompt.length > 35 ? `${cleanPrompt.slice(0, 32)}...` : cleanPrompt;
      }
    }

    this.saveSession(session);
    return session;
  }

  public listSessions(): ChatSessionSummary[] {
    this.ensureDirectory();
    try {
      const files = fs.readdirSync(this.chatsDir).filter((f) => f.endsWith('.json') && !f.startsWith('.'));
      const summaries: ChatSessionSummary[] = [];

      for (const file of files) {
        try {
          const filePath = path.join(this.chatsDir, file);
          const raw = fs.readFileSync(filePath, 'utf-8');
          const data: ChatSession = JSON.parse(raw);
          if (data && data.id) {
            const lastUserMsg = data.messages?.filter((m) => m.role === 'user').pop();
            summaries.push({
              id: data.id,
              title: data.title || 'Untitled Chat',
              createdAt: data.createdAt || 0,
              updatedAt: data.updatedAt || 0,
              messageCount: data.messages?.length || 0,
              preview: lastUserMsg?.content?.slice(0, 80) || '',
              isActive: data.id === this.activeSessionId,
            });
          }
        } catch {}
      }

      return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  public deleteSession(id: string): boolean {
    const filePath = this.getSessionFilePath(id);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (this.activeSessionId === id) {
        const remaining = this.listSessions();
        if (remaining.length > 0) {
          this.activeSessionId = remaining[0].id;
        } else {
          const fresh = this.createSession('New Chat');
          this.activeSessionId = fresh.id;
        }
        this.saveActiveSessionId();
      }
      return true;
    } catch {
      return false;
    }
  }

  public renameSession(id: string, newTitle: string): boolean {
    const session = this.getSession(id);
    if (session) {
      session.title = newTitle.trim() || 'Untitled Chat';
      this.saveSession(session);
      return true;
    }
    return false;
  }

  public clearActiveSessionMessages(): void {
    const session = this.getActiveSession();
    session.messages = [];
    this.saveSession(session);
  }
}

export const sessionManager = new SessionManager();
