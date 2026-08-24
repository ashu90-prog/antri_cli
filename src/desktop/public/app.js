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
  await checkAuthStatus();
  await loadStatus();
  await loadCommands();
  await loadChatSessions();
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
async function showTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll('.tab-panel').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));

  const targetPanel = document.getElementById(`tab-${tabName}`);
  if (targetPanel) targetPanel.classList.add('active');

  const navIndex = ['chat', 'dialectic', 'goal', 'profiles', 'skills', 'memory', 'artifacts'].indexOf(tabName);
  const navButtons = document.querySelectorAll('.nav-item');
  if (navButtons[navIndex]) navButtons[navIndex].classList.add('active');

  if (tabName === 'profiles') {
    await loadProfiles();
  } else if (tabName === 'skills') {
    await loadSkills();
  } else if (tabName === 'memory') {
    await loadMemory();
  } else if (tabName === 'artifacts') {
    await loadArtifactsTab();
  }
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

// ==========================================
// Multi-Chat Session Management
// ==========================================
let currentActiveChatId = '';
let allChatSessions = [];

async function loadChatSessions(renderMessages = true) {
  try {
    const res = await fetch('/api/chats');
    const data = await res.json();
    allChatSessions = data.sessions || [];
    currentActiveChatId = data.activeId || (allChatSessions[0]?.id || '');

    const select = document.getElementById('select-chat-session');
    if (select) {
      select.innerHTML = '';
      allChatSessions.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.title} (${s.messageCount || 0})`;
        if (s.id === currentActiveChatId) opt.selected = true;
        select.appendChild(opt);
      });
    }

    if (renderMessages && data.activeSession) {
      renderActiveSessionMessages(data.activeSession.messages || []);
    }
  } catch (err) {
    console.error('Failed to load chat sessions:', err);
  }
}

function renderActiveSessionMessages(messages) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  container.innerHTML = '';

  if (!messages || messages.length === 0) {
    container.innerHTML = `
      <div class="welcome-card" id="chat-welcome-card">
        <h2>ANTRI Control Plane</h2>
        <p>Minimalist environment for autonomous coding, architectural planning, and self-refinement. State, memory, profiles, and skills are synchronized across CLI and Desktop.</p>
        <div class="quick-action-pills">
          <button onclick="setPrompt('Plan the architecture for a real-time collaborative code editor')">Plan Editor Architecture</button>
          <button onclick="setPrompt('/debate What are the trade-offs between WebSockets vs Server-Sent Events?')">Start Dialectic Debate</button>
          <button onclick="setPrompt('/goal Implement a zero-dependency LRU cache with TTL in TypeScript')">Run Goal Loop</button>
        </div>
      </div>
    `;
    return;
  }

  messages.forEach((msg) => {
    if (msg.role === 'user' || msg.role === 'assistant') {
      appendMessage(msg.role, msg.content);
    }
  });
}

async function createNewChatSession() {
  try {
    const res = await fetch('/api/chats/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Chat' }),
    });
    const data = await res.json();
    if (data.success && data.session) {
      currentActiveChatId = data.session.id;
      await loadChatSessions(true);
      showToast('Started new chat session.');
    }
  } catch (err) {
    console.error('Failed to create new chat session:', err);
  }
}

async function onChatSessionSelect(id) {
  try {
    const res = await fetch('/api/chats/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.success && data.session) {
      currentActiveChatId = data.session.id;
      renderActiveSessionMessages(data.session.messages || []);
      await loadChatSessions(false);
    }
  } catch (err) {
    console.error('Failed to select chat session:', err);
  }
}

async function clearCurrentChatContext() {
  if (!confirm('Clear all conversation messages in this chat session?')) return;
  const container = document.getElementById('chat-messages');
  if (container) {
    container.innerHTML = `
      <div class="welcome-card" id="chat-welcome-card">
        <h2>ANTRI Control Plane</h2>
        <p>Minimalist environment for autonomous coding, architectural planning, and self-refinement. State, memory, profiles, and skills are synchronized across CLI and Desktop.</p>
        <div class="quick-action-pills">
          <button onclick="setPrompt('Plan the architecture for a real-time collaborative code editor')">Plan Editor Architecture</button>
          <button onclick="setPrompt('/debate What are the trade-offs between WebSockets vs Server-Sent Events?')">Start Dialectic Debate</button>
          <button onclick="setPrompt('/goal Implement a zero-dependency LRU cache with TTL in TypeScript')">Run Goal Loop</button>
        </div>
      </div>
    `;
  }
  await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: '/clear' }),
  }).catch(() => {});
  await loadChatSessions(false);
  showToast('Chat context cleared.');
}

async function deleteCurrentChatSession() {
  if (!currentActiveChatId) return;
  if (!confirm('Are you sure you want to delete this chat session?')) return;
  try {
    const res = await fetch('/api/chats/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentActiveChatId }),
    });
    const data = await res.json();
    if (data.success) {
      await loadChatSessions(true);
      showToast('Chat session deleted.');
    }
  } catch (err) {
    console.error('Failed to delete chat session:', err);
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

  // Remove welcome card if present
  const welcomeCard = document.getElementById('chat-welcome-card');
  if (welcomeCard) {
    welcomeCard.remove();
  }

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
            if (data.requestId && data.name && data.args !== undefined) {
              // Interactive Permission Request Card
              const permCard = document.createElement('div');
              permCard.className = 'permission-prompt-card';
              permCard.id = `card-${data.requestId}`;
              permCard.innerHTML = `
                <div class="perm-title">⚠️ Privacy & Security Permission Request</div>
                <div class="perm-desc">Agent requested to execute tool: <b style="color:var(--accent-primary);">${data.name}</b></div>
                <pre class="perm-args">${JSON.stringify(data.args, null, 2)}</pre>
                <div class="perm-actions">
                  <button class="perm-btn perm-allow" onclick="respondDesktopPermission('${data.requestId}', true, false)">Allow Once</button>
                  <button class="perm-btn perm-always" onclick="respondDesktopPermission('${data.requestId}', true, true)">Always Allow</button>
                  <button class="perm-btn perm-deny" onclick="respondDesktopPermission('${data.requestId}', false, false)">Deny</button>
                </div>
              `;
              assistantMsgEl.insertBefore(permCard, contentEl);
              scrollToBottom();
            } else if (data.token) {
              accumulated += data.token;
              if (accumulated.includes('<antri_artifact')) {
                const cleanStreaming = accumulated.replace(/<antri_artifact[\s\S]*$/i, '').trim();
                contentEl.textContent = (cleanStreaming ? cleanStreaming + '\n\n' : '') + '🎨 [Generating Multi-Page Interactive Artifact...]';
              } else {
                contentEl.textContent = accumulated;
              }
              scrollToBottom();
            } else if (data.artifacts) {
              lastServerArtifacts = data.artifacts;
            }
          } catch (e) {}
        }
      }
    }

    const artData = parseArtifactHelper(accumulated, lastServerArtifacts);
    if (artData) {
      contentEl.textContent = artData.cleanText;
      const isMindmap = artData.type === 'mindmap';
      const isGraph = artData.type === 'graph';
      const artIcon = isMindmap ? '🧠' : isGraph ? '📊' : '🌐';
      const artSubtitle = isMindmap ? 'Interactive Mind Map' : isGraph ? 'Code Architecture Graph' : 'Interactive Multi-Page HTML App';

      const embed = document.createElement('div');
      embed.className = 'chat-artifact-embed';
      embed.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">${artIcon}</span>
          <div>
            <div style="font-weight:700;font-size:13.5px;color:var(--text-primary);">${escapeHtml(artData.title)}</div>
            <div style="font-size:11.5px;color:var(--text-muted);">${artSubtitle}</div>
          </div>
        </div>
        <button class="chat-artifact-btn" onclick="openArtifactViewer('${encodeURIComponent(artData.id)}', '${escapeHtml(artData.title)}', '${artData.type}')">👁️ View Artifact</button>
      `;
      assistantMsgEl.appendChild(embed);
    }
  } catch (err) {
    contentEl.textContent = `Error: ${err.message}`;
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<span>Send</span>';
    await loadChatSessions(false);
  }
}

