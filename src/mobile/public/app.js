// ANTRI Mobile Standalone Client Engine

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

  document.getElementById('mobile-provider-select').value = mobileConfig.provider;
  document.getElementById('mobile-model-input').value = mobileConfig.model;
  document.getElementById('mobile-api-key-input').value = mobileConfig.apiKey || '';
  document.getElementById('mobile-base-url-input').value = mobileConfig.baseUrl || '';

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
    anthropic: 'claude-3-7-sonnet',
    gemini: 'gemini-2.5-flash',
    cerebras: 'llama-3.3-70b',
    cohere: 'command-r-plus',
    vortex: 'vortex-llama-3.3-70b-instruct',
    opencode: 'opencode/deepseek-coder-v2.5',
    'nvidia-nim': 'meta/llama-3.2-11b-vision-instruct',
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

// Chat Prompt Submission
async function submitMobilePrompt() {
  const input = document.getElementById('mobile-prompt-input');
  let prompt = input.value.trim();

  if (attachedMobileFiles.length > 0) {
    const attachDesc = attachedMobileFiles.map((f) => `\n[Attached File: ${f.name} (${f.type})]`).join('');
    prompt = prompt + attachDesc;
    attachedMobileFiles = [];
    renderMobileAttachmentTray();
  }

  if (!prompt) return;

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

  const assistantMsgEl = appendMobileMessage('assistant', '');
  const contentEl = assistantMsgEl.querySelector('.msg-content');
  const sendBtn = document.getElementById('mobile-send-btn');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Thinking...';

  try {
    // Connect to local mobile endpoint or direct provider
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, config: mobileConfig }),
    });

    if (res.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                accumulated += data.token;
                contentEl.textContent = accumulated;
                scrollMobileChat();
              }
              if (data.cleanText) {
                contentEl.textContent = data.cleanText;
              }
              if (data.artifacts && data.artifacts.length > 0) {
                renderMobileArtifactCards(assistantMsgEl, data.artifacts);
              }
            } catch (e) {}
          }
        }
      }
    } else {
      const data = await res.json();
      contentEl.textContent = data.cleanText || data.response || data.error || 'Response received.';
      if (data.artifacts && data.artifacts.length > 0) {
        renderMobileArtifactCards(assistantMsgEl, data.artifacts);
      }
    }

    // Save interaction to local episodic memory
    mobileEpisodes.push({ query: prompt, response: contentEl.textContent, timestamp: Date.now() });
    saveMobileMemory();
  } catch (err) {
    contentEl.textContent = `Offline / Error: ${err.message}. Check Settings for valid API key.`;
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
}

function renderMobileArtifactCards(msgEl, artifacts) {
  artifacts.forEach((art) => {
    const card = document.createElement('div');
    card.className = 'mobile-artifact-embed';
    card.style.cssText = 'margin-top:8px;background:var(--bg-card,#18181b);border:1px solid var(--border-color,#27272a);border-radius:8px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;';
    card.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:var(--text-primary,#fff);">🌐 ${art.title}</div>
      <button style="background:var(--primary,#6366f1);color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;" onclick="openMobileArtifactViewer('${art.id}', '${art.title}')">View Diagram</button>
    `;
    msgEl.appendChild(card);
  });
  scrollMobileChat();
}

function openMobileArtifactViewer(id, title) {
  const modal = document.getElementById('mobile-artifact-modal');
  const iframe = document.getElementById('mobile-artifact-iframe');
  const titleEl = document.getElementById('mobile-modal-artifact-title');
  if (titleEl) titleEl.textContent = title || 'Architecture Diagram';
  if (iframe) iframe.src = `/api/artifact-file/${id}`;
  if (modal) modal.style.display = 'flex';
}

function closeMobileArtifactViewer() {
  const modal = document.getElementById('mobile-artifact-modal');
  const iframe = document.getElementById('mobile-artifact-iframe');
  if (iframe) iframe.src = '';
  if (modal) modal.style.display = 'none';
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

// Dialectic Debate Runner
async function startMobileDebate() {
  const input = document.getElementById('mobile-debate-query');
  const query = input.value.trim();
  if (!query) return;

  const depth = document.getElementById('mobile-debate-depth').value;

  document.getElementById('m-dialectic-thesis').textContent = 'Drafting thesis...';
  document.getElementById('m-dialectic-antithesis').textContent = 'Awaiting thesis for critique...';
  document.getElementById('m-dialectic-verification').textContent = 'Verification engine standby...';
  document.getElementById('m-dialectic-synthesis').textContent = 'Consensus will appear here...';

  try {
    const res = await fetch('/api/debate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, depth, config: mobileConfig }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.thesis) document.getElementById('m-dialectic-thesis').textContent = data.thesis;
            if (data.antithesis) document.getElementById('m-dialectic-antithesis').textContent = data.antithesis;
            if (data.verification) document.getElementById('m-dialectic-verification').textContent = data.verification;
            if (data.synthesis) document.getElementById('m-dialectic-synthesis').textContent = data.synthesis;
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    document.getElementById('m-dialectic-synthesis').textContent = `Debate error: ${err.message}`;
  }
}

// Goal Loop Runner
async function startMobileGoalLoop() {
  const input = document.getElementById('mobile-goal-objective');
  const objective = input.value.trim();
  if (!objective) return;

  document.getElementById('m-goal-stage-1').textContent = 'Drafting plan & code...';
  document.getElementById('m-goal-stage-2').textContent = 'Adversarial review standby...';
  document.getElementById('m-goal-stage-3').textContent = 'Final synthesis standby...';

  try {
    const res = await fetch('/api/goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objective, config: mobileConfig }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.draft) document.getElementById('m-goal-stage-1').textContent = data.draft;
            if (data.critique) document.getElementById('m-goal-stage-2').textContent = data.critique;
            if (data.finalOutput) document.getElementById('m-goal-stage-3').textContent = data.finalOutput;
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    document.getElementById('m-goal-stage-3').textContent = `Goal error: ${err.message}`;
  }
}

// Mobile Standalone Profiles
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

// Mobile Memory
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
