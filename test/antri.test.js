process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigManager, configManager } from '../dist/core/config.js';
import { ConversationHistory } from '../dist/core/history.js';
import { ToolExecutor, AVAILABLE_TOOLS, getAllActiveTools, SENSITIVE_TOOLS, extractEchoMessage } from '../dist/core/tools.js';
import { PROMPT_TOOLKIT_COMMANDS } from '../dist/cli/promptToolkit.js';
import { PROVIDER_CATALOGS, getAvailableModels } from '../dist/providers/models.js';
import { PROVIDERS_LIST } from '../dist/cli/dialogs/providerPicker.js';
import { ToolInspector, TerminalRenderer } from '../dist/cli/renderer.js';
import { FilePickerService } from '../dist/cli/dialogs/filePicker.js';
import { CitationEngine } from '../dist/core/citations.js';
import { DialecticEngine } from '../dist/core/dialectic.js';
import { VectorStore } from '../dist/memory/vectorStore.js';
import { EpisodicMemory } from '../dist/memory/episodic.js';
import { SemanticMemory } from '../dist/memory/semantic.js';
import { ProfileMemory } from '../dist/memory/profile.js';
import { MemoryManager, memoryManager } from '../dist/memory/manager.js';
import { SandboxEngine } from '../dist/core/sandbox.js';
import { SkillSynthesizer } from '../dist/core/skillSynthesizer.js';
import { MetaOptimizer } from '../dist/core/metaOptimizer.js';
import { ProfileManager, profileManager } from '../dist/profiles/profileManager.js';
import { SkillManager } from '../dist/skills/skillManager.js';
import { Updater } from '../dist/core/updater.js';
import { GoalLoopEngine } from '../dist/core/goalLoop.js';
import { DesktopServer } from '../dist/desktop/server.js';
import { MobileServer } from '../dist/mobile/server.js';
import { FirestoreSyncManager } from '../dist/cloud/firestore.js';
import { AuthManager } from '../dist/cloud/auth.js';
import { SessionManager, sessionManager } from '../dist/core/sessionManager.js';
import { AntriAgent, isGoalOrPlanQuery, isDebateOrTradeoffQuery, isCodingQuery, isBugOrReproductionQuery, isCrashOrReplayQuery, isArtifactOrVisualPrompt } from '../dist/core/agent.js';
import { BugTwinEngine } from '../dist/core/bugTwin.js';
import { CrashZeroEngine } from '../dist/core/crashZero.js';
import { artifactManager } from '../dist/core/artifactManager.js';
import { CodebaseBreather, ProjectContextCache } from '../dist/core/codebaseBreather.js';

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
  assert.strictEqual(Updater.CURRENT_VERSION, '1.57.42');
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
  assert.ok(content.includes('Profile: test_architect'));

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
  assert.ok(matches.some((m) => m.item.text.includes('Redis SETNX')));
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

test('MobileServer initializes and starts on an ephemeral port', async () => {
  const mobile = new MobileServer();
  assert.ok(mobile);
  const { port, localIp } = await mobile.start();
  assert.ok(port >= 3457);
  assert.ok(localIp);
  await mobile.stop();
});

test('ToolExecutor enforces authentication gate and executes when logged in', async () => {
  AuthManager.logout();
  const executor = new ToolExecutor(process.cwd());
  const unauthedRes = await executor.execute('list_dir', { dir_path: '.' }, 'test-unauthed');
  assert.strictEqual(unauthedRes.error, true);
  assert.ok(unauthedRes.output.includes('AUTHENTICATION REQUIRED'));

  // Log in and verify execution
  await AuthManager.login('test_suite@example.com');
  const res = await executor.execute('list_dir', { dir_path: '.' }, 'test-1');
  assert.strictEqual(res.error, undefined);
  assert.ok(res.output.includes('package.json'));
  AuthManager.logout();
});

test('FirestoreSyncManager configures project and sync parameters', () => {
  const original = FirestoreSyncManager.getSyncConfig();
  try {
    FirestoreSyncManager.saveSyncConfig('test-gcp-project', 'test-sync-key');
    const cfg = FirestoreSyncManager.getSyncConfig();
    assert.strictEqual(cfg.projectId, 'test-gcp-project');
    assert.strictEqual(cfg.syncKey, 'test-sync-key');
    assert.ok(cfg.lastSynced);
  } finally {
    if (original && original.projectId) {
      FirestoreSyncManager.saveSyncConfig(original.projectId, original.syncKey || 'default_user', original.apiKey || '');
    }
  }
});

test('AuthManager generates unique partition IDs, logins, and logs out', async () => {
  const email = 'test_dev@example.com';
  const userId = AuthManager.generateUserId(email);
  assert.ok(userId.startsWith('test_dev_'));

  const loginRes = await AuthManager.login(email);
  assert.strictEqual(loginRes.success, true);
  assert.strictEqual(loginRes.user.email, email);

  const current = AuthManager.getCurrentUser();
  assert.ok(current);
  assert.strictEqual(current.email, email);

  AuthManager.logout();
  const loggedOut = AuthManager.getCurrentUser();
  assert.strictEqual(loggedOut, null);
});

test('AuthManager strictly isolates profiles and API keys across different user accounts', async () => {
  const { configManager } = await import('../dist/core/config.js');
  const { profileManager } = await import('../dist/profiles/profileManager.js');

  // 1. User A logs in
  const userARes = await AuthManager.login('alice@example.com');
  assert.strictEqual(userARes.success, true);
  configManager.setApiKey('openai', 'sk-alice-secret-key-12345');
  profileManager.createProfile('alice_custom_profile', 'Alice profile');
  
  const aliceProfiles = profileManager.listProfiles().map(p => p.name);
  assert.ok(aliceProfiles.includes('alice_custom_profile'));
  assert.strictEqual(configManager.get().apiKeys.openai, 'sk-alice-secret-key-12345');

  // 2. User B logs in (Different account)
  const userBRes = await AuthManager.login('bob@example.com');
  assert.strictEqual(userBRes.success, true);
  
  // Bob must NOT see Alice's API key or custom profile
  assert.strictEqual(configManager.get().apiKeys.openai, undefined);
  const bobProfiles = profileManager.listProfiles().map(p => p.name);
  assert.strictEqual(bobProfiles.includes('alice_custom_profile'), false);
  
  // Bob creates their own profile and API key
  configManager.setApiKey('cerebras', 'cerebras-bob-secret-99999');
  profileManager.createProfile('bob_custom_profile', 'Bob profile');
  const bobProfilesUpdated = profileManager.listProfiles().map(p => p.name);
  assert.ok(bobProfilesUpdated.includes('bob_custom_profile'));
  assert.strictEqual(configManager.get().apiKeys.cerebras, 'cerebras-bob-secret-99999');

  // 3. User A logs back in
  await AuthManager.login('alice@example.com');
  assert.strictEqual(configManager.get().apiKeys.openai, 'sk-alice-secret-key-12345');
  assert.strictEqual(configManager.get().apiKeys.cerebras, undefined);
  const aliceProfilesReloaded = profileManager.listProfiles().map(p => p.name);
  assert.ok(aliceProfilesReloaded.includes('alice_custom_profile'));
  assert.strictEqual(aliceProfilesReloaded.includes('bob_custom_profile'), false);

  // 4. Test profile publishing
  const { FirestoreSyncManager } = await import('../dist/cloud/firestore.js');
  const publishRes = await FirestoreSyncManager.pushToFirestore();
  assert.strictEqual(publishRes.success, true);
  assert.ok(publishRes.count >= 1);

  AuthManager.logout();
});

