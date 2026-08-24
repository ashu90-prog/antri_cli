import fs from 'fs';
import path from 'path';

export interface CodebaseAnalysisResult {
  projectName: string;
  projectType: string;
  directories: string[];
  entryPoints: string[];
  totalFiles: number;
  mermaidDiagram: string;
  summary: string;
}

export class ArchitectureAnalyzer {
  /**
   * Scans a workspace directory and generates a rich, styled Mermaid architecture diagram
   */
  public static analyze(workingDir: string = process.cwd()): CodebaseAnalysisResult {
    let projectName = path.basename(workingDir);
    let projectType = 'Generic Application';
    const entryPoints: string[] = [];
    const detectedDirs: string[] = [];
    let totalFiles = 0;

    // 1. Inspect manifests and entry points
    const pkgPath = path.join(workingDir, 'package.json');
    const pubspecPath = path.join(workingDir, 'pubspec.yaml');
    const cargoPath = path.join(workingDir, 'Cargo.toml');
    const pyprojectPath = path.join(workingDir, 'pyproject.toml');

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        projectName = pkg.name || projectName;
        if (pkg.dependencies?.next || pkg.devDependencies?.next) {
          projectType = 'Next.js / React Web Application';
        } else if (pkg.bin) {
          projectType = 'Node.js / TypeScript CLI and Autonomous Agent';
        } else if (pkg.dependencies?.express) {
          projectType = 'Express.js Backend and REST API';
        } else {
          projectType = 'Node.js / TypeScript Project';
        }
        if (pkg.bin) entryPoints.push('bin/antri.js');
        if (pkg.main) entryPoints.push(pkg.main);
      } catch (_) {}
    } else if (fs.existsSync(pubspecPath)) {
      projectType = 'Flutter Cross-Platform Application';
      entryPoints.push('lib/main.dart');
    } else if (fs.existsSync(cargoPath)) {
      projectType = 'Rust Systems Application';
      entryPoints.push('src/main.rs');
    } else if (fs.existsSync(pyprojectPath) || fs.existsSync(path.join(workingDir, 'requirements.txt'))) {
      projectType = 'Python Application / Backend';
      entryPoints.push('main.py');
    }

    // 2. Scan top-level and src directories
    try {
      const topItems = fs.readdirSync(workingDir, { withFileTypes: true });
      for (const item of topItems) {
        if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'dist' || item.name === 'build') continue;
        if (item.isDirectory()) {
          detectedDirs.push(item.name);
        } else {
          totalFiles++;
        }
      }

      const srcDir = path.join(workingDir, 'src');
      if (fs.existsSync(srcDir)) {
        const srcItems = fs.readdirSync(srcDir, { withFileTypes: true });
        for (const item of srcItems) {
          if (item.isDirectory()) {
            detectedDirs.push(`src/${item.name}`);
          }
        }
      }
    } catch (_) {}

    // 3. Build comprehensive, styled Mermaid diagram
    const isAntriCodebase = fs.existsSync(pkgPath) && fs.readFileSync(pkgPath, 'utf-8').includes('antri');

    let mermaid = '';
    if (isAntriCodebase) {
      mermaid = `graph TD
  %% Architecture Flowchart for ANTRI Code Autonomous System
  classDef client fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#ffffff;
  classDef core fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
  classDef memory fill:#14532d,stroke:#22c55e,stroke-width:2px,color:#ffffff;
  classDef tools fill:#701a75,stroke:#d946ef,stroke-width:2px,color:#ffffff;
  classDef providers fill:#7c2d12,stroke:#f97316,stroke-width:2px,color:#ffffff;
  classDef cloud fill:#312e81,stroke:#818cf8,stroke-width:2px,color:#ffffff;

  subgraph Clients["🖥️ Clients and Control Planes"]
    CLI["Terminal CLI\n(src/cli/promptToolkit.ts)"]:::client
    Desktop["Desktop Control Plane\n(src/desktop/server.ts)"]:::client
    Mobile["Mobile Standalone App\n(src/mobile/server.ts)"]:::client
    Flutter["Flutter Cross-Platform Client\n(antri_flutter)"]:::client
  end

  subgraph CoreEngine["🧠 Core Agent and Orchestration Engine"]
    Agent["AntriAgent\n(Autonomous State Loop)"]:::core
    Goal["GoalLoopEngine\n(Plan, Critique, Refine)"]:::core
    Dialectic["DialecticEngine\n(Adversarial Debate Arena)"]:::core
    Sessions["SessionManager\n(Multi-Chat Persistence)"]:::core
    Profiles["ProfileManager\n(Adaptive Personas and Notes)"]:::core
    Debugger["SelfDebugger\n(Health Check and Self-Doctor)"]:::core
  end

  subgraph Tooling["🛠️ Tool Execution and Environment Engine"]
    ToolExec["ToolExecutor\n(Name Aliasing and Security Gate)"]:::tools
    FileSystem["Workspace Tools\n(read_file, write_file, edit_file)"]:::tools
    CodebaseMaterializer["Codebase Materializer\n(Next.js and Multi-File Scaffold)"]:::tools
    Sandbox["SandboxEngine\n(Isolated Python Runtime)"]:::tools
    Crawler["Web Search and Scraping\n(Autonomous Research)"]:::tools
    Artifacts["ArtifactManager\n(HTML and Mermaid Generator)"]:::tools
    SkillHarness["SkillHarness and Synthesizer\n(Dynamic Skill Injection)"]:::tools
  end

  subgraph MemorySystem["📚 Lifelong Multi-Tier Memory Hierarchy"]
    MemManager["MemoryManager\n(Autonomous Self-Recall)"]:::memory
    Semantic["SemanticMemory\n(128-d Vector Embeddings)"]:::memory
    Episodic["EpisodicMemory\n(Interaction Episode Logs)"]:::memory
    ProfileMem["ProfileMemory\n(Preferences and Conventions)"]:::memory
    VectorStore["VectorStore\n(Cosine Similarity Search)"]:::memory
  end

  subgraph Providers["⚡ AI Provider Catalogs"]
    NIM["NVIDIA NIM\n(Llama 3.1 8B/70B)"]:::providers
    DeepSeek["DeepSeek\n(V3 / R1)"]:::providers
    Cerebras["Cerebras\n(CS-3 Supercomputer)"]:::providers
    OpenAI["OpenAI\n(GPT-4o / o1)"]:::providers
    Anthropic["Anthropic\n(Claude 3.7 Sonnet)"]:::providers
    Gemini["Google Gemini\n(2.5 Flash / Pro)"]:::providers
    Ollama["Ollama\n(Local Runtime)"]:::providers
  end

  subgraph CloudSync["☁️ Cloud Persistence and Security"]
    Firestore["Google Cloud Firestore\n(Partitioned Remote Sync)"]:::cloud
    Auth["AuthManager\n(Secure Session Partitioning)"]:::cloud
    LocalStorage["~/.antri Storage\n(Local JSON Databases)"]:::cloud
  end

  %% Relationship Flows
  Clients --> CoreEngine
  CoreEngine --> Tooling
  CoreEngine --> MemorySystem
  CoreEngine --> Providers
  CoreEngine --> CloudSync
  Tooling --> LocalStorage
  MemorySystem --> LocalStorage
  CloudSync --> Firestore`;
    } else {
      mermaid = `graph TD
  classDef app fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
  classDef module fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#ffffff;
  classDef data fill:#14532d,stroke:#22c55e,stroke-width:2px,color:#ffffff;

  subgraph Entry["🚀 Entry Points and Application Root"]
    Root["${projectName}\n(${projectType})"]:::app
  end

  subgraph Modules["📦 Subsystems and Directories"]
    ${detectedDirs.slice(0, 10).map((d, i) => `Mod${i}["${d}"]:::module`).join('\n    ')}
  end

  subgraph DataFlow["🔄 Data and Execution Flow"]
    Flow["Runtime and Module Orchestration"]:::data
  end

  Root --> Modules
  Modules --> DataFlow`;
    }

    return {
      projectName,
      projectType,
      directories: detectedDirs,
      entryPoints,
      totalFiles,
      mermaidDiagram: mermaid,
      summary: `Analyzed codebase "${projectName}" (${projectType}). Found ${detectedDirs.length} subsystem directories.`,
    };
  }
}