function parseArtifactHelper(text, serverArtifacts = null) {
  if (!text) return null;

  if (serverArtifacts && serverArtifacts.length > 0) {
    const art = serverArtifacts[0];
    return {
      id: art.id,
      type: (art.type || 'html').toLowerCase(),
      title: art.title || 'Generated Artifact',
      cleanText: text
        .replace(/<antri_artifact[\s\S]*?<\/antri_artifact>/gi, '')
        .replace(/\{[\s\S]*"name"\s*:\s*"create_artifact"[\s\S]*\}/gi, '')
        .replace(/> 🎨 \*\*\[Artifact Created:[\s\S]*?launch\.\n\n/gi, '')
        .trim(),
    };
  }

  // 1. Match XML tag
  const xmlMatch = text.match(/<antri_artifact\s+id="([^"]+)"\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/antri_artifact>/i);
  if (xmlMatch) {
    return {
      id: xmlMatch[1],
      type: xmlMatch[2].toLowerCase(),
      title: xmlMatch[3],
      cleanText: text.replace(/<antri_artifact[\s\S]*?<\/antri_artifact>/gi, '').trim(),
    };
  }

  // 2. Match Markdown Badge format: ID: `art_xxx`
  const badgeMatch = text.match(/\[Artifact Created:\s*([^\]]+)\][\s\S]*?Type:\s*`([^`]+)`[\s\S]*?ID:\s*`([^`]+)`/i);
  if (badgeMatch) {
    const title = badgeMatch[1].trim();
    const rawType = badgeMatch[2].trim().toLowerCase();
    const type = rawType.includes('mind') ? 'mindmap' : rawType.includes('graph') ? 'graph' : 'html';
    const id = badgeMatch[3].trim();
    return {
      id,
      type,
      title,
      cleanText: text.replace(/> 🎨 \*\*\[Artifact Created:[\s\S]*?launch\.\n\n/gi, '').trim(),
    };
  }

  // 3. Match JSON create_artifact
  if (text.includes('"create_artifact"')) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*"name"\s*:\s*"create_artifact"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const params = parsed.parameters || parsed.args || parsed;
        const title = params.title || 'Generated Artifact';
        return {
          id: title,
          type: (params.type || 'mindmap').toLowerCase(),
          title: title,
          cleanText: text.replace(jsonMatch[0], '').trim(),
        };
      }
    } catch (_) {}
  }
  return null;
}