test('SkillManager loads 14 core markdown skills including autonomous coder and artifact maker, parses frontmatter and triggers', () => {
  const manager = new SkillManager();
  const skills = manager.listSkills();
  assert.ok(skills.length >= 14);

  const artifactMaker = manager.getSkill('artifact_maker');
  assert.ok(artifactMaker);
  assert.ok(artifactMaker.triggers.includes('artifact'));
  assert.strictEqual(artifactMaker.isCore, true);

  const autonomousCoder = manager.getSkill('autonomous_coder');
  assert.ok(autonomousCoder);
  assert.ok(autonomousCoder.triggers.includes('code'));
  assert.strictEqual(autonomousCoder.isCore, true);

  const codeReviewer = manager.getSkill('code_reviewer');
  assert.ok(codeReviewer);
  assert.strictEqual(codeReviewer.name, 'Code Reviewer');
  assert.strictEqual(codeReviewer.isCore, true);
  assert.ok(codeReviewer.triggers.includes('review'));

  const systemArchitect = manager.getSkill('system_architect');
  assert.ok(systemArchitect);
  assert.strictEqual(systemArchitect.category, 'Architecture');

  // Find relevant skills for query
  const matches = manager.findRelevantSkills('Please review this code for security vulnerabilities');
  assert.ok(matches.length > 0);
  const matchIds = matches.map((m) => m.id);
  assert.ok(matchIds.includes('code_reviewer') || matchIds.includes('security_auditor'));
});

test('SkillManager creates, saves, imports, and deletes custom markdown skills', () => {
  const manager = new SkillManager();
  const skill = manager.createSkill(
    'test_custom_skill',
    'A custom testing skill for validation',
    'Testing',
    ['customtest', 'validation']
  );
  assert.ok(skill);
  assert.strictEqual(skill.id, 'test_custom_skill');

  const retrieved = manager.getSkill('test_custom_skill');
  assert.ok(retrieved);

  // Save updated content
  const updatedContent = `${retrieved.content}\n## Extra Section\nCustom instruction details.`;
  const saved = manager.saveSkill('test_custom_skill', updatedContent);
  assert.strictEqual(saved, true);

  // Delete
  const deleted = manager.deleteSkill('test_custom_skill');
  assert.strictEqual(deleted, true);
  assert.strictEqual(manager.getSkill('test_custom_skill'), undefined);
});

test('ProfileManager supports importing, saving, and deleting custom markdown profiles', () => {
  const profileMgr = new ProfileManager();
  const imported = profileMgr.importProfile(
    'imported_architect.md',
    '# 👤 User Profile: imported_architect\n- Communication: Architectural lead.\n'
  );
  assert.ok(imported);
  assert.strictEqual(imported.name, 'imported_architect');
  assert.strictEqual(profileMgr.getActiveProfileName(), 'imported_architect');

  const saved = profileMgr.saveProfile('imported_architect', '# 👤 User Profile: imported_architect\n- Updated rule.\n');
  assert.strictEqual(saved, true);

  const deleted = profileMgr.deleteProfile('imported_architect');
  assert.strictEqual(deleted, true);
  // Default fallback
  assert.strictEqual(profileMgr.getActiveProfileName(), 'profile_1');
});

test('ToolExecutor executes activate_skill and returns specialist markdown instructions', async () => {
  await AuthManager.login('test_dev@example.com');
  const executor = new ToolExecutor();
  const res = await executor.execute('activate_skill', { skill_name: 'code_reviewer' }, 'call_skill_1');
  assert.ok(res.output.includes('Code Reviewer'));
  assert.ok(res.output.includes('Review Checklist'));
});

test('ProfileManager initializes workspace notes.md and extracts user identity', () => {
  const profileMgr = new ProfileManager();
  profileMgr.ensureWorkspaceProfiles(process.cwd());

  const noted = profileMgr.extractAndRecordNotes('Hello, my name is Ashu and I prefer strict TypeScript.', process.cwd());
  assert.ok(noted);
  assert.ok(noted.includes('Ashu'));

  const allContext = profileMgr.getAllProfileContext(process.cwd());
  assert.ok(allContext.includes('USER IDENTITY, PROFILE & NOTES'));
  assert.ok(allContext.includes('RAG ACTIVE CONTEXT'));
  assert.ok(allContext.includes('profile_1.md'));
  assert.ok(allContext.includes('notes.md'));
});

test('ToolExecutor read_file executes with start_line and line count metadata', async () => {
  await AuthManager.login('test_dev@example.com');
  const executor = new ToolExecutor();
  const res = await executor.execute('read_file', { file_path: 'package.json', start_line: 1, max_lines: 10 }, 'call_read_1');
  assert.ok(res.output.includes('package.json'));
  assert.ok(res.output.includes('antri_cli'));
  assert.ok(res.output.includes('lines 1-'));

  // Clean up test authentication session so it doesn't pollute user environment
  AuthManager.logout();
});

test('ProfileManager extracts life events, family background, music hobbies, philosophy, and mindset nuances', () => {
  const profileMgr = new ProfileManager();
  
  const note1 = profileMgr.extractAndRecordNotes('I lost my father in 2021 and it changed my life.', process.cwd());
  assert.ok(note1);
  assert.ok(note1.includes('father'));

  const note2 = profileMgr.extractAndRecordNotes('I like to listning ot music when I write code.', process.cwd());
  assert.ok(note2);
  assert.ok(note2.includes('music'));

  const note3 = profileMgr.extractAndRecordNotes('My philosophy is pragmatism over dogma and I believe in epistemic humility.', process.cwd());
  assert.ok(note3);
  assert.ok(note3.includes('Philosophy') || note3.includes('pragmatism'));

  const note4 = profileMgr.extractAndRecordNotes('I tend to over-engineer things when I am tired so keep it simple.', process.cwd());
  assert.ok(note4);
  assert.ok(note4.includes('Mindset') || note4.includes('I tend to'));
});

test('ToolExecutor empathy guard prevents web_search on bereavement and personal grief', async () => {
  await AuthManager.login('test_dev@example.com');
  const executor = new ToolExecutor();
  const res = await executor.execute('web_search', { query: 'lost father 2021' }, 'call_search_1');
  assert.ok(res.output.includes('Web search is disabled for personal and emotional statements'));
  AuthManager.logout();
});

