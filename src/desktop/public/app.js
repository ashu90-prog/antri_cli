// ANTRI Desktop Control Plane Client Engine

let currentConfig = null;
let activeTab = 'chat';
let attachedFiles = [];
let availableCommands = [];
let activePaletteMatches = [];
let paletteSelectedIndex = 0;
let activePaletteMode = null; // 'slash' | 'file' | null

// Skills State
let allSkillsList = [];
let selectedSkillId = null;
let currentSkillCategory = 'all';
let skillSearchQuery = '';

// Initialize on Load
document.addEventListener('DOMContentLoaded', async () => {
  await loadStatus();
  await loadCommands();
  await loadProfiles();
  await loadSkills();
  await loadMemory();
});

// Toast Notification
function showToast(message, isError = false) {
  let toast = document.getElementById('antri-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'antri-toast';
    toast.className = 'antri-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.background = isError ? '#991b1b' : '#1c1917';
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// Load System Status & Config
async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    currentConfig = data.config;

    // Update Mode buttons
    switchMode(currentConfig.mode || 'vibe', false);

    // Update Perms badge
    updatePermsBadge(currentConfig.alwaysAllow);

    // Update Provider selector
    const provSelect = document.getElementById('select-provider');
    if (provSelect) provSelect.value = currentConfig.provider;

    await loadModels();
  } catch (err) {
    console.error('Failed to load status:', err);
  }
}

// Load Slash Commands for Prompt Toolkit
async function loadCommands() {
  try {
    const res = await fetch('/api/commands');
    const data = await res.json();
    availableCommands = data.commands || [];
  } catch (err) {
    console.error('Failed to load commands:', err);
  }
}

