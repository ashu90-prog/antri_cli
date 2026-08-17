// ANTRI Mobile Standalone Android App Engine

let mobileConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  apiKey: '',
  baseUrl: '',
  mode: 'vibe',
};

let mobileProfiles = {};
let activeProfileName = 'mobile_profile_1';
let attachedMobileFiles = [];
let mobileEpisodes = [];
let mobileSemanticItems = [];

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
  loadMobileSettings();
  loadMobileProfiles();
  loadMobileMemory();
});

// Load Settings from LocalStorage
function loadMobileSettings() {
  const saved = localStorage.getItem('antri_mobile_settings');
  if (saved) {
    try {
      mobileConfig = { ...mobileConfig, ...JSON.parse(saved) };
    } catch (e) {}
  }

  const provSelect = document.getElementById('mobile-provider-select');
  if (provSelect) provSelect.value = mobileConfig.provider;
  const modelInput = document.getElementById('mobile-model-input');
  if (modelInput) modelInput.value = mobileConfig.model;
  const keyInput = document.getElementById('mobile-api-key-input');
  if (keyInput) keyInput.value = mobileConfig.apiKey || '';
  const urlInput = document.getElementById('mobile-base-url-input');
  if (urlInput) urlInput.value = mobileConfig.baseUrl || '';

  switchMode(mobileConfig.mode || 'vibe', false);
}

function saveMobileSettings() {
  mobileConfig.provider = document.getElementById('mobile-provider-select').value;
  mobileConfig.model = document.getElementById('mobile-model-input').value.trim() || 'deepseek-chat';
  mobileConfig.apiKey = document.getElementById('mobile-api-key-input').value.trim();
  mobileConfig.baseUrl = document.getElementById('mobile-base-url-input').value.trim();

  localStorage.setItem('antri_mobile_settings', JSON.stringify(mobileConfig));
  alert('Settings saved to mobile device.');
}

function onMobileProviderChange(prov) {
  mobileConfig.provider = prov;
  const modelMap = {
    deepseek: 'deepseek-chat',
    openai: 'gpt-4o',
    anthropic: 'claude-3-7-sonnet-20250219',
    gemini: 'gemini-2.5-flash',
    cerebras: 'llama-3.3-70b',
    cohere: 'command-r-plus-08-2024',
    vortex: 'vortex-llama-3.3-70b-instruct',
    opencode: 'opencode/deepseek-coder-v2.5',
    'nvidia-nim': 'meta/llama-3.1-8b-instruct',
    ollama: 'llama3.3:70b',
    custom: 'custom-model',
  };
  document.getElementById('mobile-model-input').value = modelMap[prov] || 'custom';
}

// Mode Switcher
function switchMode(mode, save = true) {
  mobileConfig.mode = mode;
  const btnVibe = document.getElementById('btn-mode-vibe');
  const btnPlan = document.getElementById('btn-mode-plan');

  if (mode === 'plan') {
    btnPlan.classList.add('active');
    btnVibe.classList.remove('active');
  } else {
    btnVibe.classList.add('active');
    btnPlan.classList.remove('active');
  }

  if (save) {
    localStorage.setItem('antri_mobile_settings', JSON.stringify(mobileConfig));
  }
}

// Navigation View Switcher
function switchMobileView(viewName) {
  document.querySelectorAll('.mobile-view').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((el) => el.classList.remove('active'));

  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');

  const views = ['chat', 'dialectic', 'goal', 'profiles', 'memory', 'settings'];
  const idx = views.indexOf(viewName);
  const btns = document.querySelectorAll('.nav-btn');
  if (btns[idx]) btns[idx].classList.add('active');
}

// Mobile File & Image Uploads (+)
function handleMobileFile(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  for (const file of files) {
    const reader = new FileReader();
    reader.onload = (e) => {
      attachedMobileFiles.push({
        name: file.name,
        type: file.type,
        isImage: file.type.startsWith('image/'),
        dataUrl: e.target.result,
      });
      renderMobileAttachmentTray();
    };

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  }

  event.target.value = '';
}

