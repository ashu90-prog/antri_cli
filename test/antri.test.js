import test from 'node:test';
import assert from 'node:assert';
import { ConfigManager } from '../dist/core/config.js';
import { ConversationHistory } from '../dist/core/history.js';
import { ToolExecutor, AVAILABLE_TOOLS, getAllActiveTools, SENSITIVE_TOOLS } from '../dist/core/tools.js';
import { PROMPT_TOOLKIT_COMMANDS } from '../dist/cli/promptToolkit.js';
import { PROVIDER_CATALOGS, getAvailableModels } from '../dist/providers/models.js';
import { PROVIDERS_LIST } from '../dist/cli/dialogs/providerPicker.js';
import { ToolInspector } from '../dist/cli/renderer.js';
import { FilePickerService } from '../dist/cli/dialogs/filePicker.js';
import { CitationEngine } from '../dist/core/citations.js';
import { DialecticEngine } from '../dist/core/dialectic.js';
import { VectorStore } from '../dist/memory/vectorStore.js';
import { EpisodicMemory } from '../dist/memory/episodic.js';
import { SemanticMemory } from '../dist/memory/semantic.js';
import { ProfileMemory } from '../dist/memory/profile.js';
import { MemoryManager } from '../dist/memory/manager.js';
import { SandboxEngine } from '../dist/core/sandbox.js';
import { SkillSynthesizer } from '../dist/core/skillSynthesizer.js';
import { MetaOptimizer } from '../dist/core/metaOptimizer.js';
import { ProfileManager } from '../dist/profiles/profileManager.js';
import { Updater } from '../dist/core/updater.js';
import { GoalLoopEngine } from '../dist/core/goalLoop.js';
import { DesktopServer } from '../dist/desktop/server.js';

test('ConfigManager initializes with defaults including debateDepth and mode', () => {
  const manager = new ConfigManager();
  const config = manager.get();
  assert.ok(config.version);
  assert.ok(config.model);
  assert.ok(['quick', 'deep', 'rigorous'].includes(config.debateDepth || 'deep'));
  assert.ok(['vibe', 'plan'].includes(config.mode || 'vibe'));
});

test('ConfigManager toggles between Plan Mode and Vibe Mode', () => {
  const manager = new ConfigManager();
  manager.setMode('plan');
  assert.strictEqual(manager.get().mode, 'plan');
  manager.setMode('vibe');
  assert.strictEqual(manager.get().mode, 'vibe');
});

test('ConfigManager manages alwaysAllow privacy permissions', () => {
  const manager = new ConfigManager();
  manager.setAlwaysAllow(true);
  assert.strictEqual(manager.get().alwaysAllow, true);
  manager.setAlwaysAllow(false);
  assert.strictEqual(manager.get().alwaysAllow, false);
});

test('ToolExecutor identifies privacy & security sensitive tools', () => {
  assert.ok(ToolExecutor.isSensitive('web_search'));
  assert.ok(ToolExecutor.isSensitive('scrape_url'));
  assert.ok(ToolExecutor.isSensitive('crawl_docs'));
  assert.ok(ToolExecutor.isSensitive('run_command'));
  assert.ok(ToolExecutor.isSensitive('execute_python'));
  assert.ok(ToolExecutor.isSensitive('synthesize_skill'));
  assert.strictEqual(ToolExecutor.isSensitive('read_file'), false);
  assert.strictEqual(ToolExecutor.isSensitive('list_dir'), false);
});

test('Updater reports correct package name and current version', () => {
  assert.strictEqual(Updater.PACKAGE_NAME, 'antri_cli');
  assert.strictEqual(Updater.CURRENT_VERSION, '1.26.1');
});

test('GoalLoopEngine initializes with active configuration', () => {
  const manager = new ConfigManager();
  const engine = new GoalLoopEngine(manager.get());
  assert.ok(engine);
  assert.strictEqual(typeof engine.runGoal, 'function');
});

