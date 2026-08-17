import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import https from 'https';
import { FirestoreSyncManager } from './firestore.js';

export interface UserAccount {
  email: string;
  userId: string;
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

    const userId = this.generateUserId(cleanEmail);
    const user: UserAccount = {
      email: cleanEmail,
      userId,
      loggedInAt: new Date().toISOString(),
    };

    const dir = path.join(os.homedir(), '.antri');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.getAuthFilePath(), JSON.stringify(user, null, 2), 'utf-8');

    // Automatically update Firestore syncKey to this user's isolated partition
    const syncCfg = FirestoreSyncManager.getSyncConfig();
    FirestoreSyncManager.saveSyncConfig(syncCfg.projectId || 'antri-agentic-hackathon', userId, syncCfg.apiKey);

    return { success: true, user };
  }

  public static async login(email: string, password?: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    return this.register(email, password);
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
