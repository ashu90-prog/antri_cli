import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { FirestoreSyncManager } from './firestore.js';
import { RateLimiter } from '../security/rateLimiter.js';

export interface UserAccount {
  email: string;
  userId: string;
  provider: 'email' | 'google';
  token?: string;
  loggedInAt: string;
}

export class AuthManager {
  private static getAuthFilePath(): string {
    return path.join(os.homedir(), '.antri', 'auth.json');
  }

  public static getCurrentUser(): UserAccount | null {
    const filePath = this.getAuthFilePath();
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (data && data.email && data.userId) {
          return data;
        }
      } catch (_) {}
    }
    return null;
  }

  public static isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  public static generateUserId(email: string): string {
    const clean = email.toLowerCase().trim();
    const hash = crypto.createHash('sha256').update(clean).digest('hex').slice(0, 16);
    const prefix = clean.split('@')[0].replace(/[^a-z0-9_-]/g, '_');
    return `${prefix}_${hash}`;
  }

  public static async register(email: string, password?: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    const rateCheck = RateLimiter.checkLimit(cleanEmail, 'auth');
    if (!rateCheck.allowed) {
      return { success: false, error: `Too many auth requests. Please retry in ${rateCheck.retryAfterSeconds}s.` };
    }

    const userId = this.generateUserId(cleanEmail);
    const user: UserAccount = {
      email: cleanEmail,
      userId,
      provider: 'email',
      loggedInAt: new Date().toISOString(),
    };

    const dir = path.join(os.homedir(), '.antri');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.getAuthFilePath(), JSON.stringify(user, null, 2), 'utf-8');

    // Automatically route Firestore sync partition
    const syncCfg = FirestoreSyncManager.getSyncConfig();
    FirestoreSyncManager.saveSyncConfig(syncCfg.projectId || 'antri-agentic-hackathon', userId, syncCfg.apiKey);

    return { success: true, user };
  }

  public static async login(email: string, password?: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    return this.register(email, password);
  }

  /**
   * Google Sign-In handler (processes verified Google OAuth / ID token or Google Email)
   */
  public static async loginWithGoogle(email: string, googleToken?: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Invalid Google account email.' };
    }

    const rateCheck = RateLimiter.checkLimit(cleanEmail, 'auth');
    if (!rateCheck.allowed) {
      return { success: false, error: `Rate limit exceeded. Please retry in ${rateCheck.retryAfterSeconds}s.` };
    }

    const userId = this.generateUserId(cleanEmail);
    const user: UserAccount = {
      email: cleanEmail,
      userId,
      provider: 'google',
      token: googleToken,
      loggedInAt: new Date().toISOString(),
    };

    const dir = path.join(os.homedir(), '.antri');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.getAuthFilePath(), JSON.stringify(user, null, 2), 'utf-8');

    const syncCfg = FirestoreSyncManager.getSyncConfig();
    FirestoreSyncManager.saveSyncConfig(syncCfg.projectId || 'antri-agentic-hackathon', userId, syncCfg.apiKey);

    return { success: true, user };
  }

  public static logout(): void {
    const filePath = this.getAuthFilePath();
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    }
    const syncCfg = FirestoreSyncManager.getSyncConfig();
    FirestoreSyncManager.saveSyncConfig(syncCfg.projectId || 'antri-agentic-hackathon', 'default_user', syncCfg.apiKey);
  }
}