// Load Models for Provider
async function loadModels() {
  try {
    const res = await fetch('/api/models');
    const data = await res.json();
    const modelSelect = document.getElementById('select-model');
    modelSelect.innerHTML = '';

    data.models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.name} (${m.category})`;
      if (m.id === currentConfig.model) opt.selected = true;
      modelSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load models:', err);
  }
}

// Switch Mode (Plan / Vibe)
async function switchMode(mode, triggerSave = true) {
  const btnVibe = document.getElementById('btn-mode-vibe');
  const btnPlan = document.getElementById('btn-mode-plan');

  if (mode === 'plan') {
    btnPlan.classList.add('active');
    btnVibe.classList.remove('active');
  } else {
    btnVibe.classList.add('active');
    btnPlan.classList.remove('active');
  }

  if (triggerSave && currentConfig) {
    currentConfig.mode = mode;
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
  }
}

// Toggle Always-Allow Permissions
async function toggleAlwaysAllow() {
  if (!currentConfig) return;
  const next = !currentConfig.alwaysAllow;
  currentConfig.alwaysAllow = next;
  updatePermsBadge(next);

  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alwaysAllow: next }),
  });
}

function updatePermsBadge(alwaysAllow) {
  const badge = document.getElementById('perms-text');
  if (alwaysAllow) {
    badge.textContent = 'Always-Allow';
  } else {
    badge.textContent = 'Ask-First';
  }
}

// Provider & Model Handlers
async function onProviderChange(provider) {
  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  await loadStatus();
}

async function onModelChange(model) {
  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
}

// Tab Switching
function showTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll('.tab-panel').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));

  const targetPanel = document.getElementById(`tab-${tabName}`);
  if (targetPanel) targetPanel.classList.add('active');

  const navIndex = ['chat', 'dialectic', 'goal', 'profiles', 'skills', 'memory'].indexOf(tabName);
  const navButtons = document.querySelectorAll('.nav-item');
  if (navButtons[navIndex]) navButtons[navIndex].classList.add('active');
}

// File Upload Handler (Images & Files)
async function handleFileSelected(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  for (const file of files) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target.result;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || 'text/plain',
            data,
          }),
        });
        const uploadRes = await res.json();
        if (uploadRes.success) {
          attachedFiles.push({
            name: file.name,
            path: uploadRes.filePath,
            isImage: uploadRes.isImage,
            dataUrl: uploadRes.isImage ? data : null,
          });
          renderAttachmentChips();
        }
      } catch (err) {
        console.error('File upload failed:', err);
      }
    };
    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  }

  // Reset input
  event.target.value = '';
}

function renderAttachmentChips() {
  const tray = document.getElementById('attachment-preview-tray');
  if (!tray) return;

  if (attachedFiles.length === 0) {
    tray.classList.add('hidden');
    tray.innerHTML = '';
    return;
  }

  tray.classList.remove('hidden');
  tray.innerHTML = '';

  attachedFiles.forEach((file, index) => {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    if (file.isImage && file.dataUrl) {
      chip.innerHTML = `
        <img src="${file.dataUrl}" alt="preview" />
        <span>${file.name}</span>
        <button class="remove-chip-btn" onclick="removeAttachment(${index})">×</button>
      `;
    } else {
      chip.innerHTML = `
        <span>${file.name}</span>
        <button class="remove-chip-btn" onclick="removeAttachment(${index})">×</button>
      `;
    }
    tray.appendChild(chip);
  });
}

function removeAttachment(index) {
  attachedFiles.splice(index, 1);
  renderAttachmentChips();
}

// Prompt Toolkit Text & Key Handler
async function handleInputText(event) {
  const val = event.target.value;
  const cursorPos = event.target.selectionStart;

  // 1. Slash command mode
  if (val.startsWith('/')) {
    const query = val.toLowerCase();
    activePaletteMatches = availableCommands.filter((cmd) => {
      const baseName = cmd.name.split(' ')[0].toLowerCase();
      return baseName.startsWith(query) || cmd.name.toLowerCase().startsWith(query);
    });
    activePaletteMode = 'slash';
    renderPalette('Commands', activePaletteMatches);
    return;
  }

  // 2. Attachment file mode (@)
  const lastAt = val.lastIndexOf('@', cursorPos - 1);
  if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
    const query = val.slice(lastAt + 1, cursorPos);
    if (!query.includes(' ')) {
      try {
        const res = await fetch(`/api/files?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        activePaletteMatches = data.items.map((item) => ({
          name: item.name,
          description: item.isDirectory ? 'Directory' : item.relativePath,
          relativePath: item.relativePath,
          isDirectory: item.isDirectory,
        }));
        activePaletteMode = 'file';
        renderPalette(`Files: ${data.currentDir}`, activePaletteMatches);
        return;
      } catch (e) {}
    }
  }

  hidePalette();
}

function renderPalette(title, items) {
  const palette = document.getElementById('prompt-toolkit-palette');
  const header = document.getElementById('palette-header');
  const list = document.getElementById('palette-list');

  if (!palette || !items || items.length === 0) {
    hidePalette();
    return;
  }

  header.textContent = title;
  list.innerHTML = '';
  paletteSelectedIndex = Math.min(paletteSelectedIndex, items.length - 1);
  if (paletteSelectedIndex < 0) paletteSelectedIndex = 0;

  items.slice(0, 10).forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = `palette-item ${idx === paletteSelectedIndex ? 'active' : ''}`;
    el.innerHTML = `
      <span class="palette-name">${item.name}</span>
      <span class="palette-desc">${item.description || ''}</span>
      ${item.isDirectory ? '<span class="palette-tag">dir</span>' : ''}
    `;
    el.onclick = () => selectPaletteItem(idx);
    list.appendChild(el);
  });

  palette.classList.remove('hidden');
}

function hidePalette() {
  const palette = document.getElementById('prompt-toolkit-palette');
  if (palette) palette.classList.add('hidden');
  activePaletteMode = null;
  activePaletteMatches = [];
  paletteSelectedIndex = 0;
}

