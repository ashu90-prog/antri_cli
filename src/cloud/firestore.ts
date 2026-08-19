import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import https from 'https';
import { profileManager } from '../profiles/profileManager.js';
import { memoryManager } from '../memory/manager.js';
import { configManager } from '../core/config.js';
import { log, colors } from '../utils/logger.js';
import chalk from 'chalk';

export interface CloudSyncStatus {
  connected: boolean;
  projectId: string;
  syncKey: string;
  lastSynced?: string;
  profilesSynced: number;
}

export class FirestoreSyncManager {
  private static getSyncConfigFile(): string {
    return path.join(os.homedir(), '.antri', 'cloud_sync.json');
  }

  public static getSyncConfig(): { projectId: string; syncKey: string; apiKey?: string; lastSynced?: string } {
    let storedSyncKey = 'default_user';
    let storedProjectId = 'antri-agentic-hackathon';
    let storedApiKey = process.env.GEMINI_API_KEY || '';
    let lastSynced: string | undefined;

    const filePath = this.getSyncConfigFile();
    if (fs.existsSync(filePath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (cfg.projectId) storedProjectId = cfg.projectId;
        if (cfg.syncKey) storedSyncKey = cfg.syncKey;
        if (cfg.apiKey) storedApiKey = cfg.apiKey;
        if (cfg.lastSynced) lastSynced = cfg.lastSynced;
      } catch (_) {}
    }

    // If storedSyncKey is default_user, dynamically bind to current authenticated user partition
    if (storedSyncKey === 'default_user') {
      try {
        const authPath = path.join(os.homedir(), '.antri', 'auth.json');
        if (fs.existsSync(authPath)) {
          const authData = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
          const user = authData.user || authData;
          if (user && user.email && typeof user.email === 'string') {
            const clean = user.email.toLowerCase().trim();
            storedSyncKey = user.userId || clean.replace(/[^a-z0-9_]/g, '_');
          }
        }
      } catch (_) {}
    }

    return {
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || storedProjectId,
      syncKey: storedSyncKey,
      apiKey: storedApiKey,
      lastSynced,
    };
  }

  public static saveSyncConfig(projectId: string, syncKey = 'default_user', apiKey = ''): void {
    const dir = path.join(os.homedir(), '.antri');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const targetProject = projectId || 'antri-agentic-hackathon';
    fs.writeFileSync(
      this.getSyncConfigFile(),
      JSON.stringify({ projectId: targetProject, syncKey, apiKey, lastSynced: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  }

  /**
   * Push local profiles from ~/.antri/profiles/ to Google Cloud Firestore
   */
  public static async pushToFirestore(): Promise<{ success: boolean; count: number; notesSynced?: boolean; total?: number; error?: string }> {
    const { projectId, syncKey, apiKey } = this.getSyncConfig();
    const targetProject = projectId || 'antri-agentic-hackathon';

    const profiles = profileManager.listProfiles();
    let profileCount = 0;
    let notesSynced = false;
    const keyParam = apiKey ? `?key=${apiKey}` : '';

    // Push all profile files
    for (const p of profiles) {
      let content = '';
      if (p.filePath && fs.existsSync(p.filePath)) {
        content = fs.readFileSync(p.filePath, 'utf-8');
      } else {
        const filePath = path.join(os.homedir(), '.antri', 'profiles', `${p.name}.md`);
        if (fs.existsSync(filePath)) {
          content = fs.readFileSync(filePath, 'utf-8');
        }
      }

      if (!content) continue;

      const url = `https://firestore.googleapis.com/v1/projects/${targetProject}/databases/(default)/documents/antri_sync/${syncKey}/profiles/${p.name}${keyParam}`;
      const payload = JSON.stringify({
        fields: {
          name: { stringValue: p.name },
          content: { stringValue: content },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      });

      try {
        await this.httpRequest(url, 'PATCH', payload);
        profileCount++;
      } catch (err: any) {
        // Continue attempting others
      }
    }

    // Also push global notes.md if present
    const globalNotesPath = path.join(os.homedir(), '.antri', 'profiles', 'notes.md');
    if (fs.existsSync(globalNotesPath)) {
      const notesContent = fs.readFileSync(globalNotesPath, 'utf-8');
      const url = `https://firestore.googleapis.com/v1/projects/${targetProject}/databases/(default)/documents/antri_sync/${syncKey}/profiles/notes${keyParam}`;
      const payload = JSON.stringify({
        fields: {
          name: { stringValue: 'notes' },
          content: { stringValue: notesContent },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      });
      try {
        await this.httpRequest(url, 'PATCH', payload);
        notesSynced = true;
      } catch {}
    }

    this.saveSyncConfig(targetProject, syncKey, apiKey);
    return { success: true, count: profileCount, notesSynced, total: profileCount + (notesSynced ? 1 : 0) };
  }

  /**
   * Pull profiles from Google Cloud Firestore to ~/.antri/profiles/
   */
  public static async pullFromFirestore(): Promise<{ success: boolean; count: number; notesSynced?: boolean; total?: number; error?: string }> {
    const { projectId, syncKey } = this.getSyncConfig();
    const targetProject = projectId || 'antri-agentic-hackathon';

    const url = `https://firestore.googleapis.com/v1/projects/${targetProject}/databases/(default)/documents/antri_sync/${syncKey}/profiles`;

    try {
      const raw = await this.httpRequest(url, 'GET');
      const data = JSON.parse(raw);
      const docs = data.documents || [];
      const dir = path.join(os.homedir(), '.antri', 'profiles');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      let profileCount = 0;
      let notesSynced = false;
      let firstProfileName = '';

      for (const doc of docs) {
        const docName = doc.name ? doc.name.split('/').pop() : '';
        const fields = doc.fields || {};
        const rawName = fields.name?.stringValue || docName || '';
        const cleanName = rawName.replace(/\.md$/, '').trim();
        const content = fields.content?.stringValue;

        if (cleanName && content) {
          const fileName = cleanName === 'notes' ? 'notes.md' : `${cleanName}.md`;
          fs.writeFileSync(path.join(dir, fileName), content, 'utf-8');
          if (cleanName === 'notes') {
            notesSynced = true;
          } else {
            profileCount++;
            if (!firstProfileName) {
              firstProfileName = cleanName;
            }
          }
        }
      }

      if (firstProfileName) {
        profileManager.setActiveProfile(firstProfileName);
      }

      this.saveSyncConfig(targetProject, syncKey);
      return { success: true, count: profileCount, notesSynced, total: profileCount + (notesSynced ? 1 : 0) };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message };
    }
  }

  private static httpRequest(urlStr: string, method: string, body?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body ? Buffer.byteLength(body) : 0,
        },
      };

      const req = https.request(options, (res) => {
        let resBody = '';
        res.on('data', (d) => (resBody += d));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(resBody);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${resBody}`));
          }
        });
      });

      req.on('error', (e) => reject(e));
      if (body) req.write(body);
      req.end();
    });
  }
}
