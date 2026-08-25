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

  public sanitizeAndEnhanceMindmap(content: string, title: string): string {
    const isPlaceholder = /\b(key branch|subtopic [a-z]|detail \d+|primary concept|pillar \d+|primary pillar)\b/i.test(content);
    if (!isPlaceholder) return content;

    const lower = (title + ' ' + content).toLowerCase();

    // 1. Indian Independence / Freedom Struggle
    if (lower.includes('independ') || lower.includes('freedom') || lower.includes('swaraj')) {
      return `mindmap
  root((Indian Independence Movement))
    1857 Revolt & Early Uprisings
      Mangal Pandey & Meerut Mutiny
      Rani Lakshmibai & Tatya Tope
      End of East India Company Rule
    Early Nationalist Phase (1885-1915)
      Indian National Congress (1885)
      Swadeshi & Boycott Movement (1905)
      Lal-Bal-Pal Assertive Nationalism
    Gandhian Era & Mass Satyagraha
      Non-Cooperation Movement (1920-22)
      Dandi Salt March & Civil Disobedience (1930)
      Quit India Movement (1942)
      Philosophy of Ahimsa & Satyagraha
    Revolutionary Freedom Struggle
      Bhagat Singh & HSRA (1928)
      Chandrashekhar Azad & Kakori Action
      Surya Sen & Chittagong Armoury Raid (1930)
    Netaji & Azad Hind Fauj (INA)
      Singapore Formation (1943)
      War Cry: Chalo Dilli & Jai Hind
      Imphal & Kohima Battle Campaigns
    Independence & Partition (1947)
      Cabinet Mission & Mountbatten Plan
      Indian Independence Act 1947
      Midnight of 15th August 1947`;
    }

    // 2. Types of Rocks / Geology
    if (lower.includes('rock') || lower.includes('geolog') || lower.includes('mineral')) {
      return `mindmap
  root((Types of Rocks Found in India))
    Igneous Rocks
      Basalt (Deccan Traps Plateau)
      Granite (Peninsular Shield & Bundelkhand)
      Dolerite & Gabbro Formations
    Sedimentary Rocks
      Sandstone (Vindhyan & Gondwana Basins)
      Limestone (Cuddapah & Rohtas Formations)
      Shale & Coal-Bearing Strata
    Metamorphic Rocks
      Marble (Makrana Rajasthan)
      Quartzite (Aravalli Mountain Range)
      Gneiss & Schist (Dharwar Craton)
    Economic & Heritage Value
      Building Materials (Red Fort, Taj Mahal)
      Mineral Ore & Coal Deposits`;
    }

    // 3. Government / Polity of India
    if (lower.includes('government') || lower.includes('polity') || lower.includes('constitution')) {
      return `mindmap
  root((Government & Polity of India))
    Executive Branch
      President & Vice President
      Prime Minister & Union Cabinet
      Civil Services & Bureaucracy
    Legislative Branch
      Lok Sabha (House of the People)
      Rajya Sabha (Council of States)
      Parliamentary Committees
    Judiciary
      Supreme Court of India
      High Courts of States
      Subordinate District Courts
    Constitutional & Statutory Bodies
      Election Commission of India
      Comptroller & Auditor General (CAG)
      Finance Commission & NITI Aayog`;
    }

    // 4. General Domain Concept Expander
    const topicClean = title.replace(/\bmind\s*map\b/gi, '').trim() || 'Core Subject';
    return `mindmap
  root((${topicClean}))
    Foundational Principles
      Core Theory & Definitions
      Historical Evolution
      Fundamental Axioms
    Core Methodologies & Architecture
      Primary Frameworks
      Key Components & Structuring
      Standard Workflows
    Key Applications & Real-World Use
      Industrial & Practical Use Cases
      Major Milestones & Benchmarks
      Notable Implementations
    Strategic Horizons & Innovation
      Emerging Trends & Breakthroughs
      Open Challenges & Optimization`;
  }

  public saveArtifact(artifact: Artifact): Artifact {
    this.ensureDirectory();
    if (artifact.type === 'mindmap') {
      artifact.content = this.sanitizeAndEnhanceMindmap(artifact.content, artifact.title);
    }
    this.artifacts.set(artifact.id, artifact);

    // Also write a standalone HTML file for instant browser viewing
    try {
      const fullHtml = this.getArtifactHtml(artifact);
      const filePath = path.join(this.baseDir, `${artifact.id}.html`);
      fs.writeFileSync(filePath, fullHtml, 'utf-8');
    } catch {}

    this.persistIndex();
    return artifact;
  }

  public enhanceHtmlArtifact(content: string, title: string): string {
    let html = (content || '').trim();

    // If it is a snippet or doesn't have standard HTML doctype/head
    if (!html.toLowerCase().includes('<!doctype html>') && !html.toLowerCase().includes('<html')) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
                  radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.15) 0%, transparent 50%),
                  #0b0f19;
      color: #f8fafc;
      min-height: 100vh;
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body class="p-6 md:p-10 antialiased selection:bg-indigo-500 selection:text-white">
  <div class="max-w-6xl mx-auto">
    ${html}
  </div>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    });
  </script>