function selectPaletteItem(index) {
  const item = activePaletteMatches[index];
  if (!item) return;

  const input = document.getElementById('prompt-input');

  if (activePaletteMode === 'slash') {
    const rawCmd = item.name.split(' ')[0];
    input.value = rawCmd + ' ';
    hidePalette();
    input.focus();
  } else if (activePaletteMode === 'file') {
    const val = input.value;
    const cursorPos = input.selectionStart;
    const lastAt = val.lastIndexOf('@', cursorPos - 1);
    if (lastAt !== -1) {
      input.value = val.slice(0, lastAt) + '@' + item.relativePath + ' ' + val.slice(cursorPos);
    }
    hidePalette();
    input.focus();
  }
}

function handleInputKey(event) {
  const palette = document.getElementById('prompt-toolkit-palette');
  const isPaletteVisible = palette && !palette.classList.contains('hidden');

  if (isPaletteVisible && activePaletteMatches.length > 0) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      paletteSelectedIndex = (paletteSelectedIndex - 1 + activePaletteMatches.length) % activePaletteMatches.length;
      renderPalette(document.getElementById('palette-header').textContent, activePaletteMatches);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      paletteSelectedIndex = (paletteSelectedIndex + 1) % activePaletteMatches.length;
      renderPalette(document.getElementById('palette-header').textContent, activePaletteMatches);
      return;
    }
    if (event.key === 'Tab' || event.key === 'Enter') {
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        selectPaletteItem(paletteSelectedIndex);
        return;
      }
    }
    if (event.key === 'Escape') {
      hidePalette();
      return;
    }
  }

  // Ctrl + Enter to submit prompt
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    submitPrompt();
  }
}

// Chat Prompt Submission with Real-Time Word-by-Word Side-by-Side Streaming
async function submitPrompt() {
  const input = document.getElementById('prompt-input');
  let prompt = input.value.trim();

  // Attach any uploaded files to prompt
  if (attachedFiles.length > 0) {
    const attachmentsText = attachedFiles.map((f) => `\n[Attached File: ${f.name} (${f.path})]`).join('');
    prompt = prompt + '\n' + attachmentsText;
    attachedFiles = [];
    renderAttachmentChips();
  }

  if (!prompt) return;

  input.value = '';
  hidePalette();

  // Intercept /debate or /goal inside chat
  if (prompt.startsWith('/debate')) {
    showTab('dialectic');
    document.getElementById('debate-query-input').value = prompt.replace('/debate', '').trim();
    startDebate();
    return;
  }
  if (prompt.startsWith('/goal') || prompt.startsWith('/loop')) {
    showTab('goal');
    document.getElementById('goal-objective-input').value = prompt.replace(/^\/(goal|loop)/, '').trim();
    startGoalLoop();
    return;
  }

  appendMessage('user', prompt);

  const assistantMsgEl = appendMessage('assistant', '');
  const contentEl = assistantMsgEl.querySelector('.msg-content');

  const sendBtn = document.getElementById('send-btn');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Streaming...';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              accumulated += data.token;
              contentEl.textContent = accumulated;
              scrollToBottom();
            } else if (data.name && data.arguments) {
              // Tool call badge
              const toolBadge = document.createElement('div');
              toolBadge.className = 'tool-badge-pill';
              toolBadge.textContent = `• Tool: ${data.name}`;
              assistantMsgEl.insertBefore(toolBadge, contentEl);
              scrollToBottom();
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    contentEl.textContent = `Error: ${err.message}`;
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<span>Send</span>';
  }
}

function appendMessage(role, text) {
  const container = document.getElementById('chat-messages');
  const row = document.createElement('div');
  row.className = `msg-row ${role}`;
  const content = document.createElement('div');
  content.className = 'msg-content';
  content.textContent = text;
  row.appendChild(content);
  container.appendChild(row);
  scrollToBottom();
  return row;
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  container.scrollTop = container.scrollHeight;
}

function setPrompt(text) {
  const input = document.getElementById('prompt-input');
  input.value = text;
  input.focus();
}