test('ProfileManager retrieves individual profiles and saves global/workspace notes', () => {
  const profileMgr = new ProfileManager();
  const prof1Content = profileMgr.getProfile('profile_1');
  assert.ok(prof1Content.length > 0);
  assert.ok(prof1Content.includes('profile_1'));

  const savedGlobal = profileMgr.saveGlobalNotes('# Global Notes Test\n- Note item 1');
  assert.strictEqual(savedGlobal, true);
  assert.ok(profileMgr.getGlobalNotesContent().includes('Global Notes Test'));

  const savedWs = profileMgr.saveWorkspaceNotes('# Workspace Notes Test\n- Local item 1', process.cwd());
  assert.strictEqual(savedWs, true);
  assert.ok(profileMgr.getWorkspaceNotesContent(process.cwd()).includes('Workspace Notes Test'));
});

test('FirestoreSyncManager dynamically binds syncKey to authenticated user partition', async () => {
  await AuthManager.login('sync_tester@domain.com');
  const syncCfg = FirestoreSyncManager.getSyncConfig();
  assert.strictEqual(syncCfg.syncKey, 'sync_tester_domain_com');
  AuthManager.logout();
});

test('FirestoreSyncManager deleteFromFirestore handles cloud deletion gracefully', async () => {
  await AuthManager.login('delete_test@domain.com');
  const res = await FirestoreSyncManager.deleteFromFirestore('temp_profile');
  assert.ok(typeof res.success === 'boolean');
  AuthManager.logout();
});

test('SessionManager manages multi-chat sessions and persists context', () => {
  const sm = new SessionManager();
  const initialSessions = sm.listSessions();
  assert.ok(initialSessions.length > 0);

  const newChat = sm.createSession('Test Architecture Discussion');
  assert.strictEqual(sm.getActiveSessionId(), newChat.id);
  assert.strictEqual(newChat.title, 'Test Architecture Discussion');

  sm.addMessageToActiveSession({ role: 'user', content: 'How should we architect the caching layer?' });
  sm.addMessageToActiveSession({ role: 'assistant', content: 'We should use a layered Redis and in-memory LRU cache.' });

  const active = sm.getActiveSession();
  assert.strictEqual(active.messages.length, 2);
  assert.strictEqual(active.messages[0].role, 'user');
  assert.strictEqual(active.messages[1].role, 'assistant');

  // Test session renaming and deletion
  sm.renameSession(newChat.id, 'Renamed Architecture Session');
  assert.strictEqual(sm.getSession(newChat.id)?.title, 'Renamed Architecture Session');

  const deleted = sm.deleteSession(newChat.id);
  assert.strictEqual(deleted, true);
  assert.strictEqual(sm.getSession(newChat.id), null);
});

test('ToolExecutor executes coding tools (write_file, edit_file, file_info, grep_search, find_files, create_directory, delete_file, git_diff)', async () => {
  await AuthManager.login('coder_test@example.com');
  const executor = new ToolExecutor();
  executor.setPermissionHandler(async () => true);

  // 1. create_directory
  const mkdirRes = await executor.execute('create_directory', { dir_path: 'temp_test_dir' }, 'c1');
  assert.ok(mkdirRes.output.includes('Successfully created directory'));

  // 2. write_file
  const writeRes = await executor.execute('write_file', { file_path: 'temp_test_dir/code.ts', content: 'export const x = 10;\nexport const y = 20;\n' }, 'c2');
  assert.ok(writeRes.output.includes('Successfully wrote'));

  // 3. edit_file
  const editRes = await executor.execute('edit_file', { file_path: 'temp_test_dir/code.ts', target_content: 'export const y = 20;', replacement_content: 'export const y = 99;' }, 'c3');
  assert.ok(editRes.output.includes('Successfully edited'));

  // 4. read_file
  const readRes = await executor.execute('read_file', { file_path: 'temp_test_dir/code.ts' }, 'c4');
  assert.ok(readRes.output.includes('export const y = 99;'));

  // 5. file_info
  const infoRes = await executor.execute('file_info', { file_path: 'temp_test_dir/code.ts' }, 'c5');
  assert.ok(infoRes.output.includes('Lines: 3'));
  assert.ok(infoRes.output.includes('Type: File'));

  // 6. grep_search
  const grepRes = await executor.execute('grep_search', { query: 'export const y', dir_path: 'temp_test_dir' }, 'c6');
  assert.ok(grepRes.output.includes('export const y = 99;'));

  // 7. find_files
  const findRes = await executor.execute('find_files', { pattern: '*.ts', dir_path: 'temp_test_dir' }, 'c7');
  assert.ok(findRes.output.includes('code.ts'));

  // 8. git_diff
  const diffRes = await executor.execute('git_diff', {}, 'c8');
  assert.ok(typeof diffRes.output === 'string');

  // 9. delete_file (cleanup)
  const delRes = await executor.execute('delete_file', { file_path: 'temp_test_dir' }, 'c9');
  assert.ok(delRes.output.includes('Successfully deleted'));

  AuthManager.logout();
});

test('DialecticEngine and GoalLoopEngine execute silent background pipelines with header badges', async () => {
  const mockConfig = { ...new ConfigManager().get(), provider: 'mock' };
  const dialectic = new DialecticEngine(mockConfig);
  const goalEngine = new GoalLoopEngine(mockConfig);

  assert.strictEqual(typeof dialectic.silentDebate, 'function');
  assert.strictEqual(typeof goalEngine.runSilentGoal, 'function');

  // Test silent debate
  const debateRes = await dialectic.silentDebate('Should we use Redis or PostgreSQL for session caching?', 'quick');
  assert.ok(debateRes.startsWith('> ⚔️ [Dialectic Debate Synthesized]'));

  // Test silent goal
  const goalRes = await goalEngine.runSilentGoal('Design a fault-tolerant distributed lock service');
  assert.ok(goalRes.startsWith('> 🎯 [Goal Loop Plan Synthesized]'));
});