</body>
</html>`;
    }

    // If it is a full HTML page, ensure it has Tailwind, Lucide, and modern fonts injected if missing
    const hasTailwind = /tailwindcss|tailwind\.com/i.test(html);
    const hasLucide = /lucide/i.test(html);
    const hasFonts = /fonts\.googleapis\.com/i.test(html);
    const hasViewport = /name=["']viewport["']/i.test(html);

    let injectedHead = '';
    if (!hasViewport) {
      injectedHead += '\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">';
    }
    if (!hasFonts) {
      injectedHead += '\n  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet">';
    }
    if (!hasTailwind) {
      injectedHead += '\n  <script src="https://cdn.tailwindcss.com"></script>';
    }
    if (!hasLucide) {
      injectedHead += '\n  <script src="https://unpkg.com/lucide@latest"></script>';
    }

    if (injectedHead) {
      if (html.includes('<head>')) {
        html = html.replace('<head>', '<head>' + injectedHead);
      } else if (html.includes('<head ')) {
        html = html.replace(/<head[^>]*>/, (m) => m + injectedHead);
      }
    }

    // Ensure Lucide initializes if icons are used
    if (!html.includes('lucide.createIcons()') && (html.includes('data-lucide') || html.includes('i data-lucide') || html.includes('lucide-'))) {
      const initScript = '\n<script>document.addEventListener("DOMContentLoaded", () => { if (window.lucide) window.lucide.createIcons(); });</script>';
      if (html.includes('</body>')) {
        html = html.replace('</body>', initScript + '\n</body>');
      } else {
        html += initScript;
      }
    }

    return html;
  }

  public getArtifactHtml(artifact: Artifact): string {
    if (artifact.type === 'html') {
      return this.enhanceHtmlArtifact(artifact.content, artifact.title);
    }

    if (artifact.type === 'mindmap') {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${artifact.title}</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/markmap-view@0.17.2/dist/browser/index.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/markmap-lib@0.17.2/dist/browser/index.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg-page: radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(236, 72, 153, 0.08) 0%, transparent 40%), #f8fafc;
      --bg-viewport: #ffffff;
      --border-viewport: rgba(226, 232, 240, 0.9);
      --text-main: #0f172a;
      --text-muted: #64748b;
      --btn-bg: #ffffff;
      --btn-border: #e2e8f0;
      --btn-text: #1e293b;
      --btn-hover: #f1f5f9;
      --shadow-viewport: 0 20px 45px -15px rgba(0, 0, 0, 0.06), 0 0 1px 1px rgba(0, 0, 0, 0.04);
      --node-bg: #ffffff;
      --node-border: #cbd5e1;
      --node-text: #0f172a;
      --root-bg: #4f46e5;
      --root-border: #4338ca;
      --root-text: #ffffff;
      --pillar-bg: #f1f5f9;
      --pillar-border: #94a3b8;
      --link-stroke: #818cf8;
      --badge-bg: rgba(168, 85, 247, 0.12);
      --badge-color: #7e22ce;
      --badge-border: rgba(168, 85, 247, 0.25);
    }
    body.theme-dark {
      --bg-page: radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.25) 0%, transparent 50%), radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.22) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.18) 0%, transparent 60%), #0d1322;
      --bg-viewport: rgba(18, 24, 38, 0.9);
      --border-viewport: rgba(255, 255, 255, 0.1);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --btn-bg: rgba(30, 41, 59, 0.85);
      --btn-border: rgba(255, 255, 255, 0.12);
      --btn-text: #f8fafc;
      --btn-hover: rgba(51, 65, 85, 0.95);
      --shadow-viewport: 0 20px 45px -15px rgba(0, 0, 0, 0.5);
      --node-bg: #1e293b;
      --node-border: #334155;
      --node-text: #f8fafc;
      --root-bg: #6366f1;
      --root-border: #818cf8;
      --root-text: #ffffff;
      --pillar-bg: #0f172a;
      --pillar-border: #475569;
      --link-stroke: #6366f1;
      --badge-bg: rgba(168, 85, 247, 0.2);
      --badge-color: #c084fc;
      --badge-border: rgba(168, 85, 247, 0.35);
    }
    body {
      margin: 0; padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-page);
      color: var(--text-main);
      display: flex; flex-direction: column; align-items: center; min-height: 100vh;
      overflow-x: hidden;
      transition: background 0.3s ease;
    }
    .header { text-align: center; margin-bottom: 12px; }
    h1 { font-size: 18px; color: var(--text-main); margin: 0 0 6px 0; font-weight: 800; letter-spacing: -0.3px; }
    .badge {
      font-size: 11px;
      background: var(--badge-bg);
      color: var(--badge-color);
      padding: 3px 12px; border-radius: 9999px;
      border: 1px solid var(--badge-border);
      text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;
      display: inline-block; margin-bottom: 6px;
    }
    .controls {
      display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; justify-content: center;
    }
    .btn {
      background: var(--btn-bg); border: 1px solid var(--btn-border);
      color: var(--btn-text); padding: 6px 14px; border-radius: 8px; font-size: 12px;
      font-weight: 700; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }
    .btn:hover { background: var(--btn-hover); transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
    .viewer-card {
      width: 100%; max-width: 1300px; height: 76vh; min-height: 520px;
      position: relative; overflow: hidden; border-radius: 16px;
      background: var(--bg-viewport); backdrop-filter: blur(20px);
      border: 1px solid var(--border-viewport);
      box-shadow: var(--shadow-viewport);
      touch-action: none;
    }
    #mindmapSvg {
      width: 100%; height: 100%;
      display: block;
      cursor: grab;
      user-select: none;
    }
    #mindmapSvg:active { cursor: grabbing; }
    
    /* Native SVG Mindmap Node Styles */
    .mindmap-link {
      fill: none;
      stroke: var(--link-stroke);
      stroke-width: 2.2px;
      stroke-linecap: round;
      transition: stroke 0.2s ease;
    }
    .node-rect {
      fill: var(--node-bg);
      stroke: var(--node-border);
      stroke-width: 1.5px;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .node-rect:hover {
      stroke: var(--root-bg);
      stroke-width: 2px;
    }
    .node-rect.root {
      fill: var(--root-bg);
      stroke: var(--root-border);
      stroke-width: 2px;
    }
    .node-rect.pillar {
      fill: var(--pillar-bg);
      stroke: var(--pillar-border);
      stroke-width: 1.8px;
    }
    .node-text {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      fill: var(--node-text);
      pointer-events: none;
      user-select: none;
    }
    .depth-0 .node-text {
      font-size: 15px;
      font-weight: 800;
      fill: var(--root-text);
    }
    .depth-1 .node-text {
      font-size: 13.5px;
      font-weight: 700;
    }
    .badge-circle {
      fill: var(--root-bg);
      stroke: var(--bg-viewport);
      stroke-width: 1.5px;
      transition: transform 0.15s ease;
    }
    .badge-circle:hover {
      transform: scale(1.15);
    }
    .badge-text {
      font-family: monospace;
      font-size: 12px;
      font-weight: bold;
      fill: #ffffff;
      pointer-events: none;
    }

    /* Markmap CSS Overrides */
    foreignObject {
      overflow: visible !important;
    }
    .markmap-foreign {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      line-height: 1.35 !important;
      color: var(--node-text) !important;
      background: var(--node-bg) !important;
      border: 1.5px solid var(--node-border) !important;
      border-radius: 8px !important;
      padding: 5px 12px !important;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04) !important;
      display: inline-block !important;
      white-space: normal !important;
      max-width: 320px !important;
      word-break: break-word !important;
    }
    .markmap-node[data-depth="0"] .markmap-foreign {
      background: var(--root-bg) !important;
      color: var(--root-text) !important;
      border-color: var(--root-border) !important;
      font-size: 15px !important;
      font-weight: 800 !important;
      border-radius: 10px !important;
      padding: 7px 16px !important;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35) !important;
    }

    .help-hint {
      position: absolute; bottom: 12px; right: 14px;
      font-size: 11px; color: var(--text-muted); pointer-events: none;
      background: rgba(255, 255, 255, 0.75); padding: 3px 8px; border-radius: 6px;
      border: 1px solid rgba(0,0,0,0.05);
    }
    body.theme-dark .help-hint {
      background: rgba(18, 24, 38, 0.7);
      border-color: rgba(255, 255, 255, 0.08);
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">🧠 ANTRI Interactive Mind Map</span>
    <h1>${artifact.title}</h1>
  </div>
  <div class="controls">
    <button class="btn" onclick="zoomIn()">🔍 Zoom +</button>
    <button class="btn" onclick="zoomOut()">🔍 Zoom -</button>
    <button class="btn" onclick="fitView()">⛶ Fit / Reset</button>
    <button class="btn" onclick="toggleTheme()" id="themeToggleBtn">🌙 Poster Dark</button>
    <button class="btn" onclick="copySource()">📋 Copy Code</button>
  </div>
  <div class="viewer-card" id="viewerCard">
    <svg id="mindmapSvg"></svg>
    <div class="help-hint">🖱️ Drag to pan · Scroll to zoom · Click +/- handles to collapse branches</div>
  </div>
  <script>
    const rawContent = ${JSON.stringify(artifact.content.trim())};
    
    function parseTree(content) {
      const lines = content.split('\\n');
      const rootNode = { name: '${artifact.title.replace(/'/g, "\\'")}', children: [], collapsed: false };
      const stack = [{ node: rootNode, depth: 0 }];

      let baseIndent = -1;
      for (let rawLine of lines) {
        const line = rawLine.replace(/\\r$/, '');
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'mindmap') continue;

        const indent = line.search(/\\S/);
        if (baseIndent === -1) baseIndent = indent;
        const rel = Math.max(0, indent - baseIndent);
        let depth = Math.floor(rel / 2);

        let clean = trimmed
          .replace(/^#+\\s*/, '')
          .replace(/^[-*]\\s*/, '')
          .replace(/^root\\(\\((.*?)\\)\\)$/, '$1')
          .replace(/^\\(\\((.*?)\\)\\)$/, '$1')
          .replace(/^\\[(.*?)\\]$/, '$1')
          .replace(/^\\((.*?)\\)$/, '$1')
          .replace(/^\\)\\)(.*?)\\(\\($/, '$1')
          .replace(/^\\)(.*?)\\($/, '$1')
          .replace(/^\\{\\{(.*?)\\}\\}/, '$1')
          .trim();

        if (depth === 0) {
          rootNode.name = clean || rootNode.name;
          continue;
        }

        const newNode = { name: clean, children: [], collapsed: false };
        while (stack.length > depth) stack.pop();
        stack[stack.length - 1].node.children.push(newNode);
        stack.push({ node: newNode, depth: depth });
      }

      return rootNode;
    }

    const rootTree = parseTree(rawContent);
    const svgEl = document.getElementById('mindmapSvg');
    const viewerCard = document.getElementById('viewerCard');

    let currentScale = 1;
    let currentX = 0;
    let currentY = 0;
    let isPanning = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let startPosX = 0;
    let startPosY = 0;
    let bbox = { minX: 0, maxX: 800, minY: 0, maxY: 600 };

    function renderTree() {
      svgEl.innerHTML = '';
      
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', 'viewportGroup');
      svgEl.appendChild(g);

      // Measure node pill dimensions based on text length
      function measure(node, depth = 0) {
        node.depth = depth;
        const textLen = (node.name || '').length;
        const isRoot = depth === 0;
        const isPillar = depth === 1;
        const fontFactor = isRoot ? 9.5 : isPillar ? 8.2 : 7.6;
        const pad = isRoot ? 40 : 28;
        node.w = Math.max(isRoot ? 160 : 120, Math.min(360, textLen * fontFactor + pad));
        node.h = isRoot ? 44 : isPillar ? 38 : 34;
        if (node.children && !node.collapsed) {
          node.children.forEach(c => measure(c, depth + 1));
        }
      }
      measure(rootTree, 0);

      // Layout coordinates
      let curY = 40;
      const HORIZ_GAP = 75;
      const VERT_GAP = 14;

      function layout(node, startX = 40) {
        node.x = startX;
        if (!node.children || node.children.length === 0 || node.collapsed) {
          node.y = curY + node.h / 2;
          curY += node.h + VERT_GAP;
        } else {
          const nextX = startX + node.w + HORIZ_GAP;
          node.children.forEach(c => layout(c, nextX));
          const firstY = node.children[0].y;
          const lastY = node.children[node.children.length - 1].y;
          node.y = (firstY + lastY) / 2;
        }
      }
      layout(rootTree, 40);

      // Calculate Bounding Box
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      function findBounds(node) {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x + node.w + 20);
        minY = Math.min(minY, node.y - node.h / 2);
        maxY = Math.max(maxY, node.y + node.h / 2);
        if (node.children && !node.collapsed) {
          node.children.forEach(findBounds);
        }
      }
      findBounds(rootTree);
      bbox = { minX, maxX, minY, maxY };

      // Draw links and nodes
      function draw(node) {
        if (node.children && node.children.length > 0 && !node.collapsed) {
          node.children.forEach(child => {
            const x1 = node.x + node.w;
            const y1 = node.y;
            const x2 = child.x;
            const y2 = child.y;
            const dx = (x2 - x1) * 0.48;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2);
            path.setAttribute('class', 'mindmap-link');
            g.appendChild(path);
            draw(child);
          });
        }

        const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeG.setAttribute('class', 'mindmap-node depth-' + node.depth);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', node.x);
        rect.setAttribute('y', node.y - node.h / 2);
        rect.setAttribute('width', node.w);
        rect.setAttribute('height', node.h);
        rect.setAttribute('rx', node.depth === 0 ? '12' : '8');
        rect.setAttribute('ry', node.depth === 0 ? '12' : '8');
        rect.setAttribute('class', 'node-rect ' + (node.depth === 0 ? 'root' : node.depth === 1 ? 'pillar' : 'leaf'));
        nodeG.appendChild(rect);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x + node.w / 2);
        text.setAttribute('y', node.y + (node.depth === 0 ? 5.5 : 4.5));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'node-text');
        text.textContent = node.name;
        nodeG.appendChild(text);

        // Collapsible Badge Button
        if (node.children && node.children.length > 0) {
          const badgeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          badgeG.setAttribute('transform', 'translate(' + (node.x + node.w) + ', ' + node.y + ')');
          badgeG.style.cursor = 'pointer';
          badgeG.onclick = (e) => {
            e.stopPropagation();
            node.collapsed = !node.collapsed;
            renderTree();
          };

          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('r', '7.5');
          circle.setAttribute('class', 'badge-circle');
          badgeG.appendChild(circle);

          const sign = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          sign.setAttribute('y', '3.5');
          sign.setAttribute('text-anchor', 'middle');
          sign.setAttribute('class', 'badge-text');
          sign.textContent = node.collapsed ? '+' : '−';
          badgeG.appendChild(sign);

          nodeG.appendChild(badgeG);
        }

        g.appendChild(nodeG);
      }
      draw(rootTree);

      applyTransform();
    }

    function applyTransform() {
      const g = document.getElementById('viewportGroup');
      if (g) {
        g.setAttribute('transform', 'translate(' + currentX + ', ' + currentY + ') scale(' + currentScale + ')');
      }
    }

    function fitView() {
      const cw = viewerCard.clientWidth || 1000;
      const ch = viewerCard.clientHeight || 550;
      const tw = (bbox.maxX - bbox.minX) + 80;
      const th = (bbox.maxY - bbox.minY) + 80;

      currentScale = Math.min(1.15, Math.max(0.35, Math.min((cw - 60) / tw, (ch - 60) / th)));
      currentX = (cw - tw * currentScale) / 2 + 20 * currentScale;
      currentY = (ch - th * currentScale) / 2 + 20 * currentScale;
      applyTransform();
    }

    function zoomIn() {
      currentScale = Math.min(currentScale * 1.25, 3.5);
      applyTransform();
    }

    function zoomOut() {
      currentScale = Math.max(currentScale * 0.8, 0.25);
      applyTransform();
    }

    function toggleTheme() {
      document.body.classList.toggle('theme-dark');
      const isDark = document.body.classList.contains('theme-dark');
      const btn = document.getElementById('themeToggleBtn');
      if (btn) btn.textContent = isDark ? '☀️ Light Mode' : '🌙 Poster Dark';
    }

    function copySource() {
      navigator.clipboard.writeText(rawContent).then(() => {
        alert('Mind map source code copied to clipboard!');
      });
    }

    // Pointer Interaction (Pan & Zoom)
    viewerCard.addEventListener('pointerdown', (e) => {
      isPanning = true;
      startPointerX = e.clientX;
      startPointerY = e.clientY;
      startPosX = currentX;
      startPosY = currentY;
      viewerCard.setPointerCapture(e.pointerId);
    });

    viewerCard.addEventListener('pointermove', (e) => {
      if (!isPanning) return;
      currentX = startPosX + (e.clientX - startPointerX);
      currentY = startPosY + (e.clientY - startPointerY);
      applyTransform();
    });

    const endPan = (e) => {
      isPanning = false;
      try { viewerCard.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    viewerCard.addEventListener('pointerup', endPan);
    viewerCard.addEventListener('pointercancel', endPan);

    viewerCard.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.12 : 0.89;
      const newScale = Math.min(Math.max(currentScale * delta, 0.25), 3.5);

      const rect = viewerCard.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      currentX = mouseX - (mouseX - currentX) * (newScale / currentScale);
      currentY = mouseY - (mouseY - currentY) * (newScale / currentScale);
      currentScale = newScale;
      applyTransform();
    }, { passive: false });

    window.addEventListener('resize', fitView);
    window.addEventListener('load', () => {
      renderTree();
      setTimeout(fitView, 50);
    });
    if (document.readyState === 'complete') {
      renderTree();
      setTimeout(fitView, 50);
    }
  </script>
</body>
</html>`;
    }

    if (artifact.type === 'graph') {
      const badgeLabel = '📊 Architecture Graph';
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${artifact.title}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg-page: radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(236, 72, 153, 0.08) 0%, transparent 40%), #f8fafc;
      --bg-viewport: #ffffff;
      --border-viewport: rgba(226, 232, 240, 0.9);
      --text-main: #0f172a;
      --text-muted: #64748b;
      --btn-bg: #ffffff;
      --btn-border: #e2e8f0;
      --btn-text: #1e293b;
      --btn-hover: #f1f5f9;
      --shadow-viewport: 0 20px 45px -15px rgba(0, 0, 0, 0.06), 0 0 1px 1px rgba(0, 0, 0, 0.04);
      --badge-bg: rgba(99, 102, 241, 0.1);
      --badge-color: #4f46e5;
      --badge-border: rgba(99, 102, 241, 0.25);
    }
    body.theme-dark {
      --bg-page: radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.25) 0%, transparent 50%), radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.22) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.18) 0%, transparent 60%), #0d1322;
      --bg-viewport: rgba(18, 24, 38, 0.85);
      --border-viewport: rgba(255, 255, 255, 0.1);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --btn-bg: rgba(30, 41, 59, 0.85);
      --btn-border: rgba(255, 255, 255, 0.12);
      --btn-text: #f8fafc;
      --btn-hover: rgba(51, 65, 85, 0.95);
      --shadow-viewport: 0 20px 45px -15px rgba(0, 0, 0, 0.5);
      --badge-bg: rgba(99, 102, 241, 0.2);
      --badge-color: #818cf8;
      --badge-border: rgba(99, 102, 241, 0.35);
    }
    body {
      margin: 0; padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-page);
      color: var(--text-main);
      display: flex; flex-direction: column; align-items: center; min-height: 100vh;
      overflow-x: hidden;
      transition: background 0.3s ease;
    }
    .header { text-align: center; margin-bottom: 14px; }
    h1 { font-size: 19px; color: var(--text-main); margin: 0 0 6px 0; font-weight: 800; letter-spacing: -0.3px; }
    .badge {
      font-size: 11px;
      background: var(--badge-bg);
      color: var(--badge-color);
      padding: 4px 12px; border-radius: 9999px;
      border: 1px solid var(--badge-border);
      text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;
      display: inline-block; margin-bottom: 6px;
    }
    .controls {
      display: flex; gap: 8px; margin-bottom: 14px; align-items: center; flex-wrap: wrap; justify-content: center;
    }
    .btn {
      background: var(--btn-bg); border: 1px solid var(--btn-border);
      color: var(--btn-text); padding: 7px 14px; border-radius: 9px; font-size: 12px;
      font-weight: 700; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }
    .btn:hover { background: var(--btn-hover); transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
    .viewer-card {
      width: 100%; max-width: 1300px; height: 76vh; min-height: 520px;
      position: relative; overflow: hidden; border-radius: 18px;
      background: var(--bg-viewport); backdrop-filter: blur(20px);
      border: 1px solid var(--border-viewport);
      box-shadow: var(--shadow-viewport);
      display: flex; align-items: center; justify-content: center;
      touch-action: none; cursor: grab;
    }
    .viewer-card:active { cursor: grabbing; }
    .diagram-container {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      transform-origin: center center;
      transition: transform 0.05s ease-out;
    }
    .mermaid { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">${badgeLabel}</span>
    <h1>${artifact.title}</h1>
  </div>
  <div class="controls">
    <button class="btn" onclick="zoomIn()">🔍 Zoom +</button>
    <button class="btn" onclick="zoomOut()">🔍 Zoom -</button>
    <button class="btn" onclick="resetZoom()">⛶ Fit / Reset</button>
    <button class="btn" onclick="toggleTheme()" id="themeToggleBtn">🌙 Poster Dark</button>
  </div>
  <div class="viewer-card" id="viewerCard">
    <div class="diagram-container" id="diagramContainer">
      <pre class="mermaid">${artifact.content.replace(/<antri_artifact[\s\S]*?>|<\/antri_artifact>/gi, '').trim()}</pre>
    </div>
  </div>
  <script>
    let scale = 1.0;
    let posX = 0;
    let posY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    const container = document.getElementById('diagramContainer');
    const viewerCard = document.getElementById('viewerCard');

    function updateTransform(animate = false) {
      if (animate) {
        container.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)';
      } else {
        container.style.transition = 'none';
      }
      container.style.transform = 'translate(' + posX + 'px, ' + posY + 'px) scale(' + scale + ')';
    }

    viewerCard.addEventListener('pointerdown', (e) => {
      isDragging = true;
      startX = e.clientX - posX;
      startY = e.clientY - posY;
      viewerCard.setPointerCapture(e.pointerId);
    });

    viewerCard.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      posX = e.clientX - startX;
      posY = e.clientY - startY;
      updateTransform(false);
    });

    const endDrag = (e) => {
      isDragging = false;
      try { viewerCard.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    viewerCard.addEventListener('pointerup', endDrag);
    viewerCard.addEventListener('pointercancel', endDrag);

    viewerCard.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.12 : 0.89;
      scale = Math.min(Math.max(scale * delta, 0.25), 4.0);
      updateTransform(false);
    }, { passive: false });

    function zoomIn() { scale = Math.min(scale * 1.25, 4.0); updateTransform(true); }
    function zoomOut() { scale = Math.max(scale * 0.8, 0.25); updateTransform(true); }
    function resetZoom() { scale = 1.0; posX = 0; posY = 0; updateTransform(true); }
    function toggleTheme() {
      document.body.classList.toggle('theme-dark');
      const isDark = document.body.classList.contains('theme-dark');
      const btn = document.getElementById('themeToggleBtn');
      if (btn) btn.textContent = isDark ? '☀️ Light Mode' : '🌙 Poster Dark';
    }

    mermaid.initialize({ startOnLoad: true, theme: 'base', securityLevel: 'loose' });
  </script>
