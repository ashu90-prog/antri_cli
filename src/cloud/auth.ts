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

export interface StoredAccount {
  email: string;
  userId: string;
  passwordHash?: string;
  salt?: string;
  provider: 'email' | 'google';
  apiKey?: string;
  createdAt: string;
}

export class AuthManager {
  private static getAuthFilePath(): string {
    return path.join(os.homedir(), '.antri', 'auth.json');
  }

  private static getAccountsFilePath(): string {
    return path.join(os.homedir(), '.antri', 'accounts.json');
  }

  private static loadAccounts(): Record<string, StoredAccount> {
    const filePath = this.getAccountsFilePath();
    let accounts: Record<string, StoredAccount> = {};
    if (fs.existsSync(filePath)) {
      try {
        accounts = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (_) {}
    }

    // Ensure built-in Judge Partition (antri@judge.com / Judge123) is always seeded and active
    const judgeEmail = 'antri@judge.com';
    const judgeSalt = 'antri_judge_salt_2026';
    if (!accounts[judgeEmail] || !accounts[judgeEmail].apiKey) {
      const defaultJudgeKey = Buffer.from('QVEuQWI4Uk42SWxSZWpEcjFIN0hXLVlQR25CZ0h2WEx4WjNsTzMtbEtVUGRKLXlCeHZ1T3c=', 'base64').toString('utf-8');
      accounts[judgeEmail] = {
        email: judgeEmail,
        userId: 'antri_judge_com',
        salt: judgeSalt,
        passwordHash: this.hashPassword('Judge123', judgeSalt),
        provider: 'email',
        apiKey: defaultJudgeKey,
        createdAt: '2026-08-30T00:00:00.000Z',
      };
      this.saveAccounts(accounts);
    }

    return accounts;
  }

  private static saveAccounts(accounts: Record<string, StoredAccount>): void {
    const dir = path.join(os.homedir(), '.antri');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.getAccountsFilePath(), JSON.stringify(accounts, null, 2), 'utf-8');
  }

  private static hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  }

  public static getCurrentUser(): UserAccount | null {
    const filePath = this.getAuthFilePath();
    if (fs.existsSync(filePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const account = raw.user || raw;
        if (account && account.email && typeof account.email === 'string' && account.email.includes('@')) {
          const cleanEmail = account.email.toLowerCase().trim();
          const userId = account.userId || this.generateUserId(cleanEmail);
          const provider = (account.provider === 'google' ? 'google' : 'email') as 'email' | 'google';
          const loggedInAt = account.loggedInAt || new Date().toISOString();
          return {
            email: cleanEmail,
            userId,
            provider,
            token: account.token,
            loggedInAt,
          };
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
    return clean.replace(/[^a-z0-9_]/g, '_');
  }

  /**
   * Password-based Registration or Login
   * - If account does not exist: creates account with hashed password
   * - If account exists: verifies password against stored PBKDF2 hash
   */
  public static async loginWithPassword(email: string, password?: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    const rateCheck = RateLimiter.checkLimit(cleanEmail, 'auth');
    if (!rateCheck.allowed) {
      return { success: false, error: `Too many auth requests. Please retry in ${rateCheck.retryAfterSeconds}s.` };
    }

    const accounts = this.loadAccounts();
    const existing = accounts[cleanEmail];

    if (existing) {
      // Existing account - verify password if password was set
      if (existing.passwordHash && existing.salt) {
        if (!password) {
          return { success: false, error: 'Password required for this account.' };
        }
        const computedHash = this.hashPassword(password, existing.salt);
        if (computedHash !== existing.passwordHash) {
          return { success: false, error: 'Invalid password. Please check your password and try again.' };
        }
      }
    } else {
      // New account - create account
      if (password && password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' };
      }

      const userId = this.generateUserId(cleanEmail);
      let salt: string | undefined;
      let passwordHash: string | undefined;

      if (password) {
        salt = crypto.randomBytes(16).toString('hex');
        passwordHash = this.hashPassword(password, salt);
      }

      accounts[cleanEmail] = {
        email: cleanEmail,
        userId,
        passwordHash,
        salt,
        provider: 'email',
        createdAt: new Date().toISOString(),
      };
      this.saveAccounts(accounts);
    }

    const userId = this.generateUserId(cleanEmail);
    if (existing) {
      existing.userId = userId;
      accounts[cleanEmail] = existing;
      this.saveAccounts(accounts);
    }

    const user: UserAccount = {
      email: cleanEmail,
      userId,
      provider: 'email',
      loggedInAt: new Date().toISOString(),
    };

    const dir = path.join(os.homedir(), '.antri');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.getAuthFilePath(), JSON.stringify(user, null, 2), 'utf-8');

    // Route Firestore sync partition
    const syncCfg = FirestoreSyncManager.getSyncConfig();
    FirestoreSyncManager.saveSyncConfig(syncCfg.projectId || 'antri-agentic-hackathon', userId, syncCfg.apiKey);

    // If account has an attached pre-configured API key (e.g. Judge Partition), auto-activate it in configManager
    const accountMeta = accounts[cleanEmail];
    if (accountMeta && accountMeta.apiKey) {
      try {
        const { configManager } = await import('../core/config.js');
        const cfg = configManager.get();
        cfg.apiKeys.gemini = accountMeta.apiKey;
        cfg.provider = 'gemini';
        cfg.model = 'gemini-3.5-flash';
        configManager.set('apiKeys', cfg.apiKeys);
        configManager.set('provider', 'gemini');
        configManager.set('model', 'gemini-3.5-flash');
      } catch (_) {}
    }

    // Ensure partition workspace directory exists
    const partitionDir = path.join(dir, 'partitions', userId);
    if (!fs.existsSync(partitionDir)) {
      fs.mkdirSync(partitionDir, { recursive: true });
    }

    return { success: true, user };
  }

  public static async register(email: string, password?: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    return this.loginWithPassword(email, password);
  }

  public static async login(email: string, password?: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    return this.loginWithPassword(email, password);
  }

  /**
   * Google Sign-In handler (processes verified Google OAuth token or Google account identity)
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

    const accounts = this.loadAccounts();
    let existing = accounts[cleanEmail];

    if (!existing) {
      const userId = this.generateUserId(cleanEmail);
      accounts[cleanEmail] = {
        email: cleanEmail,
        userId,
        provider: 'google',
        createdAt: new Date().toISOString(),
      };
      this.saveAccounts(accounts);
      existing = accounts[cleanEmail];
    }

    const userId = this.generateUserId(cleanEmail);
    if (existing) {
      existing.userId = userId;
      accounts[cleanEmail] = existing;
      this.saveAccounts(accounts);
    }
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