test('DialecticEngine and GoalLoopEngine stream real-time stages and emit structured results for Desktop panel', async () => {
  const mockConfig = { ...new ConfigManager().get(), provider: 'mock' };
  const dialectic = new DialecticEngine(mockConfig);
  const goalEngine = new GoalLoopEngine(mockConfig);

  // 1. DialecticEngine debate with streaming callbacks
  const dialecticStages = [];
  const dialecticTokens = [];
  const dialecticStatuses = [];

  const debateResult = await dialectic.debate('WebSockets vs Server-Sent Events', 'quick', {
    onStatus: (status) => dialecticStatuses.push(status),
    onStage: (stage) => dialecticStages.push(stage),
    onToken: (persona, token) => dialecticTokens.push({ persona, token }),
  });

  assert.ok(debateResult);
  assert.strictEqual(typeof debateResult.thesis, 'string');
  assert.strictEqual(typeof debateResult.antithesis, 'string');
  assert.strictEqual(typeof debateResult.synthesis, 'string');
  assert.ok(dialecticStages.length >= 2, 'Dialectic should emit at least 2 stages in quick depth');
  assert.ok(dialecticStatuses.length >= 2, 'Dialectic should emit status updates for personas');
  assert.ok(dialecticTokens.length > 0, 'Dialectic should stream tokens to callbacks');

  // 2. GoalLoopEngine runGoal with streaming callbacks and structured result
  const goalStages = [];
  const goalTokens = [];
  const goalStatuses = [];

  const goalResult = await goalEngine.runGoal('Implement a zero-dependency LRU cache with TTL in TypeScript', 3, {
    onStatus: (status) => goalStatuses.push(status),
    onStage: (stage) => goalStages.push(stage),
    onToken: (iter, token) => goalTokens.push({ iter, token }),
  });

  assert.ok(goalResult);
  assert.strictEqual(typeof goalResult.draft, 'string');
  assert.strictEqual(typeof goalResult.critique, 'string');
  assert.strictEqual(typeof goalResult.finalOutput, 'string');
  assert.ok(goalResult.iterations.length === 3, 'GoalLoop should track all 3 iterations');
  assert.ok(goalStages.length === 3, 'GoalLoop should emit 3 stage events');
  assert.ok(goalStatuses.length === 3, 'GoalLoop should emit 3 status events');
  assert.ok(goalTokens.length > 0, 'GoalLoop should stream tokens to callbacks');
});

test('DesktopServer /api/debate and /api/goal stream SSE events cleanly', async () => {
  const prevProvider = configManager.get().provider;
  configManager.setProvider('mock');

  const server = new DesktopServer();
  const port = await server.start();

  try {
    // 1. Test POST /api/debate SSE stream
    const debateRes = await fetch(`http://localhost:${port}/api/debate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Redis vs Memcached', depth: 'quick' }),
    });
    assert.strictEqual(debateRes.status, 200);
    assert.strictEqual(debateRes.headers.get('content-type'), 'text/event-stream');

    const debateText = await debateRes.text();
    assert.ok(debateText.includes('event: start'));
    assert.ok(debateText.includes('event: stage') || debateText.includes('event: token'));
    assert.ok(debateText.includes('event: complete'));

    // 2. Test POST /api/goal SSE stream
    const goalRes = await fetch(`http://localhost:${port}/api/goal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objective: 'Build a JWT validator in TypeScript' }),
    });
    assert.strictEqual(goalRes.status, 200);
    assert.strictEqual(goalRes.headers.get('content-type'), 'text/event-stream');

    const goalText = await goalRes.text();
    assert.ok(goalText.includes('event: start'));
    assert.ok(goalText.includes('event: stage') || goalText.includes('event: token'));
    assert.ok(goalText.includes('event: complete'));
    assert.ok(goalText.includes('"draft"'));
    assert.ok(goalText.includes('"critique"'));
    assert.ok(goalText.includes('"finalOutput"'));
  } finally {
    await server.stop();
    configManager.setProvider(prevProvider);
  }
});

test('ArtifactManager smartly differentiates workout, diet, study, and todo plans', async () => {
  const { ArtifactManager } = await import('../dist/core/artifactManager.js');
  const { isCodingQuery, isGoalOrPlanQuery } = await import('../dist/core/agent.js');
  const tempDir = path.join(os.tmpdir(), 'antri_test_plans_' + Date.now());
  const manager = new ArtifactManager(tempDir);

  // 1. Query Categorization
  assert.strictEqual(isCodingQuery('create a workout plan for me'), false);
  assert.strictEqual(isCodingQuery('create a 7-day keto diet meal plan'), false);
  assert.strictEqual(isCodingQuery('build a todo app in React with Tailwind'), true);
  assert.strictEqual(isGoalOrPlanQuery('create a workout plan for me'), true);
  assert.strictEqual(isGoalOrPlanQuery('create a 7-day diet meal plan'), true);

  // 2. Workout Plan Generation (Must produce workout app with exercises and rest timer, NOT a todo app)
  const workoutHtml = manager.generatePlanSpaHtml('3-Day Hypertrophy Workout Plan', 'create a workout plan for me');
  assert.ok(workoutHtml.includes('Fitness & Workout Planner'));
  assert.ok(workoutHtml.includes('Rest Interval Timer'));
  assert.ok(workoutHtml.includes('Push & Chest') || workoutHtml.includes('Sets'));
  assert.ok(!workoutHtml.includes('Architect Database Schema'), 'Workout plan must NOT contain todo placeholder tasks');

  // 3. Diet Plan Generation
  const dietHtml = manager.generatePlanSpaHtml('7-Day Muscle Building Meal Plan', 'create a diet meal plan for me');
  assert.ok(dietHtml.includes('Targeted Nutrition & Meal Planner') || dietHtml.includes('Nutrition & Macro Engine'));
  assert.ok(dietHtml.includes('Calories') || dietHtml.includes('Protein'));

  // 4. Todo App Generation
  const todoHtml = manager.generatePlanSpaHtml('Sprint Tasks', 'create a todo task manager');
  assert.ok(todoHtml.includes('Task Manager'));
});

test('ToolExecutor executes run_silent_debate and run_silent_goal tools', async () => {
  await AuthManager.login('silent_tester@example.com');
  const prevProvider = configManager.get().provider;
  configManager.setProvider('mock');
  const executor = new ToolExecutor();
  executor.setPermissionHandler(async () => true);

  const debateToolRes = await executor.execute('run_silent_debate', { topic: 'Microservices vs Monolith' }, 'sd1');
  assert.ok(debateToolRes.output.includes('[Dialectic Debate Synthesized]'));

  const goalToolRes = await executor.execute('run_silent_goal', { goal: 'Create robust rate limiter' }, 'sg1');
  assert.ok(goalToolRes.output.includes('[Goal Loop Plan Synthesized]'));

  configManager.setProvider(prevProvider);
  AuthManager.logout();
});