// Dialectic Debate Runner
async function startDebate() {
  const input = document.getElementById('debate-query-input');
  const query = input.value.trim();
  if (!query) return;

  const depth = document.getElementById('debate-depth-select').value;

  document.getElementById('dialectic-thesis').textContent = 'Generating initial thesis & hypothesis...';
  document.getElementById('dialectic-antithesis').textContent = 'Awaiting thesis to challenge assumptions...';
  document.getElementById('dialectic-verification').textContent = 'Researcher standby for fact-checking...';
  document.getElementById('dialectic-synthesis').textContent = 'Synthesizer awaiting debate completion...';

  try {
    const res = await fetch('/api/debate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, depth }),
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
            if (data.thesis) document.getElementById('dialectic-thesis').textContent = data.thesis;
            if (data.antithesis) document.getElementById('dialectic-antithesis').textContent = data.antithesis;
            if (data.verification) document.getElementById('dialectic-verification').textContent = data.verification;
            if (data.synthesis) document.getElementById('dialectic-synthesis').textContent = data.synthesis;
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    document.getElementById('dialectic-synthesis').textContent = `Debate error: ${err.message}`;
  }
}

// Goal Loop Runner
async function startGoalLoop() {
  const input = document.getElementById('goal-objective-input');
  const objective = input.value.trim();
  if (!objective) return;

  document.getElementById('goal-stage-1-content').textContent = 'Stage 1 executing: Drafting initial plan and solution...';
  document.getElementById('goal-stage-2-content').textContent = 'Stage 2 standby: Awaiting draft for adversarial critique...';
  document.getElementById('goal-stage-3-content').textContent = 'Stage 3 standby: Awaiting synthesis for hardened output...';

  try {
    const res = await fetch('/api/goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objective }),
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
            if (data.draft) document.getElementById('goal-stage-1-content').textContent = data.draft;
            if (data.critique) document.getElementById('goal-stage-2-content').textContent = data.critique;
            if (data.finalOutput) document.getElementById('goal-stage-3-content').textContent = data.finalOutput;
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    document.getElementById('goal-stage-3-content').textContent = `Goal execution error: ${err.message}`;
  }
}

// ==========================================
// Thinking Profile Management
// ==========================================
async function loadProfiles() {
  try {
    const res = await fetch('/api/profiles');
    const data = await res.json();

    const select = document.getElementById('select-profile');
    const list = document.getElementById('profile-items-list');
    select.innerHTML = '';
    list.innerHTML = '';

    data.profiles.forEach((p) => {
      // Dropdown option
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.name;
      if (p.name === data.activeName) opt.selected = true;
      select.appendChild(opt);

      // List button
      const btn = document.createElement('button');
      btn.className = `profile-item-btn ${p.name === data.activeName ? 'active' : ''}`;
      btn.textContent = `${p.name}.md`;
      btn.onclick = () => selectProfile(p.name);
      list.appendChild(btn);
    });

    document.getElementById('active-profile-title').textContent = `${data.activeName}.md`;
    document.getElementById('profile-editor').value = data.activeContent || '';
  } catch (err) {
    console.error('Failed to load profiles:', err);
  }
}

async function selectProfile(name) {
  await fetch('/api/profile/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  await loadProfiles();
}

async function createProfile() {
  const input = document.getElementById('new-profile-name');
  const name = input.value.trim();
  if (!name) return;

  await fetch('/api/profile/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  input.value = '';
  await loadProfiles();
  showToast(`Profile '${name}' created.`);
}

async function handleProfileImport(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  for (const file of files) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      const res = await fetch('/api/profile/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, content }),
      });
      const data = await res.json();
      if (data.success) {
        await loadProfiles();
        showToast(`Profile '${file.name}' imported successfully.`);
      }
    };
    reader.readAsText(file);
  }
  event.target.value = '';
}

async function saveActiveProfile() {
  const content = document.getElementById('profile-editor').value;
  await fetch('/api/profile/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  showToast('Profile saved successfully.');
}

async function pushProfilesToCloud() {
  try {
    showToast('Pushing profiles to Google Cloud Firestore...');
    const res = await fetch('/api/profile/push', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`Pushed ${data.count} profile(s) to Google Cloud Firestore.`);
    } else {
      showToast(`Push failed: ${data.error || 'Check network connection'}`, true);
    }
  } catch (err) {
    showToast(`Push failed: ${err.message}`, true);
  }
}

async function pullProfilesFromCloud() {
  try {
    showToast('Pulling profiles from Google Cloud Firestore...');
    const res = await fetch('/api/profile/pull', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      await loadProfiles();
      showToast(`Pulled ${data.count} profile(s) from Google Cloud Firestore.`);
    } else {
      showToast(`Pull failed: ${data.error || 'Check network connection'}`, true);
    }
  } catch (err) {
    showToast(`Pull failed: ${err.message}`, true);
  }
}

function exportActiveProfile() {
  const activeTitle = document.getElementById('active-profile-title').textContent || 'profile.md';
  const content = document.getElementById('profile-editor').value;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', activeTitle);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function deleteActiveProfile() {
  const activeTitle = (document.getElementById('active-profile-title').textContent || '').replace('.md', '');
  if (activeTitle === 'profile_1') {
    alert('Cannot delete default profile_1.');
    return;
  }
  if (!confirm(`Are you sure you want to delete profile '${activeTitle}.md'?`)) return;

  const res = await fetch('/api/profile/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: activeTitle }),
  });
  const data = await res.json();
  if (data.success) {
    await loadProfiles();
    showToast(`Profile '${activeTitle}' deleted.`);
  }
}