function renderMobileAttachmentTray() {
  const tray = document.getElementById('mobile-attachment-tray');
  if (!tray) return;

  if (attachedMobileFiles.length === 0) {
    tray.classList.add('hidden');
    tray.innerHTML = '';
    return;
  }

  tray.classList.remove('hidden');
  tray.innerHTML = '';

  attachedMobileFiles.forEach((file, index) => {
    const chip = document.createElement('div');
    chip.className = 'mobile-attach-chip';
    if (file.isImage) {
      chip.innerHTML = `
        <img src="${file.dataUrl}" alt="thumbnail" />
        <span>${file.name}</span>
        <button style="background:none;border:none;font-weight:700;" onclick="removeMobileAttachment(${index})">×</button>
      `;
    } else {
      chip.innerHTML = `
        <span>${file.name}</span>
        <button style="background:none;border:none;font-weight:700;" onclick="removeMobileAttachment(${index})">×</button>
      `;
    }
    tray.appendChild(chip);
  });
}

function removeMobileAttachment(index) {
  attachedMobileFiles.splice(index, 1);
  renderMobileAttachmentTray();
}

function autoGrowTextarea(element) {
  element.style.height = '5px';
  element.style.height = element.scrollHeight + 'px';
}

// Direct Multi-Provider Autonomous Caller for Standalone APK
async function callDirectProvider(systemPrompt, userPrompt, files = []) {
  const prov = mobileConfig.provider;
  const model = mobileConfig.model;
  const apiKey = mobileConfig.apiKey;
  const customUrl = mobileConfig.baseUrl;

  let fullPrompt = userPrompt;
  if (files.length > 0) {
    fullPrompt += '\n\n' + files.map((f) => `[File Attachment: ${f.name}]\n${f.dataUrl.slice(0, 500)}`).join('\n\n');
  }

  // Active Profile Context
  const profileInstructions = mobileProfiles[activeProfileName] || '';
  const finalSystemPrompt = `${systemPrompt}\n\nUser Profile & Conventions:\n${profileInstructions}\nMode: ${mobileConfig.mode.toUpperCase()}`;

  // 1. OpenAI Compatible (DeepSeek, OpenAI, Cerebras, OpenCode, Vortex, NVIDIA NIM, Ollama, Custom)
  const baseUrls = {
    deepseek: 'https://api.deepseek.com/v1',
    openai: 'https://api.openai.com/v1',
    cerebras: 'https://api.cerebras.ai/v1',
    vortex: 'https://api.vortex.ai/v1',
    opencode: 'https://api.opencode.ai/v1',
    'nvidia-nim': 'https://integrate.api.nvidia.com/v1',
    ollama: customUrl || 'http://10.0.2.2:11434/v1',
    custom: customUrl || 'http://10.0.2.2:8000/v1',
  };

  if (baseUrls[prov] || prov === 'custom') {
    const endpoint = `${baseUrls[prov] || customUrl}/chat/completions`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: fullPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API ${res.status}: ${errText}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'No response returned.';
  }

  // 2. Google Gemini Direct
  if (prov === 'gemini') {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${finalSystemPrompt}\n\n${fullPrompt}` }
            ]
          }
        ]
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini ${res.status}: ${errText}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response returned.';
  }

  // 3. Anthropic Claude Direct
  if (prov === 'anthropic') {
    const endpoint = 'https://api.anthropic.com/v1/messages';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4096,
        system: finalSystemPrompt,
        messages: [{ role: 'user', content: fullPrompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic ${res.status}: ${errText}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text || 'No response returned.';
  }

  // 4. Cohere Direct
  if (prov === 'cohere') {
    const endpoint = 'https://api.cohere.com/v2/chat';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: fullPrompt },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cohere ${res.status}: ${errText}`);
    }
    const data = await res.json();
    return data.message?.content?.[0]?.text || 'No response returned.';
  }

  throw new Error(`Provider '${prov}' not supported.`);
}

