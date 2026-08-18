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
    const filePath = this.getSyncConfigFile();
    if (fs.existsSync(filePath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!cfg.projectId) cfg.projectId = 'antri-agentic-hackathon';
        return cfg;
      } catch (_) {}
    }
    return {
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'antri-agentic-hackathon',
      syncKey: 'default_user',
      apiKey: process.env.GEMINI_API_KEY || '',
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
  public static async pushToFirestore(): Promise<{ success: boolean; count: number; error?: string }> {
    const { projectId, syncKey, apiKey } = this.getSyncConfig();
    const targetProject = projectId || 'antri-agentic-hackathon';

    const profiles = profileManager.listProfiles();
    let synced = 0;
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
        synced++;
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
        synced++;
      } catch {}
    }

    this.saveSyncConfig(targetProject, syncKey, apiKey);
    return { success: true, count: synced };
  }

  /**
   * Pull profiles from Google Cloud Firestore to ~/.antri/profiles/
   */
  public static async pullFromFirestore(): Promise<{ success: boolean; count: number; error?: string }> {
    const { projectId, syncKey } = this.getSyncConfig();
    const targetProject = projectId || 'antri-agentic-hackathon';

    const url = `https://firestore.googleapis.com/v1/projects/${targetProject}/databases/(default)/documents/antri_sync/${syncKey}/profiles`;

    try {
      const raw = await this.httpRequest(url, 'GET');
      const data = JSON.parse(raw);
      const docs = data.documents || [];
      const dir = path.join(os.homedir(), '.antri', 'profiles');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      let count = 0;
      let firstProfileName = '';

      for (const doc of docs) {
        const fields = doc.fields || {};
        const name = fields.name?.stringValue;
        const content = fields.content?.stringValue;
        if (name && content) {
          fs.writeFileSync(path.join(dir, `${name}.md`), content, 'utf-8');
          count++;
          if (name !== 'notes' && !firstProfileName) {
            firstProfileName = name;
          }
        }
      }

      if (firstProfileName) {
        profileManager.setActiveProfile(firstProfileName);
      }

      this.saveSyncConfig(targetProject, syncKey);
      return { success: true, count };
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