test('ConversationHistory records and exports messages', () => {
  const history = new ConversationHistory();
  history.addMessage({ role: 'user', content: 'Hello ANTRI' });
  history.addMessage({ role: 'assistant', content: 'Hello engineer!' });
  assert.strictEqual(history.length(), 2);
  const md = history.exportMarkdown();
  assert.ok(md.includes('Hello ANTRI'));
  assert.ok(md.includes('Hello engineer!'));
});

test('ToolExecutor has workspace and autonomous web tools defined', () => {
  assert.ok(AVAILABLE_TOOLS.length >= 8);
  const toolNames = AVAILABLE_TOOLS.map((t) => t.name);
  assert.ok(toolNames.includes('execute_python'));
  assert.ok(toolNames.includes('synthesize_skill'));
  assert.ok(toolNames.includes('web_search'));
  assert.ok(toolNames.includes('scrape_url'));
  assert.ok(toolNames.includes('crawl_docs'));
  assert.ok(toolNames.includes('read_file'));
  assert.ok(toolNames.includes('write_file'));
  assert.ok(toolNames.includes('list_dir'));
  assert.ok(toolNames.includes('run_command'));
});

test('Prompt Toolkit commands are registered including /plan, /vibe, /desktop, /alwaysallow, /goal', () => {
  assert.ok(PROMPT_TOOLKIT_COMMANDS.length >= 21);
  const names = PROMPT_TOOLKIT_COMMANDS.map((c) => c.name.split(' ')[0]);
  assert.ok(names.includes('/plan'));
  assert.ok(names.includes('/vibe'));
  assert.ok(names.includes('/desktop'));
  assert.ok(names.includes('/alwaysallow'));
  assert.ok(names.includes('/goal'));
  assert.ok(names.includes('/loop'));
  assert.ok(names.includes('/update'));
  assert.ok(names.includes('/profile'));
  assert.ok(names.includes('/notes'));
  assert.ok(names.includes('/meta'));
  assert.ok(names.includes('/skills'));
  assert.ok(names.includes('/debate'));
  assert.ok(names.includes('/depth'));
  assert.ok(names.includes('/memory'));
  assert.ok(names.includes('/consolidate'));
  assert.ok(names.includes('/learn'));
  assert.ok(names.includes('/connect'));
  assert.ok(names.includes('/models'));
  assert.ok(names.includes('/tools'));
  assert.ok(names.includes('/help'));
  assert.ok(names.includes('/clear'));
  assert.ok(names.includes('/history'));
  assert.ok(names.includes('/exit'));
});

test('ProfileManager manages markdown profiles and extracts notes', () => {
  const pm = new ProfileManager();
  const profiles = pm.listProfiles();
  assert.ok(profiles.length > 0);
  assert.ok(profiles.some((p) => p.name === 'profile_1'));

  pm.createProfile('test_architect', 'Architect profile test');
  assert.strictEqual(pm.getActiveProfileName(), 'test_architect');

  const content = pm.getActiveProfileContent();
  assert.ok(content.includes('User Profile: test_architect'));

  const extracted = pm.extractAndRecordNotes('I prefer pure functional React components over class components');
  assert.ok(extracted);
  assert.ok(extracted.includes('pure functional'));

  const updatedContent = pm.getActiveProfileContent();
  assert.ok(updatedContent.includes('pure functional'));
});

test('SandboxEngine executes Python scripts in isolated runtime', async () => {
  const code = `
x = 15
y = 25
print(f"RESULT: {x * y}")
`;
  const res = await SandboxEngine.executePython(code);
  assert.strictEqual(res.exitCode, 0);
  assert.ok(res.stdout.includes('RESULT: 375'));
});