test('ArtifactManager creates, stores, groups, and parses Claude-style artifacts', async () => {
  const { ArtifactManager } = await import('../dist/core/artifactManager.js');
  const tempArtifactsDir = path.join(os.tmpdir(), 'antri_test_artifacts_' + Date.now());
  const manager = new ArtifactManager(tempArtifactsDir);

  // 1. Save artifact
  const art1 = manager.saveArtifact({
    id: 'test_art_1',
    sessionId: 'session_1',
    sessionTitle: 'Football Routine Chat',
    title: '2-Day Football Stretching Plan',
    type: 'html',
    content: '<!DOCTYPE html><html><body><h1>Day 1 Warmup</h1></body></html>',
    createdAt: Date.now(),
  });
  assert.strictEqual(art1.id, 'test_art_1');
  assert.strictEqual(manager.getArtifact('test_art_1')?.title, '2-Day Football Stretching Plan');

  // 2. Save graph artifact
  const art2 = manager.saveArtifact({
    id: 'test_art_2',
    sessionId: 'session_1',
    sessionTitle: 'Football Routine Chat',
    title: 'Workout Architecture Flowchart',
    type: 'graph',
    content: 'graph TD\nA[Warmup] --> B[Dynamic Stretch]',
    createdAt: Date.now() + 100,
  });
  assert.strictEqual(art2.type, 'graph');

  // 2b. Save mindmap artifact
  const art3 = manager.saveArtifact({
    id: 'test_art_3',
    sessionId: 'session_1',
    sessionTitle: 'Football Routine Chat',
    title: 'Workout Concept Mind Map',
    type: 'mindmap',
    content: 'mindmap\n  root((Workout))\n    Warmup\n    Main\n    Cooldown',
    createdAt: Date.now() + 200,
  });
  assert.strictEqual(art3.type, 'mindmap');
  assert.strictEqual(manager.getArtifact('test_art_3')?.title, 'Workout Concept Mind Map');

  // 3. Check session grouping
  const grouped = manager.getArtifactsGroupedBySession();
  assert.ok(grouped.length >= 1);
  const session1Group = grouped.find((g) => g.sessionId === 'session_1');
  assert.ok(session1Group);
  assert.strictEqual(session1Group.artifacts.length, 3);

  // 4. Parse from text
  const rawResponse = 'Here is your stretching plan:\n<antri_artifact id="art_parsed_1" type="html" title="Hamstring Plan">\n<p>Hamstring stretches...</p>\n</antri_artifact>\nAnd mind map:\n<antri_artifact id="art_parsed_2" type="mindmap" title="Stretching Tree">\nmindmap\n  root((Stretching))\n</antri_artifact>\nEnjoy!';
  const { cleanText, artifacts } = manager.parseAndStoreArtifacts(rawResponse, 'session_2', 'Stretching Chat');
  assert.strictEqual(artifacts.length, 2);
  assert.strictEqual(artifacts[0].title, 'Hamstring Plan');
  assert.strictEqual(artifacts[1].title, 'Stretching Tree');
  assert.strictEqual(artifacts[1].type, 'mindmap');
  assert.ok(cleanText.includes('[Artifact Created: Hamstring Plan]'));
  assert.ok(cleanText.includes('[Artifact Created: Stretching Tree]'));
  assert.ok(cleanText.includes('🧠 Interactive Mind Map'));

  // 5. Delete artifact
  const deleted = manager.deleteArtifact('test_art_1');
  assert.strictEqual(deleted, true);
  assert.strictEqual(manager.getArtifact('test_art_1'), null);

  // Cleanup
  try {
    fs.rmSync(tempArtifactsDir, { recursive: true, force: true });
  } catch {}
});

test('ToolExecutor executes create_artifact tool with mindmap', async () => {
  await AuthManager.login('artifact_tester@example.com');
  const executor = new ToolExecutor();
  executor.setPermissionHandler(async () => true);

  const res = await executor.execute(
    'create_artifact',
    {
      title: 'Distributed Systems Mind Map',
      type: 'mindmap',
      content: 'mindmap\n  root((Distributed Systems))\n    Consensus\n      Raft\n      Paxos\n    Storage\n      LSM\n      B-Tree',
    },
    'art_tool_mindmap'
  );
  assert.ok(res.output.includes('Successfully created artifact'));
  assert.ok(res.output.includes('Distributed Systems Mind Map'));
  assert.ok(res.output.includes('mindmap'));

  AuthManager.logout();
});

test('Prompt Toolkit contains /imagine, /mindmap, /view, and /artifacts commands', async () => {
  const { PROMPT_TOOLKIT_COMMANDS } = await import('../dist/cli/promptToolkit.js');
  const cmdNames = PROMPT_TOOLKIT_COMMANDS.map((c) => c.name);
  assert.ok(cmdNames.includes('/imagine'));
  assert.ok(cmdNames.includes('/mindmap'));
  assert.ok(cmdNames.includes('/view'));
  assert.ok(cmdNames.includes('/artifacts'));
});

test('extractEchoMessage extracts speech from echo/printf commands and ToolExecutor handles echo directly', async () => {
  const msg1 = extractEchoMessage("echo 'Hello again, I\\'m ANTRI Code, your intelligent companion.'");
  assert.strictEqual(msg1, "Hello again, I'm ANTRI Code, your intelligent companion.");

  const msg2 = extractEchoMessage('echo "Welcome to ANTRI!"');
  assert.strictEqual(msg2, 'Welcome to ANTRI!');

  const msg3 = extractEchoMessage('printf "Hello world"');
  assert.strictEqual(msg3, 'Hello world');

  const nonEcho = extractEchoMessage('npm test');
  assert.strictEqual(nonEcho, null);

  const redirectCmd = extractEchoMessage('echo "foo" > file.txt');
  assert.strictEqual(redirectCmd, null);

  // Test ToolExecutor handling
  await AuthManager.login('echo_tester@example.com');
  const executor = new ToolExecutor();
  const res = await executor.execute('run_command', { command: 'echo "Hello there!"' }, 'echo_c1');
  assert.strictEqual(res.output, 'Hello there!');
  assert.strictEqual(res.error, undefined);
  AuthManager.logout();
});

test('SelfDebugger diagnoses ANTRI blocking bugs accurately without crashing', async () => {
  const { SelfDebugger } = await import('../dist/core/debugger.js');
  const config = configManager.get();

  // Test 401 API key diagnosis
  const authDiag = SelfDebugger.diagnoseAntriError(new Error('401 Unauthorized: Invalid API key provided'), config);
  assert.strictEqual(authDiag.isError, true);
  assert.strictEqual(authDiag.component, 'provider');
  assert.ok(authDiag.blockingBug.includes('Invalid or missing API key'));
  assert.ok(authDiag.recommendedFix.includes('/key'));

  // Test 429 Rate Limit diagnosis
  const rateDiag = SelfDebugger.diagnoseAntriError(new Error('429 Too Many Requests - tokens per minute quota reached'), config);
  assert.strictEqual(rateDiag.isError, true);
  assert.strictEqual(rateDiag.component, 'provider');
  assert.ok(rateDiag.blockingBug.includes('rate limit or quota'));

  // Test 404 Model Not Found diagnosis
  const modelDiag = SelfDebugger.diagnoseAntriError(new Error('404 The model `gpt-99` does not exist'), config);
  assert.strictEqual(modelDiag.isError, true);
  assert.strictEqual(modelDiag.component, 'provider');
  assert.ok(modelDiag.blockingBug.includes('was not found or is unsupported'));

  // Test Network failure diagnosis
  const netDiag = SelfDebugger.diagnoseAntriError(new Error('fetch failed: ECONNREFUSED 127.0.0.1:11434'), config);
  assert.strictEqual(netDiag.isError, true);
  assert.strictEqual(netDiag.component, 'network');
  assert.ok(netDiag.blockingBug.includes('Network connection failed'));

  // Test JSON Corruption diagnosis
  const jsonDiag = SelfDebugger.diagnoseAntriError(new Error('SyntaxError: Unexpected token in JSON at position 0'), config);
  assert.strictEqual(jsonDiag.isError, true);
  assert.strictEqual(jsonDiag.component, 'session');

  // Test handleAntriError returns clean diagnosis & fallback without throwing
  const handleRes = await SelfDebugger.handleAntriError(new Error('ECONNREFUSED test error'), config, true);
  assert.strictEqual(handleRes.healed, false);
  assert.ok(handleRes.fallbackResponse.includes('ANTRI Self-Debugger'));
});

