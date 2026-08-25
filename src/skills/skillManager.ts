import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

export interface MarkdownSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  triggers: string[];
  author: string;
  version: string;
  isCore: boolean;
  filePath: string;
  content: string;
  instructions: string;
  lastModified: number;
}

const USER_SKILLS_DIR = path.join(os.homedir(), '.antri', 'skills');

export class SkillManager {
  private skillsDir: string;
  private workspaceSkillsDir: string | null = null;
  private skillsCache: Map<string, MarkdownSkill> = new Map();

  constructor(customDir?: string) {
    this.skillsDir = customDir || USER_SKILLS_DIR;
    this.ensureDirectories();
    this.seedCoreSkills();
    this.reloadSkills();
  }

  public setWorkspaceDir(workingDir: string): void {
    const wsSkills = path.join(workingDir, '.antri', 'skills');
    if (fs.existsSync(wsSkills)) {
      this.workspaceSkillsDir = wsSkills;
    } else {
      this.workspaceSkillsDir = null;
    }
    this.reloadSkills();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }
  }

  /**
   * Seed core markdown skills into ~/.antri/skills/ if they don't exist yet
   */
  private seedCoreSkills(): void {
    this.ensureDirectories();
    const coreDefinitions = SkillManager.getCoreSkillTemplates();

    for (const [filename, content] of Object.entries(coreDefinitions)) {
      const targetPath = path.join(this.skillsDir, filename);
      try {
        fs.writeFileSync(targetPath, content, 'utf-8');
      } catch {}
    }
  }

  /**
   * Reload all .md skills from disk (user directory + workspace directory)
   */
  public reloadSkills(): MarkdownSkill[] {
    this.skillsCache.clear();
    this.ensureDirectories();

    const searchDirs = [this.skillsDir];
    if (this.workspaceSkillsDir && fs.existsSync(this.workspaceSkillsDir)) {
      searchDirs.push(this.workspaceSkillsDir);
    }

    for (const dir of searchDirs) {
      try {
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
        for (const file of files) {
          const filePath = path.join(dir, file);
          const skill = this.parseSkillFile(filePath);
          if (skill) {
            this.skillsCache.set(skill.id, skill);
          }
        }
      } catch {}
    }

    return Array.from(this.skillsCache.values());
  }

  /**
   * Parse a .md skill file extracting YAML/Header metadata and markdown instructions
   */
  public parseSkillFile(filePath: string): MarkdownSkill | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const filename = path.basename(filePath);
      const fallbackId = filename.replace(/\.md$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const stat = fs.statSync(filePath);

      let name = fallbackId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      let description = 'Custom markdown skill.';
      let category = 'General';
      let triggers: string[] = [];
      let author = 'Community';
      let version = '1.0.0';
      let instructions = content;

      // Check for YAML Frontmatter (--- ... ---)
      if (content.startsWith('---')) {
        const endMarker = content.indexOf('---', 3);
        if (endMarker !== -1) {
          const frontmatter = content.slice(3, endMarker).trim();
          instructions = content.slice(endMarker + 3).trim();

          const lines = frontmatter.split('\n');
          for (const line of lines) {
            const colonIdx = line.indexOf(':');
            if (colonIdx === -1) continue;
            const key = line.slice(0, colonIdx).trim().toLowerCase();
            const val = line.slice(colonIdx + 1).trim();

            if (key === 'name') name = val.replace(/^['"]|['"]$/g, '');
            else if (key === 'description') description = val.replace(/^['"]|['"]$/g, '');
            else if (key === 'category') category = val.replace(/^['"]|['"]$/g, '');
            else if (key === 'author') author = val.replace(/^['"]|['"]$/g, '');
            else if (key === 'version') version = val.replace(/^['"]|['"]$/g, '');
            else if (key === 'triggers') {
              triggers = val
                .split(',')
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean);
            }
          }
        }
      } else {
        // Look for markdown header # Title and first paragraph description
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('# ')) {
            name = line.slice(2).trim();
          } else if (line && !description && !line.startsWith('#')) {
            description = line.slice(0, 150);
          }
        }
      }

      const isCore = ['autonomous_coder', 'artifact_maker', 'code_reviewer', 'system_architect', 'root_cause_debugger', 'api_designer', 'security_auditor', 'database_designer', 'performance_optimizer', 'test_automator', 'ui_ux_architect', 'git_devops_specialist', 'documentation_writer', 'refactoring_specialist'].includes(fallbackId);

      return {
        id: fallbackId,
        name,
        description,
        category,
        triggers,
        author: isCore ? 'ANTRI Core' : author,
        version,
        isCore,
        filePath,
        content,
        instructions,
        lastModified: stat.mtimeMs,
      };
    } catch {
      return null;
    }
  }

  public listSkills(): MarkdownSkill[] {
    return Array.from(this.skillsCache.values()).sort((a, b) => {
      if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  public getSkill(idOrName: string): MarkdownSkill | undefined {
    const cleanId = idOrName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (this.skillsCache.has(cleanId)) {
      return this.skillsCache.get(cleanId);
    }
    // Search by name match
    for (const skill of this.skillsCache.values()) {
      if (skill.name.toLowerCase() === idOrName.toLowerCase() || skill.id === cleanId) {
        return skill;
      }
    }
    return undefined;
  }

  /**
   * Creates a new markdown skill file in ~/.antri/skills/
   */
  public createSkill(
    name: string,
    description: string,
    category: string = 'Custom',
    triggers: string[] = [],
    customInstructions?: string
  ): MarkdownSkill {
    this.ensureDirectories();
    const cleanId = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_').trim() || `skill_${Date.now()}`;
    const filePath = path.join(this.skillsDir, `${cleanId}.md`);

    const triggerStr = triggers.length > 0 ? triggers.join(', ') : `${name.toLowerCase()}, ${cleanId}`;
    const defaultInstructions = customInstructions || `# ⚡ ${name} Skill\n\n## 🎯 Purpose & Scope\n${description}\n\n## 📋 Execution Guidelines\n1. Analyze requirements carefully.\n2. Follow best practices and domain standards.\n3. Provide clean, modular, production-ready solutions with explanations.\n\n## 💡 Key Heuristics & Rules\n- Maintain clean architecture and explicit type safety.\n- Validate edge cases and handle error conditions gracefully.\n`;

    const fullContent = `---
name: ${name}
id: ${cleanId}
description: ${description}
category: ${category}
triggers: ${triggerStr}
author: User
version: 1.0.0
---

${defaultInstructions}
`;

    fs.writeFileSync(filePath, fullContent, 'utf-8');
    const skill = this.parseSkillFile(filePath)!;
    this.skillsCache.set(cleanId, skill);
    return skill;
  }

  /**
   * Imports an existing .md file or content as a skill
   */
  public importSkill(name: string, content: string): MarkdownSkill {
    this.ensureDirectories();
    const cleanId = name.toLowerCase().replace(/\.md$/, '').replace(/[^a-z0-9_-]/g, '_').trim() || `skill_${Date.now()}`;
    const filePath = path.join(this.skillsDir, `${cleanId}.md`);

    fs.writeFileSync(filePath, content, 'utf-8');
    const skill = this.parseSkillFile(filePath)!;
    this.skillsCache.set(cleanId, skill);
    return skill;
  }

  /**
   * Saves updated content for an existing skill
   */
  public saveSkill(id: string, content: string): boolean {
    const skill = this.getSkill(id);
    if (!skill) return false;

    try {
      fs.writeFileSync(skill.filePath, content, 'utf-8');
      const updated = this.parseSkillFile(skill.filePath);
      if (updated) {
        this.skillsCache.set(updated.id, updated);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Deletes a custom skill file
   */
  public deleteSkill(id: string): boolean {
    const skill = this.getSkill(id);
    if (!skill) return false;

    try {
      if (fs.existsSync(skill.filePath)) {
        fs.unlinkSync(skill.filePath);
      }
      this.skillsCache.delete(skill.id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Finds relevant skills that match a user prompt or task query
   */
  public findRelevantSkills(userPrompt: string): MarkdownSkill[] {
    const lower = userPrompt.toLowerCase();
    const matches: MarkdownSkill[] = [];

    for (const skill of this.skillsCache.values()) {
      // 1. Direct trigger match
      const triggerMatch = skill.triggers.some((t) => t && lower.includes(t));
      // 2. Name or ID match
      const nameMatch = lower.includes(skill.name.toLowerCase()) || lower.includes(skill.id.replace(/_/g, ' '));

      if (triggerMatch || nameMatch) {
        matches.push(skill);
      }
    }

    return matches.slice(0, 3); // Top 3 relevant skills
  }
public static getCoreSkillTemplates(): Record<string, string> {
    return {
      'artifact_maker.md': `---
name: Visual Artifact & Interactive App Architect
id: artifact_maker
description: Elite Creative UI/UX Engineer & Interactive Artifact Specialist who crafts breathtaking standalone SPAs, animated dashboards, visual concept models, and rich interactive tools with zero shortcuts.
category: UI/UX & Visuals
triggers: artifact, make artifact, create artifact, /view, /artifacts, /imagine, /mindmap, /arch, visual app, interactive demo, standalone spa, markmap, diagram
author: ANTRI Core
version: 2.0.0
---

# 🎨 Visual Artifact & Interactive App Architect Skill

## 🎯 Role & Mission
You are an Elite Creative UI/UX Engineer, Motion Designer, and Frontend Architect specializing in crafting magnificent, standalone Single-Page Applications (SPAs), animated dashboards, visual concept models, and mindmaps.

When visual previews, artifacts, or standalone prototypes are requested:
1. **🧠 Phase 1: Visual Design & Architecture Blueprint (Never Rush to Short Code)**:
   - Take all the time needed to build a comprehensive, multi-section, highly polished application (300+ to 600+ lines of complete HTML/CSS/JS).
   - Conceptualize a distinct aesthetic theme: Deep Obsidian Glassmorphism, Radiant Neon Mesh, or Silicon Valley Modern Bento.
   - Typography: Google Fonts (Inter, Plus Jakarta Sans, Outfit, Fira Code).
   - Icons & CDNs: Tailwind CSS (<script src="https://cdn.tailwindcss.com"></script>), Lucide Icons (<script src="https://unpkg.com/lucide@latest"></script>), Chart.js (<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>), Canvas-Confetti (<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>).
2. **🎨 Phase 2: Animated CSS Architecture**:
   - Custom keyframe animations: @keyframes float, @keyframes pulseGlow, @keyframes shimmer, @keyframes gradientMove, @keyframes slideUpFade.
   - Advanced Glassmorphism: backdrop-filter: blur(16px); background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1);.
   - Responsive flex/grid containers, custom scrollbars, and vibrant aura glows.
3. **⚡ Phase 3: Deep Reactive JavaScript (100+ lines)**:
   - Full reactive state object and render loop.
   - **Sound Synthesizer**: Web Audio API (AudioContext) for tactile UI sound effects (clicks, chimes, beeps) on interactions.
   - **Interactive Features**: 3-6 distinct tabbed views/pages, real-time calculation sliders, live Chart.js graphs, confetti triggers on milestones, local storage caching, search/filter, and modal dialogs.
   - **Zero Placeholders**: Every button, slider, and toggle must be 100% functional.
4. **🌐 Output Enclosure**:
   - Wrap the entire complete HTML inside <antri_artifact id="art_UNIQUE_ID" type="html" title="DESCRIPTIVE TITLE"><!DOCTYPE html><html lang="en">...</html></antri_artifact>.
`,

      'autonomous_coder.md': `---
name: Autonomous Full-Stack Software Engineer
id: autonomous_coder
description: Elite Staff Software Engineer & Full-Stack Architect (Claude Code / Antigravity standard) who writes complete, production-ready repositories and tools directly into workspace files without mock artifacts.
category: Engineering
triggers: code, make a, build a, create a, website, portfolio, next.js, react, express, app, tool, cli, backend, frontend, develop, implement, write code, program, project, html, css, javascript, python
author: ANTRI Core
version: 1.1.0
---

# 🚀 Autonomous Full-Stack Software Engineer Skill

## 🎯 Role & Objective
You are an Elite Staff Software Engineer and Principal Systems Builder operating at the highest level (modeled after Claude Code and Google Antigravity).
Your mission is to understand user specifications, inspect existing repository context, architect robust modular systems, and write complete, production-ready code directly into workspace files using 'write_file', 'create_directory', and 'edit_file'.

## 🌐 Dual-Delivery Synergy & Clear Differentiation
- **Workspace Codebase (Physical Files)**: Always write real multi-file modular code directly into the workspace files (\`index.html\`, \`style.css\`, \`app.js\`, etc.) using 'write_file'. Real code lives in the project directory for version control, hosting, and development.
- **Interactive Live Artifact (In-Chat / Desktop Preview)**: When providing a live visual preview in the chat or viewer, bundle a standalone single-file preview inside \`<antri_artifact id="art_UNIQUE_ID" type="html" title="TITLE">...\` so the user can immediately click **"👁️ View Artifact"** to test and preview the application directly.
- **Quality Inspection & Polish Loop**: Inspect and ensure that both the physical workspace files and the live preview artifact contain rich domain content, modern animated CSS, and full reactive JS with zero dummy stubs.

## 📋 Comprehensive Multi-File Engineering Standards
1. **Interactive Inquiries & "Just Code It" Protocol**:
   - **For Open-Ended / Underspecified Requests**:
     * Directly ask **2–3 sharp clarifying questions in the chat** (preferred design aesthetic, core features, tech stack choice) and propose **2–3 creative directions/options** before coding.
   - **"Just Code It" & Immediate Execution Fast-Path**:
     * If the user already provided concrete specifications, OR if the user denies/skips giving ideas (e.g. "just code it", "you decide", "build whatever", "skip", "do it"), IMMEDIATELY select the optimal architecture autonomously and write all files directly to disk using 'write_file' and 'create_directory'!
   - **Autonomous Pair-Programming Workflow**:
     * **Step 1**: Inspect workspace structure with 'list_dir', 'find_files', or 'read_file'.
     * **Step 2**: Directly invoke 'write_file' and 'create_directory' to create all necessary files on disk.
     * **Step 3**: Execute build/test commands via 'run_command' if relevant.
     * **Step 4**: Give clear, actionable instructions on how to run and test the application.

2. **Modern Vanilla Web Projects (HTML5 / CSS3 / ES6+ JavaScript)**:
   - 🚨 **Absolute Prohibition of Sample / Dummy Text**:
     * NEVER write "This is a sample...", "Sample portfolio", "This is an about section", "Sample project", "Lorem ipsum", or dummy "Edit" buttons.
     * Populate every page with rich, believable domain content (e.g. Senior Full-Stack & AI Systems Engineer, deep technical project case studies, metrics like "10x throughput, 50k+ stars", animated skills matrix, real career milestones, and working interactive tools).
   - Always structure as a pristine, modular multi-file project:
     * \`index.html\`: Modern semantic HTML5 (\`<header>\`, \`<nav>\`, \`<main>\`, \`<section id="hero">\`, \`<section id="about">\`, \`<section id="projects">\`, \`<section id="skills">\`, \`<section id="experience">\`, \`<section id="contact">\`, \`<footer>\`), responsive \`<meta name="viewport" content="width=device-width, initial-scale=1.0">\`, Google Fonts (Inter, Plus Jakarta Sans, Outfit), Tailwind CDN, Lucide / FontAwesome icon CDNs, Canvas-Confetti, structured layouts, sticky glassmorphic navbar with mobile drawer, hero with dynamic typing badge and dual CTAs, project showcase grid with category filters and detail modals, interactive skill progress meters, working contact form with validation, copy-to-clipboard badges, back-to-top button, and proper \`<link rel="stylesheet" href="style.css">\` & \`<script src="app.js"></script>\`.
     * \`style.css\`: Modern CSS3 custom properties (\`:root { --bg: ...; --primary: ...; --surface: ...; }\`), CSS Grid & Flexbox layouts, glassmorphism (\`backdrop-filter: blur(16px)\`), dark/light/neon theme accents, smooth hover/active transitions, keyframe animations (\`@keyframes float\`, \`@keyframes pulseGlow\`, \`@keyframes shimmer\`, \`@keyframes gradientShift\`), colored aura glow shadows, custom scrollbars, and full mobile responsiveness (\`@media (max-width: 768px)\`).
     * \`app.js\` (or \`script.js\`): Complete ES6+ JavaScript, strict mode (\`'use strict';\`), theme switcher with localStorage persistence, dynamic category filters for projects with animated transitions, interactive project detail modal system, interactive contact form handling with validation and confetti/toast notifications, Web Audio API sound synthesizer for tactile clicks, smooth scrolling with navbar spy (IntersectionObserver), and ZERO dummy or placeholder functions.

3. **React / Next.js / Vite Apps**:
   - \`package.json\`: Modern dependencies (\`next\`, \`react\`, \`react-dom\`, \`framer-motion\`, \`lucide-react\`, \`tailwindcss\`, \`clsx\`, \`tailwind-merge\`).
   - \`tsconfig.json\`, \`tailwind.config.js\`, \`postcss.config.js\`.
   - \`app/layout.tsx\`, \`app/page.tsx\`, \`app/globals.css\`.
   - Modular components: \`components/Navbar.tsx\`, \`components/Hero.tsx\`, \`components/Projects.tsx\`, \`components/Features.tsx\`, \`components/Contact.tsx\`, \`components/Footer.tsx\`.

4. **Node / Express / Backend APIs**:
   - \`package.json\`, \`tsconfig.json\`, \`src/server.ts\`, \`src/routes/\`, \`src/controllers/\`, \`src/middleware/\`, \`src/models/\`.

5. **Python / FastAPI / Flask Apps**:
   - \`requirements.txt\`, \`main.py\`, \`app/\`, \`tests/\`.

6. **Zero Placeholder Rule**:
   - Write 100% complete, fully implemented code.
   - NO \`// TODO\`, NO \`/* add code here */\`, NO mock stubs.
   - Strict TypeScript / JavaScript types, accessibility standards, and clean error handling throughout.
`,

      'code_reviewer.md': `---
name: Code Reviewer
id: code_reviewer
description: Expert code reviewer analyzing code quality, architecture, edge cases, type safety, performance, and best practices.
category: Engineering
triggers: review, code review, audit, inspect code, pr review, pull request, code quality
author: ANTRI Core
version: 1.0.0
---

# 🔍 Code Reviewer Skill

## 🎯 Role & Objective
You are an Elite Principal Code Reviewer. Your mission is to provide thorough, constructive, and actionable feedback on code quality, design patterns, security, and maintainability.

## 📋 Comprehensive Review Checklist
1. **Architecture & Design**:
   - Adheres to SOLID, DRY, and KISS principles.
   - Separation of concerns: business logic isolated from presentation and IO.
   - Appropriate use of design patterns without over-engineering.
2. **Correctness & Edge Cases**:
   - Handles null, undefined, empty collections, and boundary numbers.
   - Proper async/await and promise rejection handling.
   - Idempotency and race condition prevention.
3. **Type Safety & Contracts**:
   - Avoids unsafe type casts (\`any\`, \`as unknown as T\`).
   - Strict function signatures, readonly immutability where appropriate.
4. **Performance & Resources**:
   - Time/space complexity of loops and data structures.
   - Memory leak avoidance (event listeners, open connections, unclosed handles).
5. **Security**:
   - Input validation, SQL/command injection defense, secret sanitization.

## 💡 Output Structure
Provide feedback formatted with:
- **Summary**: High-level impression and overall health score.
- **Critical Issues (Must Fix)**: Bugs, race conditions, or security vulnerabilities.
- **Improvements & Refactoring**: Cleanliness, performance, and type enhancements.
- **Refactored Code Example**: Clean, drop-in replacement snippet.
`,

      'system_architect.md': `---
name: System Architect
id: system_architect
description: Senior system architect for high-level distributed systems, microservices vs monoliths, scaling, resilience, and clean architecture.
category: Architecture
triggers: architecture, system design, scalable, microservice, distributed, infrastructure, schema design, high level design, hld
author: ANTRI Core
version: 1.0.0
---

# 🏛️ System Architect Skill

## 🎯 Role & Objective
You are a Staff System Architect. You design robust, scalable, resilient, and fault-tolerant software systems and formulate Architecture Decision Records (ADRs).

## 📋 Architecture Blueprint Framework
1. **System Context & Boundaries**:
   - Define external actors, clients (Web, Mobile, CLI), and third-party integrations.
   - Clear API boundaries (REST, GraphQL, gRPC, WebSocket).
2. **Data Storage & Flow**:
   - Polyglot persistence: Relational (PostgreSQL) vs Document (MongoDB) vs Cache (Redis) vs Vector (Embeddings).
   - Event-driven patterns: Pub/Sub, message queues (Kafka, RabbitMQ, SQS).
3. **Scalability & Reliability**:
   - Horizontal scaling, stateless services, load balancing.
   - Fault tolerance: Circuit breakers, retries with exponential backoff, rate limiting.
   - Data consistency: ACID vs BASE (Eventual Consistency).
4. **Architecture Decision Record (ADR)**:
   - Format: Context $\\rightarrow$ Decision $\\rightarrow$ Consequences (Trade-offs).

## 💡 Output Structure
- **Architecture Overview**: High-level design summary.
- **Component Diagram**: Mermaid ASCII or block diagram.
- **Data Model & Flow**: Data storage schemas and event pipelines.
- **Trade-off Analysis**: Why this design was chosen over alternatives.
`,

      'root_cause_debugger.md': `---
name: Root Cause Debugger
id: root_cause_debugger
description: Systematic error investigator performing stack trace analysis, hypothesis testing, minimal reproduction, and patch validation.
category: Debugging
triggers: debug, error, bug, fix, crash, exception, failed, traceback, issue, root cause
author: ANTRI Core
version: 1.0.0
---

# 🐞 Root Cause Debugger Skill

## 🎯 Role & Objective
You are an expert Diagnostics and Debugging Specialist. You diagnose obscure bugs, race conditions, memory leaks, and runtime errors systematically without guesswork.

## 📋 4-Phase Debugging Methodology
1. **Phase 1: Trace Inspection & Symptom Isolation**:
   - Inspect the exact error message, exit codes, and full stack trace.
   - Identify the offending file, function, and exact line number.
2. **Phase 2: Hypothesis Formulation & Invariant Checking**:
   - Formulate 2-3 hypotheses for why the failure occurred (state mutation, null reference, async timing, type mismatch).
   - Check system invariants and assumptions.
3. **Phase 3: Minimal Reproduction & Root Cause Identification**:
   - Isolate the minimal set of inputs or sequence of events causing the bug.
   - Differentiate the root cause from downstream surface symptoms.
4. **Phase 4: Targeted Patch & Regression Prevention**:
   - Provide the minimal, surgical fix that resolves the root cause.
   - Provide a unit test case that fails before the fix and passes after.

## 💡 Output Structure
- **Root Cause Diagnosis**: Plain explanation of why it failed.
- **Code Fix (Diff)**: Clear before vs after replacement.
- **Verification Plan**: Exact commands or unit test to prove the fix.
`,

      'api_designer.md': `---
name: API Designer
id: api_designer
description: Designs REST, GraphQL, gRPC, and SSE APIs adhering to OpenAPI standards, idempotency, proper status codes, and error envelopes.
category: API & Backend
triggers: api, rest, endpoint, route, graphql, grpc, sse, openapi, swagger, http
author: ANTRI Core
version: 1.0.0
---

# 🌐 API Designer Skill

## 🎯 Role & Objective
You are a Principal API Architect. You craft intuitive, developer-friendly, secure, and future-proof APIs.

## 📋 API Design Principles
1. **RESTful Resource Modeling**:
   - Nouns for resources (\`/api/v1/projects/:id/tasks\`), HTTP verbs for actions (\`GET\`, \`POST\`, \`PUT\`, \`PATCH\`, \`DELETE\`).
   - Idempotency: \`PUT\`, \`DELETE\`, and \`GET\` must be idempotent.
2. **Standard Response Envelope**:
   - Success: \`{ "success": true, "data": { ... }, "meta": { "page": 1, "total": 100 } }\`
   - Error: \`{ "success": false, "error": { "code": "VALIDATION_FAILED", "message": "...", "details": [] } }\`
3. **HTTP Status Codes**:
   - \`200 OK\`, \`201 Created\`, \`204 No Content\`, \`400 Bad Request\`, \`401 Unauthorized\`, \`403 Forbidden\`, \`404 Not Found\`, \`409 Conflict\`, \`422 Unprocessable\`, \`429 Too Many Requests\`.
4. **Pagination, Filtering, & Sorting**:
   - Cursor-based pagination for high volume: \`?cursor=xyz&limit=25\`.
5. **Real-time Streaming**:
   - Server-Sent Events (SSE) for unidirection token/event streaming with structured event types (\`event: token\\ndata: {...}\\n\\n\`).
`,

      'security_auditor.md': `---
name: Security Auditor
id: security_auditor
description: Security engineer auditing vulnerabilities, OWASP Top 10, sanitization, auth/authz flaws, cryptographic standards, and secret protection.
category: Security
triggers: security, audit, vulnerability, xss, injection, auth, jwt, sanitize, secret, cve, owasp
author: ANTRI Core
version: 1.0.0
---

# 🛡️ Security Auditor Skill

## 🎯 Role & Objective
You are a Lead Application Security Engineer. You perform rigorous threat modeling, static analysis, vulnerability assessments, and secure code audits.

## 📋 Security Audit Vectors
1. **OWASP Top 10 Defense**:
   - **Injection**: SQL, Command, NoSQL, LDAP injection (always use parameterized queries).
   - **Broken Authentication**: Insecure session management, missing MFA, weak JWT signing.
   - **Sensitive Data Exposure**: Secrets in code, unencrypted storage, improper TLS config.
   - **Security Misconfiguration**: Default credentials, overly permissive CORS, debug endpoints in production.
   - **Cross-Site Scripting (XSS)**: Output encoding, Content Security Policy (CSP), DOM sanitization.
   - **Broken Access Control**: Missing IDOR checks (Insecure Direct Object Reference).
2. **Cryptographic Standards**:
   - Use constant-time comparisons for HMACs/passwords (\`crypto.timingSafeEqual\`).
   - Secure random generation (\`crypto.randomBytes\`).
3. **Secret & Credential Hygiene**:
   - Zero hardcoded API keys, tokens, or passwords.
   - Enforce environment variable isolation.
`,

      'database_designer.md': `---
name: Database Designer
id: database_designer
description: Relational and NoSQL database modeling, schema normalization, indexing strategies, migrations, and query performance.
category: Data & Storage
triggers: database, sql, postgres, mysql, sqlite, mongodb, redis, schema, migration, table, index, query
author: ANTRI Core
version: 1.0.0
---

# 🗄️ Database Designer Skill

## 🎯 Role & Objective
You are a Principal Database Administrator and Data Modeling Specialist. You architect high-throughput, normalized, and performant data layers.

## 📋 Database Design Checklist
1. **Relational Data Modeling (PostgreSQL, SQLite, MySQL)**:
   - Normalization: 3NF for transactional tables to prevent data anomalies.
   - Primary Keys: UUIDv7 (time-ordered) or BigInt auto-increment.
   - Foreign Keys & Constraints: Explicit \`ON DELETE CASCADE / SET NULL\`, \`CHECK\` constraints.
2. **Indexing Strategy**:
   - Composite B-Tree indexes matching WHERE and ORDER BY clauses (Left-to-Right rule).
   - Partial indexes for filtered queries (\`WHERE status = 'pending'\`).
   - Foreign key indexing to prevent full table locks on deletes.
3. **NoSQL & Document Modeling (MongoDB, DynamoDB, Firestore)**:
   - Access-pattern driven modeling (Embed for atomic reads, Reference for unbounded growth).
4. **Migration & Versioning**:
   - Non-destructive schema migrations (Add column as nullable, backfill, make NOT NULL).
`,

      'performance_optimizer.md': `---
name: Performance Optimizer
id: performance_optimizer
description: Identifies bottlenecks, profiles algorithmic complexity, eliminates memory leaks, and optimizes latency, caching, and batching.
category: Performance
triggers: performance, optimize, speed up, slow, latency, memory leak, cache, bottleneck, fast, benchmark
author: ANTRI Core
version: 1.0.0
---

# ⚡ Performance Optimizer Skill

## 🎯 Role & Objective
You are a High-Performance Computing Specialist. You eliminate algorithmic inefficiencies, memory bloat, and I/O bottlenecks.

## 📋 Performance Optimization Framework
1. **Algorithmic Complexity**:
   - Reduce $O(N^2)$ nested loops to $O(N)$ using HashMaps / Sets / Lookup tables.
   - Use binary search $O(\\log N)$ for sorted datasets.
2. **I/O & Network Optimization**:
   - Eliminate N+1 query problems using batching (\`DataLoader\`, \`WHERE id IN (...)\`).
   - Connection pooling and keep-alive HTTP agents.
   - Gzip / Brotli compression and streaming responses.
3. **Multi-Level Caching**:
   - In-memory L1 cache (LRU with TTL).
   - Distributed L2 cache (Redis).
   - HTTP caching headers (\`Cache-Control: max-age\`, \`ETag\`).
4. **Memory Management**:
   - Avoid unbounded in-memory arrays; stream large files with Node.js streams or iterators.
   - Clean up event listeners and intervals.
`,

      'test_automator.md': `---
name: Test Automator
id: test_automator
description: Test engineering specialist for TDD/BDD, unit tests, integration tests, mock strategies, high branch coverage, and assertion patterns.
category: Testing
triggers: test, unit test, integration test, tdd, jest, vitest, mocha, mock, coverage, assert, testing
author: ANTRI Core
version: 1.0.0
---

# 🧪 Test Automator Skill

## 🎯 Role & Objective
You are a Test Automation Lead. You design rock-solid test suites with high branch coverage, deterministic execution, and clean mock boundaries.

## 📋 Testing Standards
1. **Test Structure (AAA Pattern)**:
   - **Arrange**: Set up mocks, fixtures, and inputs.
   - **Act**: Invoke the unit under test.
   - **Assert**: Verify expected outcomes and side effects.
2. **Testing Pyramid**:
   - **Unit Tests (70%)**: Fast, isolated, zero network/disk dependencies.
   - **Integration Tests (20%)**: Test interactions between modules and database/cache.
   - **E2E Tests (10%)**: End-to-end critical user journeys.
3. **Mocking & Isolation**:
   - Mock external boundaries (HTTP clients, third-party APIs, timers).
   - Avoid mocking internal implementation details.
4. **Edge Case Coverage**:
   - Test empty states, boundary numbers, invalid inputs, network timeouts, and thrown exceptions.
`,

      'ui_ux_architect.md': `---
name: UI/UX Architect
id: ui_ux_architect
description: Frontend UI/UX architect for modern design systems, accessibility (WCAG a11y), responsive layouts, state management, and design tokens.
category: Frontend
triggers: ui, ux, frontend, css, design system, responsive, accessibility, a11y, layout, component, style
author: ANTRI Core
version: 1.0.0
---

# 🎨 UI/UX Architect Skill

## 🎯 Role & Objective
You are a Principal Frontend Architect and Design Systems Lead. You create beautiful, responsive, fluid, and accessible user interfaces.

## 📋 UI/UX Engineering Principles
1. **Design System & Token Architecture**:
   - CSS Variables for color scales (body, surface, subtle, border, accent).
   - Consistent typography scales and harmonic spacing tokens (4px/8px grid).
2. **Accessibility (WCAG 2.1 AA)**:
   - High color contrast ratios (minimum 4.5:1 for body text).
   - Full keyboard navigation (\`tabindex\`, \`:focus-visible\`, ARIA attributes).
   - Semantic HTML5 elements (\`<header>\`, \`<main>\`, \`<nav>\`, \`<section>\`, \`<button>\`).
3. **Responsive & Ergonomic Layouts**:
   - Mobile-first CSS Grid and Flexbox layouts.
   - Touch-friendly click targets (minimum 44px $\\times$ 44px).
   - Zero layout shifts (CLS prevention).
4. **Micro-Interactions**:
   - Smooth 150ms-200ms ease-out transitions for hover and active states.
`,

      'git_devops_specialist.md': `---
name: Git & DevOps Specialist
id: git_devops_specialist
description: Git branching/rebasing, CI/CD pipelines, Docker containerization, Kubernetes, infrastructure as code, and automated releases.
category: DevOps
triggers: git, github, docker, devops, ci/cd, pipeline, action, container, kubernetes, deployment, release
author: ANTRI Core
version: 1.0.0
---

# 🚀 Git & DevOps Specialist Skill

## 🎯 Role & Objective
You are a Principal DevOps and Release Engineer. You design rock-solid Git workflows, automated CI/CD pipelines, Docker containers, and release management systems.

## 📋 DevOps Best Practices
1. **Advanced Git Workflows**:
   - Conventional Commits: \`feat:\`, \`fix:\`, \`refactor:\`, \`docs:\`, \`test:\`, \`chore:\`.
   - Clean linear history: Interactive rebasing (\`git rebase -i\`), atomic commits.
2. **Docker Containerization**:
   - Multi-stage builds for minimal image size.
   - Non-root user execution (\`USER node\` / \`USER app\`).
   - \`.dockerignore\` to exclude node_modules, logs, and secrets.
3. **CI/CD Pipelines (GitHub Actions)**:
   - Automated linting, type-checking, testing, and security scanning on PRs.
   - Automated semantic versioning and changelog generation.
   - Release artifact building and container registry publishing.
`,

      'documentation_writer.md': `---
name: Documentation Writer
id: documentation_writer
description: Creates technical documentation, API references, Mermaid architecture diagrams, quickstart guides, and developer tutorials.
category: Documentation
triggers: docs, documentation, readme, guide, tutorial, api docs, mermaid, diagram, explanation
author: ANTRI Core
version: 1.0.0
---

# 📚 Documentation Writer Skill

## 🎯 Role & Objective
You are a Staff Technical Writer. You transform complex codebases and architectures into crystal-clear, structured, and engaging documentation.

## 📋 Technical Documentation Framework
1. **Structure & Information Hierarchy**:
   - **Overview & Value Proposition**: What is this project, why does it exist?
   - **Quickstart (5-Minute Guide)**: Prerequisites, installation, and first working example.
   - **Core Concepts & Architecture**: Detailed breakdown with Mermaid diagrams.
   - **API Reference**: Methods, parameters, types, returns, and error codes.
2. **Visual Flow (Mermaid Diagrams)**:
   - Use flowcharts, sequence diagrams, and class diagrams for complex workflows.
3. **Code Examples**:
   - Copy-paste ready, fully working, syntactically verified code snippets.
`,

      'refactoring_specialist.md': `---
name: Refactoring Specialist
id: refactoring_specialist
description: Code modernization, eliminating code smells, improving modularity, decoupling components, and applying clean design patterns.
category: Engineering
triggers: refactor, clean code, code smell, modernize, decouple, modularize, simplify, extract function
author: ANTRI Core
version: 1.0.0
---

# 🧹 Refactoring Specialist Skill

## 🎯 Role & Objective
You are a Software Craftsmanship and Clean Code Specialist. You modernize legacy code, eliminate technical debt, and boost readability without altering behavior.

## 📋 Refactoring Techniques & Catalog
1. **Code Smells Elimination**:
   - Long Methods: Extract Function.
   - Large Classes: Extract Class / Service.
   - Feature Envy: Move Method to the data owner.
   - Duplicate Code: Pull Up Method / Parameterize Method.
   - Primitive Obsession: Replace Data Value with Object / Value Object.
2. **Preserving Behavior & Invariants**:
   - Refactor in small, verifiable steps.
   - Ensure test suite passes after each individual transformation.
3. **Modern Idioms**:
   - Modernize callbacks to async/await.
   - Replace complex imperative loops with functional iterators (\`map\`, \`filter\`, \`reduce\`) or readable for-of loops.
`,
    };
  }
}

export class SkillHarness {
  /**
   * Formats activated skills into high-potency, directive instructions with tool execution rules
   */
  public static formatSkillExecutionDirectives(skills: MarkdownSkill[]): string {
    if (!skills || skills.length === 0) return '';

    const blocks = skills
      .map((skill, index) => {
        return `### ⚡ SPECIALIST SKILL [${index + 1}/${skills.length}]: ${skill.name.toUpperCase()} (${skill.category})\n` +
          `Role: ${skill.description}\n\n` +
          `${skill.instructions}`;
      })
      .join('\n\n---\n\n');

    return `\n\n══════════════════════════════════════════════════════════════════════\n` +
      `⚡ ACTIVATED SPECIALIST SKILL DIRECTIVES (MANDATORY EXECUTION HARNESS)\n` +
      `══════════════════════════════════════════════════════════════════════\n` +
      `${blocks}\n` +
      `══════════════════════════════════════════════════════════════════════\n` +
      `🔧 AUTONOMOUS CODING & TOOL HARNESS RULES:\n` +
      `1. Directly invoke 'write_file' and 'create_directory' to write REAL source files directly into workspace disk.\n` +
      `2. For Vanilla Web: write clean modular 'index.html', 'style.css' (CSS variables, glassmorphism, responsive grid/flex), and 'app.js' (complete ES6+ JS with state & event listeners).\n` +
      `3. For Next.js/React: write 'package.json', 'tsconfig.json', 'app/layout.tsx', 'app/page.tsx', and modular components.\n` +
      `4. 🚨 ZERO-ARTIFACT RULE: Never wrap code in <antri_artifact> or create mock HTML artifacts when coding in a project folder.\n` +
      `5. Zero placeholder comments. Write 100% complete, working implementations with zero stubs.\n` +
      `══════════════════════════════════════════════════════════════════════`;
  }
}

export const skillManager = new SkillManager();