test('SkillSynthesizer creates, verifies, and stores custom dynamic tool', async () => {
  const skillCode = `
import json, hashlib
text = args.get("text", "hello")
hashed = hashlib.sha256(text.encode()).hexdigest()
print(json.dumps({"hash": hashed}))
`;
  const syn = await SkillSynthesizer.synthesizeSkill(
    'test_hasher',
    'Calculate SHA256 hash of text',
    'python',
    skillCode,
    { text: { type: 'string', description: 'Text to hash' } },
    { text: 'antri_code' }
  );

  assert.strictEqual(syn.success, true);
  const dynamicTools = getAllActiveTools();
  assert.ok(dynamicTools.some((t) => t.name === 'test_hasher'));

  const output = await SkillSynthesizer.executeCustomSkill('test_hasher', { text: 'antri_code' });
  assert.ok(output.includes('hash'));
});

test('MetaOptimizer records tool performance and tracks heuristics', () => {
  const meta = new MetaOptimizer();
  meta.recordToolExecution('web_search', 250, false);
  meta.recordToolExecution('web_search', 300, false);
  meta.recordSelfHealing();
  meta.addHeuristic('Prefer compact summaries for small CLI viewports');

  const metrics = meta.getMetrics();
  assert.ok(metrics.toolCallStats['web_search'].calls >= 2);
  assert.ok(metrics.selfHealingRepairs >= 1);
  assert.ok(metrics.learnedPromptHeuristics.some((h) => h.includes('compact summaries')));
});

test('VectorStore generates normalized embeddings and calculates cosine similarity', async () => {
  const v1 = await VectorStore.generateEmbedding('TypeScript interfaces and types');
  const v2 = await VectorStore.generateEmbedding('TypeScript type aliases and interface contracts');
  const v3 = await VectorStore.generateEmbedding('Banana pancake breakfast recipe');

  assert.strictEqual(v1.length, 128);
  assert.strictEqual(v2.length, 128);

  const sim12 = VectorStore.cosineSimilarity(v1, v2);
  const sim13 = VectorStore.cosineSimilarity(v1, v3);

  assert.ok(sim12 > sim13); // Related topics should have higher similarity
});

test('EpisodicMemory records and searches interaction episodes', () => {
  const episodic = new EpisodicMemory();
  const ep = episodic.record(
    'How do I fix TypeScript circular dependency?',
    'Use interface imports or type-only imports like import type { X } from ...'
  );
  assert.ok(ep.id);
  assert.ok(ep.tags.includes('typescript'));

  const results = episodic.search('circular dependency');
  assert.ok(results.length > 0);
  assert.ok(results[0].query.includes('circular dependency'));
});

test('SemanticMemory indexes knowledge and performs vector search', async () => {
  const semantic = new SemanticMemory();
  await semantic.store(
    'Always use Redis SETNX for distributed concurrency locks with a TTL expiration.',
    'problem_solution',
    { tags: ['redis', 'concurrency'] }
  );

  const matches = await semantic.search('distributed locks concurrency in redis', 2);
  assert.ok(matches.length > 0);
  assert.ok(matches[0].item.text.includes('Redis SETNX'));
  assert.ok(matches[0].similarity > 0.2);
});

test('ProfileMemory stores preferences and workspace conventions', () => {
  const profile = new ProfileMemory();
  profile.recordWorkspaceConvention(process.cwd(), 'Use NodeNext module resolution for all ESM builds');
  const conventions = profile.getWorkspaceConventions(process.cwd());
  assert.ok(conventions.length > 0);
  assert.ok(conventions.some((c) => c.includes('NodeNext')));
});

test('MemoryManager performs autonomous self-recall across all tiers', async () => {
  const manager = new MemoryManager();
  await manager.learn('Never expose private API keys in client-side bundles', 'lesson_learned', process.cwd());
  
  const { contextText, recalled } = await manager.selfRecall('API key security in client code', process.cwd());
  assert.ok(recalled.hasMemories);
  assert.ok(contextText.includes('Recalled Memory'));
  assert.ok(contextText.includes('API keys'));
});