test('SelfDebugger runSelfDoctor performs full health checks and auto-repairs storage', async () => {
  const { SelfDebugger } = await import('../dist/core/debugger.js');
  const config = configManager.get();
  const res = await SelfDebugger.runSelfDoctor(config);
  assert.ok(typeof res.healthy === 'boolean');
  assert.ok(Array.isArray(res.issues));
  assert.ok(typeof res.repairedCount === 'number');
});

test('ConfigManager hasActiveApiKey validates provider API key status correctly', () => {
  const manager = new ConfigManager();
  
  // Ollama is local, always configured
  const ollamaStatus = manager.hasActiveApiKey('ollama');
  assert.strictEqual(ollamaStatus.configured, true);

  // Mock provider is offline, not an active real API key
  const mockStatus = manager.hasActiveApiKey('mock');
  assert.strictEqual(mockStatus.configured, false);
});

test('ProjectBugFixer enforces Authentication Gate when user is not logged in', async () => {
  const { ProjectBugFixer } = await import('../dist/core/fixer.js');
  AuthManager.logout();
  assert.strictEqual(AuthManager.isAuthenticated(), false);

  const res = await ProjectBugFixer.runFix('fix test bug');
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.reason, 'auth_required');
});

test('ProjectBugFixer enforces API Key Setup Gate when provider is unconfigured', async () => {
  const { ProjectBugFixer } = await import('../dist/core/fixer.js');
  await AuthManager.login('fix_tester@example.com');
  
  // Temporarily set provider to an unconfigured provider with no key
  const origProvider = configManager.get().provider;
  configManager.set('provider', 'cerebras');
  delete process.env.CEREBRAS_API_KEY;
  configManager.get().apiKeys.cerebras = undefined;

  const res = await ProjectBugFixer.runFix('fix test bug');
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.reason, 'api_key_required');

  // Restore provider
  configManager.set('provider', origProvider);
  AuthManager.logout();
});

test('Prompt Toolkit commands include /fix, /selfheal, and /arch', async () => {
  const { PROMPT_TOOLKIT_COMMANDS } = await import('../dist/cli/promptToolkit.js');
  const names = PROMPT_TOOLKIT_COMMANDS.map((c) => c.name);
  assert.ok(names.includes('/fix'));
  assert.ok(names.includes('/selfheal'));
  assert.ok(names.includes('/arch'));
});

test('ArchitectureAnalyzer scans codebase and generates Mermaid flowchart', async () => {
  const { ArchitectureAnalyzer } = await import('../dist/core/architectureAnalyzer.js');
  const analysis = ArchitectureAnalyzer.analyze(process.cwd());
  assert.ok(analysis.projectName.length > 0);
  assert.ok(analysis.projectType.length > 0);
  assert.ok(Array.isArray(analysis.directories));
  assert.ok(analysis.mermaidDiagram.includes('graph TD'));
});

test('ArtifactManager enhances HTML artifacts with Tailwind CDN, Google Fonts, and Lucide icons', async () => {
  const { ArtifactManager } = await import('../dist/core/artifactManager.js');
  const manager = new ArtifactManager();
  
  // Test snippet enhancement
  const snippet = '<div class="card"><h1>Interactive Calculator</h1><button onclick="calculate()">Calc</button></div>';
  const enhancedSnippet = manager.enhanceHtmlArtifact(snippet, 'Calculator');
  assert.ok(enhancedSnippet.includes('<!DOCTYPE html>'));
  assert.ok(enhancedSnippet.includes('tailwindcss.com'));
  assert.ok(enhancedSnippet.includes('fonts.googleapis.com'));
  assert.ok(enhancedSnippet.includes('lucide'));

  // Test full HTML enhancement
  const fullHtml = '<!DOCTYPE html><html><head><title>Test</title></head><body><div data-lucide="activity"></div></body></html>';
  const enhancedFull = manager.enhanceHtmlArtifact(fullHtml, 'Test App');
  assert.ok(enhancedFull.includes('tailwindcss.com'));
  assert.ok(enhancedFull.includes('fonts.googleapis.com'));
  assert.ok(enhancedFull.includes('lucide'));
});