// Chat Prompt Submission
async function submitMobilePrompt() {
  const input = document.getElementById('mobile-prompt-input');
  let prompt = input.value.trim();

  const filesToSend = [...attachedMobileFiles];
  attachedMobileFiles = [];
  renderMobileAttachmentTray();

  if (!prompt && filesToSend.length === 0) return;

  input.value = '';
  input.style.height = 'auto';

  // Check for /debate or /goal
  if (prompt.startsWith('/debate')) {
    switchMobileView('dialectic');
    document.getElementById('mobile-debate-query').value = prompt.replace('/debate', '').trim();
    startMobileDebate();
    return;
  }
  if (prompt.startsWith('/goal') || prompt.startsWith('/loop')) {
    switchMobileView('goal');
    document.getElementById('mobile-goal-objective').value = prompt.replace(/^\/(goal|loop)/, '').trim();
    startMobileGoalLoop();
    return;
  }

  appendMobileMessage('user', prompt);

  const assistantMsgEl = appendMobileMessage('assistant', 'Thinking...');
  const contentEl = assistantMsgEl.querySelector('.msg-content');
  const sendBtn = document.getElementById('mobile-send-btn');
  sendBtn.disabled = true;

  try {
    const systemPrompt = "You are ANTRI Code Mobile, an autonomous AI coding assistant. Deliver clean, structured, production-ready solutions.";
    const responseText = await callDirectProvider(systemPrompt, prompt, filesToSend);
    contentEl.textContent = responseText;

    // Save interaction to local episodic memory
    mobileEpisodes.push({ query: prompt, response: responseText, timestamp: Date.now() });
    saveMobileMemory();
  } catch (err) {
    contentEl.textContent = `Error: ${err.message}\n\nPlease verify your API key in Settings.`;
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
}

function appendMobileMessage(role, text) {
  const container = document.getElementById('chat-messages');
  const row = document.createElement('div');
  row.className = `msg-row ${role}`;
  const content = document.createElement('div');
  content.className = 'msg-content';
  content.textContent = text;
  row.appendChild(content);
  container.appendChild(row);
  scrollMobileChat();
  return row;
}

function scrollMobileChat() {
  const container = document.getElementById('chat-messages');
  container.scrollTop = container.scrollHeight;
}

function setPrompt(text) {
  const input = document.getElementById('mobile-prompt-input');
  input.value = text;
  input.focus();
}

// Dialectic Debate Runner (Autonomous Multi-Persona)
async function startMobileDebate() {
  const input = document.getElementById('mobile-debate-query');
  const query = input.value.trim();
  if (!query) return;

  const depth = document.getElementById('mobile-debate-depth').value;

  document.getElementById('m-dialectic-thesis').textContent = 'Drafting thesis & hypothesis...';
  document.getElementById('m-dialectic-antithesis').textContent = 'Adversary standby...';
  document.getElementById('m-dialectic-verification').textContent = 'Researcher standby...';
  document.getElementById('m-dialectic-synthesis').textContent = 'Judge standby...';

  try {
    // Stage 1: Thesis
    const thesis = await callDirectProvider(
      'You are The Proposer in a Dialectic debate. Formulate a strong, innovative thesis/solution.',
      `Debate Topic: ${query}`
    );
    document.getElementById('m-dialectic-thesis').textContent = thesis;

    // Stage 2: Antithesis
    document.getElementById('m-dialectic-antithesis').textContent = 'Critiquing edge cases and vulnerabilities...';
    const antithesis = await callDirectProvider(
      'You are The Adversary in a Dialectic debate. Ruthlessly challenge the thesis, finding security holes, race conditions, and flaws.',
      `Thesis to critique:\n${thesis}`
    );
    document.getElementById('m-dialectic-antithesis').textContent = antithesis;

    // Stage 3: Verification
    document.getElementById('m-dialectic-verification').textContent = 'Verifying claims and facts...';
    const verification = await callDirectProvider(
      'You are The Researcher in a Dialectic debate. Verify conflicting claims between Thesis and Antithesis.',
      `Thesis:\n${thesis}\n\nAntithesis:\n${antithesis}`
    );
    document.getElementById('m-dialectic-verification').textContent = verification;

    // Stage 4: Synthesis
    document.getElementById('m-dialectic-synthesis').textContent = 'Synthesizing final consensus...';
    const synthesis = await callDirectProvider(
      'You are The Judge in a Dialectic debate. Reconcile contradictions and output a battle-tested, optimal synthesis.',
      `Thesis:\n${thesis}\n\nAntithesis:\n${antithesis}\n\nVerification:\n${verification}`
    );
    document.getElementById('m-dialectic-synthesis').textContent = synthesis;
  } catch (err) {
    document.getElementById('m-dialectic-synthesis').textContent = `Debate error: ${err.message}`;
  }
}

// Goal Loop Runner (Iterative Self-Refinement)
async function startMobileGoalLoop() {
  const input = document.getElementById('mobile-goal-objective');
  const objective = input.value.trim();
  if (!objective) return;

  document.getElementById('m-goal-stage-1').textContent = 'Stage 1: Formulating initial solution...';
  document.getElementById('m-goal-stage-2').textContent = 'Stage 2 standby...';
  document.getElementById('m-goal-stage-3').textContent = 'Stage 3 standby...';

  try {
    // Stage 1: Formulation
    const draft = await callDirectProvider(
      'You are Stage 1 of the Goal Loop. Draft an initial complete solution for the objective.',
      `Objective: ${objective}`
    );
    document.getElementById('m-goal-stage-1').textContent = draft;

    // Stage 2: Adversarial Review & Rating
    document.getElementById('m-goal-stage-2').textContent = 'Stage 2: Evaluating flaws and assigning quality score...';
    const critique = await callDirectProvider(
      'You are Stage 2 of the Goal Loop. Critique the draft for edge cases and assign a 0-100% score.',
      `Draft:\n${draft}`
    );
    document.getElementById('m-goal-stage-2').textContent = critique;

    // Stage 3: Hardened Output
    document.getElementById('m-goal-stage-3').textContent = 'Stage 3: Hardening solution into production-ready output...';
    const finalOutput = await callDirectProvider(
      'You are Stage 3 of the Goal Loop. Synthesize the draft and critique into the ultimate production-grade output.',
      `Draft:\n${draft}\n\nCritique:\n${critique}`
    );
    document.getElementById('m-goal-stage-3').textContent = finalOutput;
  } catch (err) {
    document.getElementById('m-goal-stage-3').textContent = `Goal execution error: ${err.message}`;
  }
}

// Standalone Mobile Profiles
function loadMobileProfiles() {
  const saved = localStorage.getItem('antri_mobile_profiles');
  if (saved) {
    try {
      mobileProfiles = JSON.parse(saved);
    } catch (e) {
      mobileProfiles = {};
    }
  }

  if (Object.keys(mobileProfiles).length === 0) {
    mobileProfiles['mobile_profile_1'] = '# Mobile Thinking Profile\n\n- Preferred Language: TypeScript\n- Architecture: Modular & Clean\n- Formatting: 2 spaces, strict types';
  }

  const select = document.getElementById('mobile-profile-select');
  select.innerHTML = '';

  Object.keys(mobileProfiles).forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${name}.md`;
    if (name === activeProfileName) opt.selected = true;
    select.appendChild(opt);
  });

  document.getElementById('mobile-profile-title').textContent = `${activeProfileName}.md`;
  document.getElementById('mobile-profile-editor').value = mobileProfiles[activeProfileName] || '';
}

function onMobileProfileSelect(name) {
  activeProfileName = name;
  document.getElementById('mobile-profile-title').textContent = `${name}.md`;
  document.getElementById('mobile-profile-editor').value = mobileProfiles[name] || '';
}

function createMobileProfile() {
  const name = prompt('Enter new profile name:');
  if (!name) return;
  const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  mobileProfiles[cleanName] = `# ${cleanName} Thinking Profile\n\n- Custom preferences and rules`;
  activeProfileName = cleanName;
  localStorage.setItem('antri_mobile_profiles', JSON.stringify(mobileProfiles));
  loadMobileProfiles();
}

function saveMobileProfile() {
  const content = document.getElementById('mobile-profile-editor').value;
  mobileProfiles[activeProfileName] = content;
  localStorage.setItem('antri_mobile_profiles', JSON.stringify(mobileProfiles));
  alert('Profile saved to device.');
}

// Standalone Mobile Memory
function loadMobileMemory() {
  const savedEps = localStorage.getItem('antri_mobile_episodes');
  if (savedEps) {
    try {
      mobileEpisodes = JSON.parse(savedEps);
    } catch (e) {}
  }

  const epList = document.getElementById('mobile-episodic-list');
  if (mobileEpisodes.length === 0) {
    epList.textContent = 'No recent episodes.';
  } else {
    epList.innerHTML = mobileEpisodes
      .slice(-5)
      .map((ep) => `<div style="margin-bottom:0.6rem;border-bottom:1px solid var(--border-light);padding-bottom:0.4rem;"><b>Q:</b> ${ep.query}<br/><span style="color:var(--text-tertiary);">${(ep.response || '').slice(0, 80)}...</span></div>`)
      .join('');
  }
}

function saveMobileMemory() {
  localStorage.setItem('antri_mobile_episodes', JSON.stringify(mobileEpisodes.slice(-50)));
  loadMobileMemory();
}