test('CitationEngine records sources and formats bibliography', () => {
  const citations = new CitationEngine();
  citations.addSource('TypeScript Docs', 'https://typescriptlang.org', 'Official docs', 'Documentation');
  citations.addSource('DuckDuckGo Search', 'https://duckduckgo.com/?q=typescript', undefined, 'DuckDuckGo');

  const sources = citations.getSources();
  assert.strictEqual(sources.length, 2);
  assert.strictEqual(sources[0].id, 1);
  assert.strictEqual(sources[1].id, 2);

  const bib = citations.generateBibliography();
  assert.ok(bib.includes('### 📚 Sources & Citations'));
  assert.ok(bib.includes('[^1] [TypeScript Docs](https://typescriptlang.org)'));
});

test('DialecticEngine initializes and constructs pipeline', () => {
  const manager = new ConfigManager();
  const config = manager.get();
  const engine = new DialecticEngine(config);
  assert.ok(engine);
  assert.strictEqual(typeof engine.debate, 'function');
});

test('getAvailableModels returns ONLY models for the active configured provider', async () => {
  const manager = new ConfigManager();
  const config = manager.get();
  config.provider = 'nvidia-nim';
  const models = await getAvailableModels(config);
  assert.ok(models.length > 0);
  for (const m of models) {
    assert.strictEqual(m.provider, 'nvidia-nim');
  }
});

test('Providers list contains Cerebras, Cohere, Vortex, OpenCode, DeepSeek, NVIDIA NIM, OpenAI, Anthropic, Gemini, Ollama, Custom', () => {
  const ids = PROVIDERS_LIST.map((p) => p.id);
  assert.ok(ids.includes('cerebras'));
  assert.ok(ids.includes('cohere'));
  assert.ok(ids.includes('vortex'));
  assert.ok(ids.includes('opencode'));
  assert.ok(ids.includes('deepseek'));
  assert.ok(ids.includes('nvidia-nim'));
  assert.ok(ids.includes('openai'));
  assert.ok(ids.includes('anthropic'));
  assert.ok(ids.includes('gemini'));
  assert.ok(ids.includes('ollama'));
  assert.ok(ids.includes('custom'));
});

test('New providers catalogs are accurately defined without cross-contamination', async () => {
  const manager = new ConfigManager();
  const config = manager.get();

  // Test Cerebras catalog
  config.provider = 'cerebras';
  const cerebrasModels = await getAvailableModels(config);
  assert.ok(cerebrasModels.length >= 4);
  assert.ok(cerebrasModels.some((m) => m.id === 'llama-3.3-70b'));
  assert.ok(cerebrasModels.every((m) => m.provider === 'cerebras'));

  // Test Cohere catalog
  config.provider = 'cohere';
  const cohereModels = await getAvailableModels(config);
  assert.ok(cohereModels.length >= 5);
  assert.ok(cohereModels.some((m) => m.id.startsWith('command-r')));
  assert.ok(cohereModels.every((m) => m.provider === 'cohere'));

  // Test Vortex catalog
  config.provider = 'vortex';
  const vortexModels = await getAvailableModels(config);
  assert.ok(vortexModels.length >= 5);
  assert.ok(vortexModels.some((m) => m.id === 'vortex-llama-3.3-70b-instruct'));
  assert.ok(vortexModels.every((m) => m.provider === 'vortex'));

  // Test OpenCode catalog
  config.provider = 'opencode';
  const opencodeModels = await getAvailableModels(config);
  assert.ok(opencodeModels.length >= 5);
  assert.ok(opencodeModels.some((m) => m.id === 'opencode/deepseek-coder-v2.5'));
  assert.ok(opencodeModels.every((m) => m.provider === 'opencode'));
});

test('DesktopServer initializes and starts on an ephemeral port', async () => {
  const desktop = new DesktopServer();
  assert.ok(desktop);
  const port = await desktop.start();
  assert.ok(port >= 3456);
  await desktop.stop();
});

test('ToolExecutor list_dir works on current directory', async () => {
  const executor = new ToolExecutor(process.cwd());
  const res = await executor.execute('list_dir', { dir_path: '.' }, 'test-1');
  assert.strictEqual(res.error, undefined);
  assert.ok(res.output.includes('package.json'));
});