test('ToolExecutor.materializeNextJsTodoList materializes complete Next.js 14 task app', async () => {
  const { ToolExecutor } = await import('../dist/core/tools.js');
  const tempDir = path.join(os.tmpdir(), 'antri_test_todo_' + Date.now().toString(36));
  fs.mkdirSync(tempDir, { recursive: true });

  const files = ToolExecutor.materializeNextJsTodoList(tempDir);
  assert.ok(files.length >= 6);
  assert.ok(files.includes('package.json'));
  assert.ok(files.includes('app/page.tsx'));
  assert.ok(files.includes('app/layout.tsx'));
  assert.ok(files.includes('app/globals.css'));

  const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'));
  assert.strictEqual(pkg.name, 'todo-list-app');
  assert.ok(pkg.dependencies.next);
  assert.ok(pkg.dependencies.react);

  const pageContent = fs.readFileSync(path.join(tempDir, 'app/page.tsx'), 'utf-8');
  assert.ok(pageContent.includes('TodoApp'));
  assert.ok(pageContent.includes('Task Matrix'));

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('isGoalOrPlanQuery and isDebateOrTradeoffQuery accurately classify multi-day plans and architectural trade-offs', () => {
  // Goal & Multi-Day Plan Queries
  assert.strictEqual(isGoalOrPlanQuery('generate 5 day workout plan'), true);
  assert.strictEqual(isGoalOrPlanQuery('create a 7-day diet plan for weight loss'), true);
  assert.strictEqual(isGoalOrPlanQuery('30 day study roadmap for Rust'), true);
  assert.strictEqual(isGoalOrPlanQuery('prepare a fitness plan'), true);
  assert.strictEqual(isGoalOrPlanQuery('/goal ship autonomous agent v2'), true);
  assert.strictEqual(isGoalOrPlanQuery('what is the weather today?'), false);

  // Debate & Trade-off Queries
  assert.strictEqual(isDebateOrTradeoffQuery('Rust vs Go for backend scalability'), true);
  assert.strictEqual(isDebateOrTradeoffQuery('monolith versus microservices trade-offs'), true);
  assert.strictEqual(isDebateOrTradeoffQuery('pros and cons of PostgreSQL vs MongoDB'), true);
  assert.strictEqual(isDebateOrTradeoffQuery('/debate which database to choose'), true);
  assert.strictEqual(isDebateOrTradeoffQuery('write a hello world function'), false);
});

test('ArtifactManager.sanitizeAndEnhanceMindmap enhances economic and tech debate topics with rich domain data', async () => {
  const { ArtifactManager } = await import('../dist/core/artifactManager.js');
  const manager = new ArtifactManager();

  // Test 1: India vs France Economic Comparison
  const rawIndiaFrance = `mindmap\n  root((Comparative Economic Analysis: India vs France))\n    Primary Concept\n      Subtopic A`;
  const enhancedEcon = manager.sanitizeAndEnhanceMindmap(rawIndiaFrance, 'Economic Comparison: India vs France');
  assert.ok(enhancedEcon.includes('Economic Comparison: India vs France'));
  assert.ok(enhancedEcon.includes('Nominal / $14T PPP'));
  assert.ok(enhancedEcon.includes('Airbus'));
  assert.ok(enhancedEcon.includes('Rafale Aircraft'));
  assert.strictEqual(enhancedEcon.includes('Subtopic A'), false);

  // Test 2: Rust vs Go Architecture Comparison
  const rawRustGo = `mindmap\n  root((Rust vs Go: Architecture Comparison))\n    Core Strengths & Thesis\n      Primary Advantages`;
  const enhancedRustGo = manager.sanitizeAndEnhanceMindmap(rawRustGo, 'Rust vs Go Architectural Consensus');
  assert.ok(enhancedRustGo.includes('Rust vs Go'));
  assert.ok(enhancedRustGo.includes('Borrow Checker'));
  assert.ok(enhancedRustGo.includes('Goroutines & Channels'));
  assert.strictEqual(enhancedRustGo.includes('Primary Advantages'), false);
});

test('CodebaseBreather and ProjectContextCache analyze codebase and cache rich project metadata', async () => {
  const analysis = CodebaseBreather.analyzeCodebase(process.cwd());
  assert.ok(analysis.projectName);
  assert.ok(analysis.projectType);
  assert.ok(Array.isArray(analysis.techStack));
  assert.ok(analysis.totalFiles > 0);
  assert.ok(analysis.totalDirectories > 0);
  assert.ok(analysis.entryPoints.length > 0);
  assert.ok(analysis.topDirectories.length > 0);

  ProjectContextCache.set(process.cwd(), analysis);
  const cached = ProjectContextCache.get(process.cwd());
  assert.strictEqual(cached?.projectName, analysis.projectName);

  const summary = ProjectContextCache.getContextSummary(process.cwd());
  assert.ok(summary.includes('ANTRI CODEBASE INTELLIGENCE CACHE'));
  assert.ok(summary.includes(analysis.projectName));
});

test('isCodingQuery accurately classifies software development and coding prompts', () => {
  assert.strictEqual(isCodingQuery('code a snake game in vanilla js with html and css'), true);
  assert.strictEqual(isCodingQuery('build a fullstack next.js portfolio website'), true);
  assert.strictEqual(isCodingQuery('implement an LRU cache algorithm in typescript'), true);
  assert.strictEqual(isCodingQuery('create a fastapi backend server with sqlite'), true);
  assert.strictEqual(isCodingQuery('make a todo app with localstorage'), true);
  assert.strictEqual(isCodingQuery('refactor this legacy component into clean modular code'), true);
  assert.strictEqual(isCodingQuery('what is the capital of france?'), false);
  assert.strictEqual(isCodingQuery('why does the sky appear blue?'), false);
  assert.strictEqual(isCodingQuery('how to stay motivated while studying?'), false);
});

test('SkillManager registers and seeds expanded hardcoded engineering skills', () => {
  const sm = new SkillManager();
  const skills = sm.listSkills();
  const ids = skills.map((s) => s.id);

  assert.ok(ids.includes('autonomous_coder'));
  assert.ok(ids.includes('artifact_maker'));
  assert.ok(ids.includes('production_fullstack_architect'));
  assert.ok(ids.includes('frontend_craftsman'));
  assert.ok(ids.includes('backend_systems_engineer'));
  assert.ok(ids.includes('algorithm_engineer'));
  assert.ok(ids.includes('test_automation_architect'));
  assert.ok(ids.includes('codebase_refactor_pro'));

  const autoCoder = sm.getSkill('autonomous_coder');
  assert.ok(autoCoder);
  assert.ok(autoCoder.instructions.includes('ABSOLUTE PROHIBITION OF 4-5 LINE TOY CODEBASES'));

  const fullstack = sm.getSkill('production_fullstack_architect');
  assert.ok(fullstack);
  assert.strictEqual(fullstack.category, 'Engineering');

  const frontend = sm.getSkill('frontend_craftsman');
  assert.ok(frontend);
  assert.ok(frontend.instructions.includes('Visual Hierarchy & Typography'));
});

test('ToolExecutor executes multi-line command pipeline with step-by-step reporting', async () => {
  await AuthManager.login('cmd_tester@example.com');
  const executor = new ToolExecutor(process.cwd());

  const multiCmd = `
    node -e "console.log('step 1 output')"
    node -e "console.log('step 2 output')"
  `;

  const res = await executor.execute('run_command', { command: multiCmd }, 'multi-test');
  assert.strictEqual(res.error, undefined);
  assert.ok(res.output.includes('step 1 output'));
  assert.ok(res.output.includes('step 2 output'));
  AuthManager.logout();
});

test('TerminalRenderer formats printToolStart and printToolFinish accurately', () => {
  const tc = {
    id: 'call_123',
    type: 'function',
    function: {
      name: 'run_command',
      arguments: JSON.stringify({ command: 'git status' }),
    },
  };

  const res = {
    tool_call_id: 'call_123',
    name: 'run_command',
    output: 'On branch main\nnothing to commit',
  };

  assert.doesNotThrow(() => {
    TerminalRenderer.printToolStart(tc, 1, 3);
    TerminalRenderer.printToolFinish(tc, res, 120, 1, 3);
  });
});

test('BugTwinEngine synthesizes reproduction tests, confirms Red failure, and generates visual sandbox artifact', async () => {
  await AuthManager.login('bugtwin_tester@example.com');
  const engine = new BugTwinEngine(configManager.get(), process.cwd());
  
  const bugReport = 'TypeError: Cannot read properties of undefined (reading "map") in ItemList.tsx when items array is null';
  const result = await engine.reproduceAndFix(bugReport, { cleanReproFile: true });
  
  assert.ok(result);
  assert.strictEqual(result.fixed, true);
  assert.strictEqual(result.verified, true);
  assert.ok(result.artifactId?.startsWith('bugtwin_'));
  assert.ok(result.artifactHtmlUrl?.includes('.html'));
  assert.ok(result.prSummary?.includes('BugTwin'));
  
  const artifact = artifactManager.getArtifact(result.artifactId);
  assert.ok(artifact);
  assert.strictEqual(artifact.type, 'html');
  assert.ok(artifact.content.includes('Interactive Component Sandbox'));
  assert.ok(artifact.content.includes('Visual State Flow & Lifecycle Graph'));
  AuthManager.logout();
});

test('CrashZeroEngine parses stack traces, synthesizes time-travel execution frames, and renders scrubbable replay artifact', async () => {
  await AuthManager.login('crashzero_tester@example.com');
  const engine = new CrashZeroEngine(configManager.get(), process.cwd());
  
  const sampleTrace = `TypeError: Cannot read properties of null (reading 'token')
    at Authenticator.validateToken (src/auth.ts:42:15)
    at handleRequest (src/server.ts:88:20)
    at Layer.handle [as handle_request] (node_modules/express/lib/router/layer.js:95:5)`;
    
  const result = await engine.replayAndHeal(sampleTrace);
  
  assert.ok(result);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.errorName, 'TypeError');
  assert.ok(result.timeTravelFrames.length >= 4);
  assert.strictEqual(result.timeTravelFrames[3].status, 'fatal_crash');
  assert.ok(result.artifactId?.startsWith('crashzero_'));
  assert.ok(result.artifactHtmlUrl?.includes('.html'));
  
  const artifact = artifactManager.getArtifact(result.artifactId);
  assert.ok(artifact);
  assert.ok(artifact.content.includes('Execution Time-Travel Scrubbing Bar'));
  assert.ok(artifact.content.includes('De-Minified Call Stack'));
  AuthManager.logout();
});

test('Intent Gating and Routing correctly separates coding, visual artifacts, BugTwin, and CrashZero', () => {
  // BugTwin / Reproduction Queries
  assert.strictEqual(isBugOrReproductionQuery('/reproduce https://github.com/org/repo/issues/42'), true);
  assert.strictEqual(isBugOrReproductionQuery('/bugtwin failing test assertion in payment checkout'), true);
  assert.strictEqual(isBugOrReproductionQuery('/fix broken button state'), true);
  assert.strictEqual(isBugOrReproductionQuery('reproduce bug: null pointer in parser'), true);
  assert.strictEqual(isBugOrReproductionQuery('diagnose and fix memory leak in worker'), true);

  // CrashZero / Replay Queries
  assert.strictEqual(isCrashOrReplayQuery('/replay TypeError: Uncaught promise rejection at index.js:10'), true);
  assert.strictEqual(isCrashOrReplayQuery('/crashzero Sentry Issue #84920'), true);
  assert.strictEqual(isCrashOrReplayQuery('sentry: event_id_992019 exception in billing'), true);

  // Visual Artifact Queries
  assert.strictEqual(isArtifactOrVisualPrompt('/mindmap Types of Rocks'), true);
  assert.strictEqual(isArtifactOrVisualPrompt('/view workout plan'), true);
  assert.strictEqual(isArtifactOrVisualPrompt('/imagine microservices architecture'), true);

  // Coding Queries
  assert.strictEqual(isCodingQuery('build a fullstack next.js portfolio website'), true);
  assert.strictEqual(isCodingQuery('code a snake game in vanilla js with html and css'), true);
  assert.strictEqual(isCodingQuery('implement an LRU cache algorithm in typescript'), true);

  // Zero Intent Confusion
  assert.strictEqual(isCodingQuery('what is the capital of france?'), false);
  assert.strictEqual(isBugOrReproductionQuery('build a todo app'), false);
  assert.strictEqual(isCrashOrReplayQuery('code a portfolio website'), false);
});

test('Agent handles /learn, /notes, and /profile commands seamlessly across Desktop and CLI', async () => {
  const agent = new AntriAgent({
    provider: 'mock',
    model: 'mock-model',
    alwaysAllow: true,
    workingDir: process.cwd(),
    apiKeys: {},
  });

  // Test /learn
  const learnRes = await agent.chat('/learn Always use strict TypeScript interfaces and immutability');
  assert.ok(learnRes.includes('Learned & Persisted to Memory'));
  assert.ok(learnRes.includes('Always use strict TypeScript interfaces and immutability'));

  // Test /notes
  const notesRes = await agent.chat('/notes');
  assert.ok(notesRes.includes('Thinking Profile & Captured Mindset Notes'));

  // Test /profile
  const profRes = await agent.chat('/profile');
  assert.ok(profRes.includes('Active Thinking Profile'));
});

test('ProfileManager automatically extracts personality, thinking style, and mindset nuances during chat', () => {
  const insight1 = profileManager.extractAndRecordNotes('My personality is analytical and I am an introvert who loves clean architecture', process.cwd());
  assert.ok(insight1);
  assert.ok(insight1.includes('analytical') || insight1.includes('clean architecture') || insight1.includes('introvert'));

  const insight2 = profileManager.extractAndRecordNotes('My thinking style is first principles and I prefer strict typing', process.cwd());
  assert.ok(insight2);
  assert.ok(insight2.includes('first principles') || insight2.includes('strict typing'));
});

test('Multi-account strict partition isolation: sessions, memory, profiles, and API keys are completely separated', async () => {
  const userA = 'user_alpha@test.com';
  const userB = 'user_beta@test.com';

  // 1. User A logs in
  await AuthManager.login(userA);
  const userAId = AuthManager.getCurrentUser().userId;

  // User A sets a custom API key, creates a profile, creates a session, and saves memory
  configManager.setApiKey('gemini', 'USER_A_SECRET_KEY');
  profileManager.createProfile('profile_alpha', 'Alpha Custom Profile');
  sessionManager.createSession('Alpha Private Chat');
  await memoryManager.learn('User Alpha loves Haskell and pure mathematics', 'lesson_learned');

  // Verify User A state
  assert.strictEqual(configManager.getApiKey('gemini'), 'USER_A_SECRET_KEY');
  assert.ok(profileManager.listProfiles().map((p) => p.id).includes('profile_alpha'));
  const userASessions = sessionManager.listSessions();
  assert.ok(userASessions.some((s) => s.title === 'Alpha Private Chat'));

  // 2. User B logs in
  await AuthManager.login(userB);
  const userBId = AuthManager.getCurrentUser().userId;
  assert.notStrictEqual(userAId, userBId);

  // Verify User B state is COMPLETELY isolated from User A
  // A. User B has NO API key from User A
  assert.strictEqual(configManager.getApiKey('gemini'), undefined);
  const activeKeyCheck = configManager.hasActiveApiKey('gemini');
  assert.strictEqual(activeKeyCheck.configured, false);

  // B. User B does NOT see User A's custom profiles
  assert.ok(!profileManager.listProfiles().map((p) => p.id).includes('profile_alpha'));
  assert.ok(profileManager.listProfiles().map((p) => p.id).includes('profile_1'));

  // C. User B does NOT see User A's chat sessions
  const userBSessions = sessionManager.listSessions();
  assert.ok(!userBSessions.some((s) => s.title === 'Alpha Private Chat'));

  // Cleanup
  AuthManager.logout();
});