function appendMessage(role, text) {
  const container = document.getElementById('chat-messages');
  const row = document.createElement('div');
  row.className = `msg-row ${role}`;
  const content = document.createElement('div');
  content.className = 'msg-content';

  const artData = role === 'assistant' ? parseArtifactHelper(text) : null;
  if (artData) {
    content.textContent = artData.cleanText;
    row.appendChild(content);

    const isMindmap = artData.type === 'mindmap';
    const isGraph = artData.type === 'graph';
    const artIcon = isMindmap ? '🧠' : isGraph ? '📊' : '🌐';
    const artSubtitle = isMindmap ? 'Interactive Mind Map' : isGraph ? 'Code Architecture Graph' : 'Interactive HTML Plan';

    const embed = document.createElement('div');
    embed.className = 'chat-artifact-embed';
    embed.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:22px;">${artIcon}</span>
        <div>
          <div style="font-weight:700;font-size:13.5px;color:var(--text-primary);">${escapeHtml(artData.title)}</div>
          <div style="font-size:11.5px;color:var(--text-muted);">${artSubtitle}</div>
        </div>
      </div>
      <button class="chat-artifact-btn" onclick="openArtifactViewer('${encodeURIComponent(artData.id)}', '${escapeHtml(artData.title)}', '${artData.type}')">👁️ View Artifact</button>
    `;
    row.appendChild(embed);
  } else {
    content.textContent = text;
    row.appendChild(content);
  }

  container.appendChild(row);
  scrollToBottom();
  return row;
}

// Artifact Hub Management
async function loadArtifactsTab() {
  try {
    const res = await fetch('/api/artifacts');
    const data = await res.json();
    const container = document.getElementById('artifacts-grouped-container');
    if (!container) return;
    container.innerHTML = '';

    if (!data.grouped || data.grouped.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:48px 16px;color:var(--text-muted);">
          <div style="font-size:36px;margin-bottom:12px;">🎨</div>
          <h3 style="color:var(--text-primary);margin-bottom:6px;">No Artifacts Generated Yet</h3>
          <p style="font-size:13px;">Generate interactive HTML plans, architecture graphs, or mind maps with <code>/view</code>, <code>/mindmap</code>, or <code>/imagine</code> in chat.</p>
        </div>
      `;
      return;
    }

    const totalCount = data.artifacts ? data.artifacts.length : 0;
    const toolbar = document.createElement('div');
    toolbar.className = 'artifacts-toolbar';
    toolbar.innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);font-weight:600;">
        Showing <span style="color:var(--text-primary);font-weight:700;">${totalCount}</span> artifact${totalCount === 1 ? '' : 's'} across <span style="color:var(--text-primary);font-weight:700;">${data.grouped.length}</span> chat session${data.grouped.length === 1 ? '' : 's'}
      </div>
      <button class="artifacts-toggle-all-btn" id="artifactsToggleAllBtn" onclick="toggleAllArtifactGroups()">📁 Collapse All</button>
    `;
    container.appendChild(toolbar);

    data.grouped.forEach((grp, idx) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'artifact-session-group';
      groupEl.id = `artifact-group-${idx}`;

      let cardsHtml = '';
      grp.artifacts.forEach((art) => {
        const isMindmap = art.type === 'mindmap';
        const isGraph = art.type === 'graph';
        const typeClass = isMindmap ? 'badge-mindmap' : isGraph ? 'badge-graph' : 'badge-html';
        const typeText = isMindmap ? 'Mind Map' : isGraph ? 'Code Graph' : 'Interactive HTML';
        const icon = isMindmap ? '🧠' : isGraph ? '📊' : '🌐';
        const dateStr = new Date(art.createdAt).toLocaleDateString();

        cardsHtml += `
          <div class="artifact-item-card">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <span class="artifact-card-badge ${typeClass}">${icon} ${typeText}</span>
                <span style="font-size:11px;color:var(--text-muted);">${dateStr}</span>
              </div>
              <div style="font-weight:700;font-size:14px;color:var(--text-primary);margin-bottom:4px;">${escapeHtml(art.title)}</div>
              <div style="font-size:12px;color:var(--text-muted);">ID: ${art.id}</div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
              <button class="chat-artifact-btn" onclick="openArtifactViewer('${encodeURIComponent(art.id)}', '${escapeHtml(art.title)}', '${art.type}')">👁️ View Artifact</button>
              <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;" title="Delete Artifact" onclick="deleteArtifactDesktop('${art.id}')">🗑️</button>
            </div>
          </div>
        `;
      });

      groupEl.innerHTML = `
        <div class="artifact-session-header" onclick="toggleArtifactGroup('${groupEl.id}')">
          <div class="artifact-session-title">
            <span class="artifact-collapse-chevron">▼</span>
            <span>📁</span>
            <span>${escapeHtml(grp.sessionTitle || 'Chat Session')}</span>
          </div>
          <span style="font-size:12px;color:var(--text-muted);">${grp.artifacts.length} ${grp.artifacts.length === 1 ? 'artifact' : 'artifacts'}</span>
        </div>
        <div class="artifacts-grid">
          ${cardsHtml}
        </div>
      `;
      container.appendChild(groupEl);
    });
  } catch (err) {
    console.error('Failed to load artifacts tab:', err);
  }
}

function toggleArtifactGroup(groupId) {
  const el = document.getElementById(groupId);
  if (el) {
    el.classList.toggle('collapsed');
  }
}

function toggleAllArtifactGroups() {
  const groups = document.querySelectorAll('.artifact-session-group');
  const btn = document.getElementById('artifactsToggleAllBtn');
  const anyOpen = Array.from(groups).some((g) => !g.classList.contains('collapsed'));

  groups.forEach((g) => {
    if (anyOpen) {
      g.classList.add('collapsed');
    } else {
      g.classList.remove('collapsed');
    }
  });

  if (btn) {
    btn.textContent = anyOpen ? '📂 Expand All' : '📁 Collapse All';
  }
}

function openArtifactViewer(id, title = 'Artifact View', type = 'html') {
  const modal = document.getElementById('artifact-viewer-modal');
  const iframe = document.getElementById('artifact-viewer-iframe');
  const titleEl = document.getElementById('modal-artifact-title');
  const typeEl = document.getElementById('modal-artifact-type');
  const iconEl = document.getElementById('modal-artifact-icon');

  if (titleEl) titleEl.textContent = title;
  if (typeEl) typeEl.textContent = type === 'mindmap' ? 'Interactive Mind Map' : type === 'graph' ? 'Code Architecture Graph' : 'Interactive HTML View';
  if (iconEl) iconEl.textContent = type === 'mindmap' ? '🧠' : type === 'graph' ? '📊' : '🌐';

  if (iframe) iframe.src = `/api/artifacts/${encodeURIComponent(id)}/view`;
  if (modal) modal.style.display = 'flex';
}

function closeArtifactViewer() {
  const modal = document.getElementById('artifact-viewer-modal');
  const iframe = document.getElementById('artifact-viewer-iframe');
  if (iframe) iframe.src = 'about:blank';
  if (modal) modal.style.display = 'none';
}

function reloadArtifactIframe() {
  const iframe = document.getElementById('artifact-viewer-iframe');
  if (iframe) iframe.src = iframe.src;
}

async function deleteArtifactDesktop(id) {
  if (!confirm('Are you sure you want to delete this artifact?')) return;
  try {
    const res = await fetch('/api/artifacts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('Artifact deleted');
      await loadArtifactsTab();
    }
  } catch (e) {
    showToast('Failed to delete artifact', true);
  }
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
// Thinking Profile & Notes Management
// ==========================================
let currentViewedProfile = 'profile_1';
let currentActiveProfile = 'profile_1';
let currentNotesScope = 'global';
let cachedGlobalNotes = '';
let cachedWorkspaceNotes = '';

async function loadProfiles() {
  try {
    const res = await fetch('/api/profiles');
    const data = await res.json();

    currentActiveProfile = data.activeName || 'profile_1';
    cachedGlobalNotes = data.globalNotes || '';
    cachedWorkspaceNotes = data.workspaceNotes || '';

    const select = document.getElementById('select-profile');
    const list = document.getElementById('profile-items-list');
    select.innerHTML = '';
    list.innerHTML = '';

    data.profiles.forEach((p) => {
      // Dropdown option
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = `${p.name}.md`;
      if (p.name === currentActiveProfile) opt.selected = true;
      select.appendChild(opt);

      // List button
      const isCurrentViewed = p.name === currentViewedProfile || (!currentViewedProfile && p.name === currentActiveProfile);
      const btn = document.createElement('button');
      btn.className = `profile-item-btn ${isCurrentViewed ? 'active' : ''}`;
      btn.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <span style="font-weight:600;">${p.name}.md</span>
          <span style="font-size:10px;opacity:0.8;display:flex;align-items:center;gap:4px;">
            ${p.name === currentActiveProfile ? '<span style="color:#10b981;font-weight:700;">● Active</span>' : ''}
            <span>${p.notesCount || 0} notes</span>
          </span>
        </div>
      `;
      btn.onclick = () => viewProfile(p.name);
      list.appendChild(btn);
    });

    if (!currentViewedProfile || !data.profiles.some((p) => p.name === currentViewedProfile)) {
      currentViewedProfile = currentActiveProfile;
    }

    await viewProfile(currentViewedProfile, false);

    // Also populate notes editor
    const notesEditor = document.getElementById('notes-editor');
    if (notesEditor) {
      notesEditor.value = currentNotesScope === 'workspace' ? cachedWorkspaceNotes : cachedGlobalNotes;
    }
  } catch (err) {
    console.error('Failed to load profiles:', err);
  }
}