async function onProfileChange(name) {
  await selectProfile(name);
}

// ==========================================
// Markdown Skills Studio Management
// ==========================================
async function loadSkills() {
  try {
    const res = await fetch('/api/skills');
    const data = await res.json();
    allSkillsList = data.markdownSkills || [];
    renderSkillList();

    if (!selectedSkillId && allSkillsList.length > 0) {
      selectSkill(allSkillsList[0].id);
    }
  } catch (err) {
    console.error('Failed to load skills:', err);
  }
}

function setSkillCategory(category) {
  currentSkillCategory = category;
  document.querySelectorAll('.category-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.textContent.toLowerCase() === category.toLowerCase());
  });
  renderSkillList();
}

function filterSkills(query) {
  skillSearchQuery = (query || '').toLowerCase().trim();
  renderSkillList();
}

function renderSkillList() {
  const listContainer = document.getElementById('skills-catalog-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  let filtered = allSkillsList;
  if (currentSkillCategory !== 'all') {
    if (currentSkillCategory === 'Core') {
      filtered = filtered.filter((s) => s.isCore);
    } else if (currentSkillCategory === 'Custom') {
      filtered = filtered.filter((s) => !s.isCore);
    } else {
      filtered = filtered.filter((s) => s.category && s.category.toLowerCase() === currentSkillCategory.toLowerCase());
    }
  }

  if (skillSearchQuery) {
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(skillSearchQuery) ||
        s.description.toLowerCase().includes(skillSearchQuery) ||
        (s.triggers && s.triggers.some((t) => t.includes(skillSearchQuery)))
    );
  }

  if (filtered.length === 0) {
    listContainer.innerHTML = '<div class="empty-state">No skills match the search criteria.</div>';
    return;
  }

  filtered.forEach((skill) => {
    const card = document.createElement('div');
    card.className = `skill-item-card ${skill.id === selectedSkillId ? 'active' : ''}`;
    card.innerHTML = `
      <div class="skill-item-header">
        <span class="skill-item-name">${skill.name}</span>
        <span class="skill-type-tag ${skill.isCore ? 'core' : 'custom'}">${skill.isCore ? 'Core' : 'Custom'}</span>
      </div>
      <div class="skill-item-desc">${skill.description}</div>
      <div class="skill-item-footer">
        <span class="skill-category-badge">${skill.category}</span>
        <span class="skill-version-tag">v${skill.version}</span>
      </div>
    `;
    card.onclick = () => selectSkill(skill.id);
    listContainer.appendChild(card);
  });
}