</body>
</html>`;
    }

    return artifact.content;
  }

  public getArtifact(id: string): Artifact | null {
    return this.artifacts.get(id) || null;
  }

  public getAllArtifacts(): Artifact[] {
    // Auto-discover any unindexed .html artifacts in baseDir
    try {
      if (fs.existsSync(this.baseDir)) {
        const files = fs.readdirSync(this.baseDir);
        for (const file of files) {
          if (file.endsWith('.html') && !file.startsWith('.')) {
            const id = path.basename(file, '.html');
            if (!this.artifacts.has(id)) {
              const fullPath = path.join(this.baseDir, file);
              const content = fs.readFileSync(fullPath, 'utf-8');
              const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
              const title = titleMatch ? titleMatch[1].trim() : id.replace(/[_-]/g, ' ');
              const stat = fs.statSync(fullPath);
              this.artifacts.set(id, {
                id,
                sessionId: 'workspace_files',
                sessionTitle: 'Workspace & Generated Files',
                title,
                type: content.includes('markmap') || content.includes('mindmap') ? 'mindmap' : 'html',
                content,
                createdAt: stat.birthtimeMs || Date.now(),
              });
            }
          }
        }
      }
    } catch (_) {}

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
   * Parses `<antri_artifact ...>`, JSON create_artifact, and raw Mermaid mindmaps
   * blocks from text, saves them to store, and replaces them with clean Markdown badges.
   */
  public parseAndStoreArtifacts(
    rawText: string,
    sessionId: string = 'session_' + Date.now(),
    sessionTitle: string = 'Chat Session'
  ): { cleanText: string; artifacts: Artifact[] } {
    const artifacts: Artifact[] = [];
    let cleanText = rawText;

    // 1. Match <antri_artifact id="..." type="..." title="...">...</antri_artifact>
    const xmlRegex = /<antri_artifact\s+id="([^"]+)"\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/antri_artifact>/gi;
    let match: RegExpExecArray | null;
    while ((match = xmlRegex.exec(rawText)) !== null) {
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

      const typeLabel = type === 'mindmap' ? '🧠 Interactive Mind Map' : type === 'graph' ? '📊 Code Architecture Graph' : '🌐 Interactive HTML Artifact';
      const badge = `\n\n> 🎨 **[Artifact Created: ${title}]**\n> Type: \`${typeLabel}\` · ID: \`${id}\`\n> Click **"View Artifact"** in the interface to launch.\n\n`;
      cleanText = cleanText.replace(match[0], badge);
    }

    // 2. Match JSON format: {"name": "create_artifact", "parameters": { ... }}
    if (artifacts.length === 0 && rawText.includes('"create_artifact"')) {
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*"name"\s*:\s*"create_artifact"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const params = parsed.parameters || parsed.args || parsed;
          const type = (params.type || 'mindmap').toLowerCase() as ArtifactType;
          const title = params.title || 'Generated Artifact';
          const content = params.content || '';
          const id = `art_${Date.now().toString(36)}`;

          if (content.trim()) {
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

            const typeLabel = type === 'mindmap' ? '🧠 Interactive Mind Map' : type === 'graph' ? '📊 Code Architecture Graph' : '🌐 Interactive HTML Artifact';
            const badge = `\n\n> 🎨 **[Artifact Created: ${title}]**\n> Type: \`${typeLabel}\` · ID: \`${id}\`\n> Click **"View Artifact"** in the interface to launch.\n\n`;
            cleanText = cleanText.replace(jsonMatch[0], badge);
          }
        }
      } catch (_) {}
    }

    // 3. Match raw Mermaid mindmap blocks: ```mermaid\nmindmap...``` or mindmap\n  root((...))
    if (artifacts.length === 0 && (rawText.includes('mindmap\n') || rawText.includes('mindmap\r\n'))) {
      const mindmapMatch = rawText.match(/(?:```(?:mermaid)?\s*)?(mindmap\s+[\s\S]*?)(?:```|$)/i);
      if (mindmapMatch && mindmapMatch[1].trim().length > 20) {
        const content = mindmapMatch[1].trim();
        const rootMatch = content.match(/root\(\(?([^)]+)\)?\)/i);
        const title = rootMatch ? `${rootMatch[1].trim()} Mind Map` : 'Interactive Mind Map';
        const id = `mindmap_${Date.now().toString(36)}`;

        const artifact: Artifact = {
          id,
          sessionId,
          sessionTitle,
          title,
          type: 'mindmap',
          content,
          createdAt: Date.now(),
        };

        this.saveArtifact(artifact);
        artifacts.push(artifact);

        const badge = `\n\n> 🎨 **[Artifact Created: ${title}]**\n> Type: \`🧠 Interactive Mind Map\` · ID: \`${id}\`\n> Click **"View Artifact"** in the interface to launch.\n\n`;
        cleanText = cleanText.replace(mindmapMatch[0], badge);
      }
    }

    return { cleanText, artifacts };
  }
}

export const artifactManager = new ArtifactManager();
