import fs from 'fs';
import path from 'path';
import os from 'os';
import { Artifact, ArtifactType } from '../types.js';

const ARTIFACTS_DIR = path.join(os.homedir(), '.antri', 'artifacts');

export class ArtifactManager {
  private baseDir: string;
  private artifacts: Map<string, Artifact> = new Map();

  constructor(customDir?: string) {
    this.baseDir = customDir || ARTIFACTS_DIR;
    this.ensureDirectory();
    this.loadIndex();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getIndexPath(): string {
    return path.join(this.baseDir, 'artifacts.json');
  }

  private loadIndex(): void {
    try {
      const indexPath = this.getIndexPath();
      if (fs.existsSync(indexPath)) {
        const raw = fs.readFileSync(indexPath, 'utf-8');
        const list: Artifact[] = JSON.parse(raw);
        this.artifacts.clear();
        for (const item of list) {
          this.artifacts.set(item.id, item);
        }
      }
    } catch {
      this.artifacts.clear();
    }
  }

  private persistIndex(): void {
    try {
      this.ensureDirectory();
      const list = Array.from(this.artifacts.values());
      fs.writeFileSync(this.getIndexPath(), JSON.stringify(list, null, 2), 'utf-8');
    } catch {}
  }

  public saveArtifact(artifact: Artifact): Artifact {
    this.ensureDirectory();
    this.artifacts.set(artifact.id, artifact);

    // Also write a standalone file for easy browser viewing
    try {
      const ext = artifact.type === 'html' ? 'html' : 'txt';
      const filePath = path.join(this.baseDir, `${artifact.id}.${ext}`);
      if (artifact.type === 'html') {
        fs.writeFileSync(filePath, artifact.content, 'utf-8');
      } else if (artifact.type === 'graph') {
        const htmlGraph = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${artifact.title}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
    .header { text-align: center; margin-bottom: 24px; }
    h1 { font-size: 20px; color: #818cf8; margin: 0 0 8px 0; }
    .badge { font-size: 12px; background: #1e1b4b; color: #a5b4fc; padding: 4px 10px; border-radius: 9999px; border: 1px solid #3730a3; }
    .mermaid-container { background: #1e293b; padding: 32px; border-radius: 12px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 100%; overflow: auto; }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">ANTRI Architecture Graph</span>
    <h1>${artifact.title}</h1>
  </div>
  <div class="mermaid-container">
    <pre class="mermaid">
${artifact.content.trim()}
    </pre>
  </div>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'dark', securityLevel: 'loose' });
  </script>
</body>
</html>`;
        fs.writeFileSync(path.join(this.baseDir, `${artifact.id}.html`), htmlGraph, 'utf-8');
      }
    } catch {}

    this.persistIndex();
    return artifact;
  }

  public getArtifact(id: string): Artifact | null {
    return this.artifacts.get(id) || null;
  }

  public getAllArtifacts(): Artifact[] {
    return Array.from(this.artifacts.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getArtifactsBySession(sessionId: string): Artifact[] {
    return this.getAllArtifacts().filter((a) => a.sessionId === sessionId);
  }

  public getArtifactsGroupedBySession(): Array<{ sessionId: string; sessionTitle: string; artifacts: Artifact[] }> {
    const all = this.getAllArtifacts();
    const groups = new Map<string, { sessionId: string; sessionTitle: string; artifacts: Artifact[] }>();

    for (const art of all) {
      const sId = art.sessionId || 'default';
      const sTitle = art.sessionTitle || 'General Chat';
      if (!groups.has(sId)) {
        groups.set(sId, { sessionId: sId, sessionTitle: sTitle, artifacts: [] });
      }
      groups.get(sId)!.artifacts.push(art);
    }

    return Array.from(groups.values());
  }

  public deleteArtifact(id: string): boolean {
    const existed = this.artifacts.delete(id);
    if (existed) {
      try {
        const htmlPath = path.join(this.baseDir, `${id}.html`);
        const txtPath = path.join(this.baseDir, `${id}.txt`);
        if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
        if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
      } catch {}
      this.persistIndex();
    }
    return existed;
  }

  public getArtifactFilePath(id: string): string | null {
    const htmlPath = path.join(this.baseDir, `${id}.html`);
    if (fs.existsSync(htmlPath)) return htmlPath;
    const txtPath = path.join(this.baseDir, `${id}.txt`);
    if (fs.existsSync(txtPath)) return txtPath;
    return null;
  }

  /**
   * Parses `<antri_artifact id="..." type="..." title="...">...</antri_artifact>`
   * blocks from text, saves them to store, and replaces them with a clean Markdown badge.
   */
  public parseAndStoreArtifacts(
    rawText: string,
    sessionId: string = 'session_' + Date.now(),
    sessionTitle: string = 'Chat Session'
  ): { cleanText: string; artifacts: Artifact[] } {
    const regex = /<antri_artifact\s+id="([^"]+)"\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/antri_artifact>/gi;
    const artifacts: Artifact[] = [];
    let cleanText = rawText;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(rawText)) !== null) {
      const id = match[1].trim();
      const type = (match[2].trim().toLowerCase() as ArtifactType) || 'html';
      const title = match[3].trim();
      const content = match[4].trim();

      const artifact: Artifact = {
        id,
        sessionId,
        sessionTitle,
        title,
        type,
        content,
        createdAt: Date.now(),
      };

      this.saveArtifact(artifact);
      artifacts.push(artifact);

      const typeLabel = type === 'graph' ? '📊 Code Architecture Graph' : '🌐 Interactive HTML Artifact';
      const badge = `\n\n> 🎨 **[Artifact Created: ${title}]**\n> Type: \`${typeLabel}\` · ID: \`${id}\`\n> Click **"View Artifact"** in the interface to launch.\n\n`;
      cleanText = cleanText.replace(match[0], badge);
    }

    return { cleanText, artifacts };
  }
}

export const artifactManager = new ArtifactManager();