async function viewProfile(name, updateListHighlight = true) {
  try {
    currentViewedProfile = name;
    const res = await fetch(`/api/profile?name=${encodeURIComponent(name)}`);
    const data = await res.json();

    document.getElementById('active-profile-title').textContent = `${data.name}.md`;
    const subtitle = document.getElementById('active-profile-subtitle');
    const activateBtn = document.getElementById('btn-set-active-profile');

    if (data.name === currentActiveProfile) {
      if (subtitle) subtitle.textContent = 'Active thinking profile in LLM context';
      if (activateBtn) activateBtn.style.display = 'none';
    } else {
      if (subtitle) subtitle.textContent = 'Viewing profile instructions (Click "Set as Active" to apply)';
      if (activateBtn) activateBtn.style.display = 'inline-block';
    }

    document.getElementById('profile-editor').value = data.content || '';

    if (updateListHighlight) {
      document.querySelectorAll('#profile-items-list .profile-item-btn').forEach((btn, idx) => {
        const text = btn.textContent || '';
        if (text.includes(`${name}.md`)) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  } catch (err) {
    console.error('Failed to view profile:', err);
  }
}

async function activateViewedProfile() {
  if (!currentViewedProfile) return;
  await selectProfile(currentViewedProfile);
  showToast(`Active profile switched to '${currentViewedProfile}.md'`);
}

async function selectProfile(name) {
  await fetch('/api/profile/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  currentActiveProfile = name;
  currentViewedProfile = name;
  await loadProfiles();
}

function switchProfileSubtab(subtab) {
  const btnProfiles = document.getElementById('btn-subtab-profiles');
  const btnNotes = document.getElementById('btn-subtab-notes');
  const viewProfiles = document.getElementById('subtab-view-profiles');
  const viewNotes = document.getElementById('subtab-view-notes');

  if (subtab === 'profiles') {
    btnProfiles.classList.add('active');
    btnNotes.classList.remove('active');
    viewProfiles.classList.remove('hidden');
    viewNotes.classList.add('hidden');
  } else {
    btnNotes.classList.add('active');
    btnProfiles.classList.remove('active');
    viewNotes.classList.remove('hidden');
    viewProfiles.classList.add('hidden');
  }
}

function selectNotesScope(scope) {
  currentNotesScope = scope;
  const btnGlobal = document.getElementById('btn-note-global');
  const btnWorkspace = document.getElementById('btn-note-workspace');
  const title = document.getElementById('notes-scope-title');
  const editor = document.getElementById('notes-editor');

  if (scope === 'workspace') {
    btnWorkspace.classList.add('active');
    btnGlobal.classList.remove('active');
    if (title) title.textContent = 'Workspace Local Notes (.antri/profiles/notes.md)';
    if (editor) editor.value = cachedWorkspaceNotes;
  } else {
    btnGlobal.classList.add('active');
    btnWorkspace.classList.remove('active');
    if (title) title.textContent = 'Global User Notes (~/.antri/profiles/notes.md)';
    if (editor) editor.value = cachedGlobalNotes;
  }
}

async function saveNotesContent() {
  const content = document.getElementById('notes-editor').value;
  try {
    const res = await fetch('/api/profile/notes/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: currentNotesScope, content }),
    });
    const data = await res.json();
    if (data.success) {
      if (currentNotesScope === 'workspace') {
        cachedWorkspaceNotes = content;
      } else {
        cachedGlobalNotes = content;
      }
      showToast(`Notes (${currentNotesScope}) saved & synced.`);
    }
  } catch (err) {
    showToast(`Failed to save notes: ${err.message}`, true);
  }
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
  currentViewedProfile = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
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
        currentViewedProfile = file.name.replace(/\.md$/, '');
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
    body: JSON.stringify({ name: currentViewedProfile, content }),
  });
  showToast(`Profile '${currentViewedProfile}.md' saved successfully.`);
}

async function pushProfilesToCloud() {
  try {
    showToast('Pushing profiles to Google Cloud Firestore...');
    const res = await fetch('/api/profile/push', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      const msg = `Pushed ${data.count} profile(s)${data.notesSynced ? ' & notes.md' : ''} to Google Cloud Firestore.`;
      showToast(msg);
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
      const msg = `Pulled ${data.count} profile(s)${data.notesSynced ? ' & notes.md' : ''} from Google Cloud Firestore.`;
      showToast(msg);
    } else {
      showToast(`Pull failed: ${data.error || 'Check network connection'}`, true);
    }
  } catch (err) {
    showToast(`Pull failed: ${err.message}`, true);
  }
}

function exportActiveProfile() {
  const activeTitle = document.getElementById('active-profile-title').textContent || `${currentViewedProfile}.md`;
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
  const target = currentViewedProfile || 'profile_1';
  if (target === 'profile_1') {
    alert('Cannot delete default profile_1.');
    return;
  }
  if (!confirm(`Are you sure you want to delete profile '${target}.md' from both your device and the cloud? It will not be pulled again.`)) return;

  const res = await fetch('/api/profile/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: target }),
  });
  const data = await res.json();
  if (data.success) {
    currentViewedProfile = 'profile_1';
    await loadProfiles();
    showToast(`Profile '${target}.md' deleted from device and cloud.`);
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

// Authentication Helpers
let currentAuthUser = null;

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    const dot = document.getElementById('auth-status-dot');
    const text = document.getElementById('auth-status-text');

    if (data.isAuthenticated && data.user) {
      currentAuthUser = data.user;
      if (dot) dot.classList.add('logged-in');
      if (text) text.textContent = data.user.email.split('@')[0];
    } else {
      currentAuthUser = null;
      if (dot) dot.classList.remove('logged-in');
      if (text) text.textContent = 'Login';
    }
  } catch (e) {
    console.error('Failed to check auth status:', e);
  }
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  const formView = document.getElementById('auth-form-view');
  const loggedView = document.getElementById('auth-logged-view');
  const emailText = document.getElementById('logged-user-email');
  const idText = document.getElementById('logged-user-id');

  if (currentAuthUser) {
    if (formView) formView.style.display = 'none';
    if (loggedView) loggedView.style.display = 'block';
    if (emailText) emailText.textContent = currentAuthUser.email;
    if (idText) idText.textContent = `Cloud Partition: ${currentAuthUser.userId}`;
  } else {
    if (formView) formView.style.display = 'block';
    if (loggedView) loggedView.style.display = 'none';
  }

  if (modal) modal.style.display = 'flex';
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.style.display = 'none';
}

async function submitDesktopLogin() {
  const emailInput = document.getElementById('modal-email-input');
  const passInput = document.getElementById('modal-pass-input');
  const email = (emailInput ? emailInput.value : '').trim();
  const password = passInput ? passInput.value : '';

  if (!email || !email.includes('@')) {
    alert('Please enter a valid email address.');
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.success && data.user) {
      currentAuthUser = data.user;
      closeAuthModal();
      await checkAuthStatus();
      await loadProfiles();
      showToast(`Logged in as ${data.user.email}`);
    } else {
      alert(data.error || 'Login failed.');
    }
  } catch (err) {
    alert('Login error: ' + err.message);
  }
}

async function submitDesktopLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentAuthUser = null;
    closeAuthModal();
    await checkAuthStatus();
    showToast('Logged out of ANTRI.');
  } catch (err) {
    console.error('Logout error:', err);
  }
}