function selectSkill(skillId) {
  selectedSkillId = skillId;
  const skill = allSkillsList.find((s) => s.id === skillId);
  if (!skill) return;

  document.getElementById('active-skill-title').textContent = `${skill.name} (${skill.id}.md)`;
  document.getElementById('active-skill-meta').textContent = `Category: ${skill.category} · Author: ${skill.author} · Version: ${skill.version} · Triggers: ${skill.triggers.join(', ') || 'Auto'}`;
  document.getElementById('skill-editor').value = skill.content || skill.instructions;

  // Toggle Delete button (allow delete only on custom skills)
  const deleteBtn = document.getElementById('btn-delete-skill');
  if (deleteBtn) {
    deleteBtn.style.display = skill.isCore ? 'none' : 'inline-flex';
  }

  renderSkillList();
}

async function saveCurrentSkill() {
  if (!selectedSkillId) return;
  const content = document.getElementById('skill-editor').value;

  const res = await fetch('/api/skill/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: selectedSkillId, content }),
  });
  const data = await res.json();
  if (data.success) {
    await loadSkills();
    selectSkill(selectedSkillId);
    showToast('Skill markdown saved successfully.');
  }
}

async function createNewSkillPrompt() {
  const name = prompt('Enter name for the new skill (e.g., "fastapi_specialist"):');
  if (!name) return;
  const description = prompt('Enter a short description for what this skill does:', 'Specialist guidelines and heuristics.');

  const res = await fetch('/api/skill/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, category: 'Custom' }),
  });
  const data = await res.json();
  if (data.success && data.skill) {
    await loadSkills();
    selectSkill(data.skill.id);
    showToast(`Skill '${data.skill.name}' created!`);
  }
}

async function handleSkillImport(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  for (const file of files) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      const res = await fetch('/api/skill/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, content }),
      });
      const data = await res.json();
      if (data.success && data.skill) {
        await loadSkills();
        selectSkill(data.skill.id);
        showToast(`Skill '${data.skill.name}' imported successfully.`);
      }
    };
    reader.readAsText(file);
  }
  event.target.value = '';
}

function exportCurrentSkill() {
  if (!selectedSkillId) return;
  const skill = allSkillsList.find((s) => s.id === selectedSkillId);
  const content = document.getElementById('skill-editor').value;
  const filename = `${skill ? skill.id : 'skill'}.md`;

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function deleteCurrentSkill() {
  if (!selectedSkillId) return;
  const skill = allSkillsList.find((s) => s.id === selectedSkillId);
  if (skill && skill.isCore) {
    alert('Cannot delete built-in core skills.');
    return;
  }
  if (!confirm(`Are you sure you want to delete skill '${skill ? skill.name : selectedSkillId}'?`)) return;

  const res = await fetch('/api/skill/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: selectedSkillId }),
  });
  const data = await res.json();
  if (data.success) {
    selectedSkillId = null;
    await loadSkills();
    showToast('Skill deleted.');
  }
}

function activateCurrentSkillInChat() {
  if (!selectedSkillId) return;
  const skill = allSkillsList.find((s) => s.id === selectedSkillId);
  if (!skill) return;

  showTab('chat');
  const input = document.getElementById('prompt-input');
  input.value = `[Apply Skill: ${skill.name}] `;
  input.focus();
  showToast(`Skill '${skill.name}' loaded into prompt.`);
}

// Memory Loader
async function loadMemory() {
  try {
    const res = await fetch('/api/memory');
    const data = await res.json();

    const semanticList = document.getElementById('semantic-memory-list');
    const episodicList = document.getElementById('episodic-memory-list');

    semanticList.innerHTML = (data.semanticItems || [])
      .map((item) => `<div style="margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem;"><b>[${item.category}]</b> ${item.text}</div>`)
      .join('') || '<div>No semantic vectors stored yet.</div>';

    episodicList.innerHTML = (data.episodes || [])
      .map((ep) => `<div style="margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem;"><b>Query:</b> ${ep.query}<br/><span style="color: var(--text-tertiary);">${ep.response.slice(0, 100)}...</span></div>`)
      .join('') || '<div>No episodes recorded in current session.</div>';
  } catch (err) {
    console.error('Failed to load memory:', err);
  }
}
