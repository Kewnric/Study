// admin-practice.js
function renderAdmin() {
  if (currentAdminMode === 'study') {
    if (currentAdminStudyTab === 'snippets') return renderStudyAdmin();
    return renderNotebookAdmin();
  }

  updateAdminFilter();

  const tbody = document.getElementById('admin-table-body');
  if (!tbody) return;

  // Filter challenges based on dropdown (now uses parentId) and search query
  let filteredChallenges = state.challenges;

  const searchInput = document.getElementById('admin-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (query) {
    filteredChallenges = filteredChallenges.filter(c => fuzzyMatch(c.title, query) || (c.tags || []).some(t => fuzzyMatch(t, query)));
  }
  if (adminCategoryFilter === '__uncategorized__') {
    filteredChallenges = filteredChallenges.filter(c => c.parentId === null || c.parentId === undefined);
  } else if (adminCategoryFilter !== 'All') {
    // Filter by folder and all descendant folders
    const folderIds = new Set();
    function collectIds(id) {
      folderIds.add(id);
      getChildFolders(id, 'challenge').forEach(cf => collectIds(cf.id));
    }
    collectIds(adminCategoryFilter);
    filteredChallenges = filteredChallenges.filter(c => folderIds.has(c.parentId));
  }

  // Build folder picker options for category dropdown on each item
  const folderPickerOptions = [];
  function buildPickerOpts(parentId, depth) {
    getChildFolders(parentId, 'challenge').forEach(f => {
      const indent = '\u00A0\u00A0'.repeat(depth);
      folderPickerOptions.push({ id: f.id, label: indent + f.name });
      buildPickerOpts(f.id, depth + 1);
    });
  }
  buildPickerOpts(null, 0);

  // Render program list
  if (filteredChallenges.length === 0) {
    tbody.innerHTML = '<div class="empty-state" style="padding:2rem;"><p>No programs found.</p></div>';
  } else {
    tbody.innerHTML = filteredChallenges.map(c => `
      <div class="admin-list-item" onclick="openAdminForm('${c.id}')">
        <div class="admin-list-item-left">
          <div class="admin-list-item-title">${escapeHTML(c.title)}</div>
          <div class="admin-list-item-meta">
            <span>${c.variants.length} version${c.variants.length !== 1 ? 's' : ''}</span>
            <span class="admin-list-item-dot">·</span>
            <select onclick="event.stopPropagation()" onchange="moveItemToFolder('${c.id}', 'challenge', this.value === '__none__' ? null : this.value)" class="form-select admin-list-item-select">
              <option value="__none__" ${!c.parentId ? 'selected' : ''}>Uncategorized</option>
              ${folderPickerOptions.map(f =>
      `<option value="${f.id}" ${c.parentId === f.id ? 'selected' : ''}>${f.label}</option>`
    ).join('')}
            </select>
          </div>
        </div>
        <div class="admin-list-item-actions">
          <button onclick="event.stopPropagation(); openAdminForm('${c.id}')" class="btn btn-ghost" title="Edit">
            <i data-lucide="pencil" style="width:16px;height:16px;color:var(--color-primary);"></i>
          </button>
          <button onclick="event.stopPropagation(); deleteChallenge('${c.id}')" class="btn btn-ghost" title="Delete">
            <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  // Folder list (tree view with rename/delete)
  const catList = document.getElementById('admin-category-list');
  if (catList) {
    catList.innerHTML = renderAdminFolderTree(null, 'challenge', 0);
    if (!catList.innerHTML) {
      catList.innerHTML = '<p style="font-size:0.8rem; color:var(--text-tertiary); padding:0.5rem;">No folders. Add one below.</p>';
    }
  }

  // Render Unlock Rules dynamically (using node IDs)
  const lockRulesContainer = document.getElementById('admin-lock-rules');
  if (lockRulesContainer) {
    const challengeFolders = state.nodes.filter(n => n.type === 'folder' && n.scope === 'challenge');
    lockRulesContainer.innerHTML = challengeFolders.map(folder => {
      const req = state.categoryRequirements[folder.id] || { reqNodeId: null, count: 1 };
      const isLocked = req.reqNodeId !== null && req.reqNodeId !== undefined;
      return `
        <div class="category-item" style="flex-direction: column; align-items: stretch; gap: 0.75rem; padding: 0.875rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight:600; font-size:0.95rem; display:flex; align-items:center; gap:0.375rem;">
              <i data-lucide="${isLocked ? 'lock' : 'unlock'}" style="width:16px;height:16px;color:var(${isLocked ? '--color-warning' : '--text-tertiary'});"></i>
              ${escapeHTML(folder.name)}
            </div>
            ${isLocked ? `<span class="badge badge-warning" style="font-size:0.6rem;">LOCKED</span>` : `<span class="badge badge-neutral" style="font-size:0.6rem;">UNLOCKED</span>`}
          </div>
          <div style="display:flex; gap:0.5rem; align-items:center; background: var(--bg-surface); padding: 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <span style="font-size:0.75rem; color:var(--text-secondary); white-space:nowrap;">Req.</span>
            <input type="number" min="1" value="${req.count}" onchange="updateLockRule('${folder.id}', 'count', this.value)" class="form-input" style="width:40px; padding:0.25rem; text-align:center; height:28px; font-size:0.8rem;">
            <span style="font-size:0.75rem; color:var(--text-secondary); white-space:nowrap;">wins in</span>
            <select onchange="updateLockRule('${folder.id}', 'reqNodeId', this.value)" class="form-select" style="flex:1; padding:0.25rem 0.5rem; height:28px; font-size:0.8rem; min-width:60px;">
              <option value="None" ${!isLocked ? 'selected' : ''}>None</option>
              ${challengeFolders.filter(f => f.id !== folder.id).map(f => `<option value="${f.id}" ${req.reqNodeId === f.id ? 'selected' : ''}>${escapeHTML(f.name)}</option>`).join('')}
            </select>
          </div>
        </div>
      `;
    }).join('');
  }

  lucide.createIcons();
}

function openAdminForm(id) {
  if (currentAdminMode === 'study') return openStudyForm(id);

  // Hide Empty State, Show Form
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.add('hidden');
  const formContainer = document.getElementById('admin-form-container');
  if (formContainer) formContainer.classList.remove('hidden');

  window.adminIsDirty = false;
  window.saveCurrentAdminForm = saveAdminForm;

  // Build folder picker for admin form
  const catSelect = document.getElementById('admin-category');
  const fpOpts = [];
  function buildFP(pid, d) {
    getChildFolders(pid, 'challenge').forEach(f => {
      fpOpts.push({ id: f.id, label: '\u00A0\u00A0'.repeat(d) + f.name });
      buildFP(f.id, d + 1);
    });
  }
  buildFP(null, 0);
  catSelect.innerHTML = `<option value="">Uncategorized</option>` + fpOpts.map(f => `<option value="${f.id}">${f.label}</option>`).join('');

  if (id === 'new') {
    const firstFolder = state.nodes.find(n => n.type === 'folder' && n.scope === 'challenge');
    adminState = {
      id: 'new', title: '', parentId: firstFolder ? firstFolder.id : null, coverDescription: '',
      tags: [],
      variants: [{ id: generateId(), name: 'Version 1', description: '', starterCode: '', code: '', samples: [] }],
      activeVariantIndex: 0
    };
  } else {
    const c = state.challenges.find(ch => ch.id === id);
    adminState = JSON.parse(JSON.stringify(c));
    if (!adminState.tags) adminState.tags = [];
    adminState.activeVariantIndex = 0;
  }

  document.getElementById('admin-form-title').innerText = id === 'new' ? 'Create Program' : 'Edit Program';
  document.getElementById('admin-title').value = adminState.title;
  document.getElementById('admin-category').value = adminState.parentId || '';
  document.getElementById('admin-cover-desc').value = adminState.coverDescription || '';
  document.getElementById('admin-tag-input').value = '';

  renderAdminTags();
  renderAdminVariantForm();
}

function closeAdminForm() {
  const el = document.getElementById('admin-form-container');
  if (el) el.classList.add('hidden');

  // Show Empty State
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.remove('hidden');

  adminState = null;
}

function renderAdminTags() {
  if (!adminState) return;
  const container = document.getElementById('admin-tags-list');
  container.innerHTML = adminState.tags.map((t, idx) => `
    <span class="tag">
      ${escapeHTML(t)}
      <button onclick="removeAdminTag(${idx})" title="Remove tag"><i data-lucide="x" style="width:12px;height:12px;"></i></button>
    </span>
  `).join('');
  lucide.createIcons();
}

function addAdminTag() {
  const input = document.getElementById('admin-tag-input');
  const val = input.value.trim();
  if (val && !adminState.tags.includes(val)) {
    adminState.tags.push(val);
    renderAdminTags();
    input.value = '';
  }
}

function removeAdminTag(idx) {
  adminState.tags.splice(idx, 1);
  renderAdminTags();
}

function renderAdminVariantForm() {
  if (!adminState || !adminState.variants) return;

  const tabsContainer = document.getElementById('admin-variant-tabs');
  tabsContainer.innerHTML = adminState.variants.map((v, i) => `
    <div onclick="switchAdminVariant(${i})" class="variant-tab ${i === adminState.activeVariantIndex ? 'active' : ''}">
      ${escapeHTML(v.name || 'Unnamed')}
      ${adminState.variants.length > 1 ? `<span onclick="event.stopPropagation(); deleteAdminVariant(${i})" class="variant-tab-close"><i data-lucide="x" style="width:12px;height:12px;"></i></span>` : ''}
    </div>
  `).join('');

  const activeVar = adminState.variants[adminState.activeVariantIndex];
  const contentContainer = document.getElementById('admin-variant-content');

  contentContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1rem;">
      <div>
        <label class="form-label">Version Name</label>
        <input value="${escapeHTML(activeVar.name)}" oninput="updateActiveVariantField('name', this.value)" class="form-input" />
      </div>
      <div>
        <label class="form-label-inline"><span>Instruction / Description</span></label>
        <textarea rows="3" oninput="updateActiveVariantField('description', this.value)" class="form-textarea">${escapeHTML(activeVar.description)}</textarea>
      </div>

      <div style="display:flex; flex-direction:column; flex:1; min-height:180px;">
        <label class="form-label" style="color:var(--color-accent);">Starter Code (Pre-filled for the user)</label>
        <div class="editor-container" style="flex:1; border-color:var(--color-accent);">
          <pre id="admin-starter-pre" class="editor-pre"><code id="admin-starter-code"></code></pre>
          <textarea id="admin-starter-ta" spellcheck="false" class="editor-textarea" placeholder="// Add starter boilerplate here..."></textarea>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; flex:1; min-height:220px;">
        <label class="form-label" style="color:var(--color-success);">Target Correct Code (Hidden solution)</label>
        <div class="editor-container" style="flex:1; border-color:var(--color-success);">
          <pre id="admin-target-pre" class="editor-pre"><code id="admin-target-code"></code></pre>
          <textarea id="admin-target-ta" spellcheck="false" class="editor-textarea" placeholder="function() { ... }"></textarea>
        </div>
      </div>
      
      <div class="divider"></div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <label class="form-label" style="margin-bottom:0;">Sample Outputs</label>
        <button onclick="addAdminSample()" class="btn btn-ghost btn-sm" style="color:var(--color-primary); font-weight:600;">
          <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add Sample
        </button>
      </div>
      <div id="admin-samples-list" style="display:flex; flex-direction:column; gap:0.75rem;">
         ${activeVar.samples.map((s, sampleIdx) => `
           <div class="sample-item">
             <div style="flex:1; display:flex; flex-direction:column; gap:0.5rem;">
               <input value="${escapeHTML(s.title)}" oninput="updateSampleField(${sampleIdx}, 'title', this.value)" placeholder="Sample Title" class="form-input" style="font-weight:600; font-size:0.8125rem; padding:0.375rem 0.5rem;" />
               <textarea rows="2" oninput="updateSampleField(${sampleIdx}, 'content', this.value)" placeholder="Sample content..." class="form-textarea" style="font-family:var(--font-mono); font-size:0.75rem; min-height:40px; padding:0.375rem 0.5rem;">${escapeHTML(s.content)}</textarea>
             </div>
             <button onclick="deleteAdminSample(${sampleIdx})" class="btn btn-ghost" style="padding:0.25rem;" title="Delete Sample">
               <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
             </button>
           </div>
         `).join('') + (activeVar.samples.length === 0 ? '<p style="font-size:0.75rem; color:var(--text-tertiary); font-style:italic;">No samples added.</p>' : '')}
      </div>
    </div>
  `;

  // Initialize Starter Code Editor
  const starterTA = document.getElementById('admin-starter-ta');
  const starterPre = document.getElementById('admin-starter-code');
  starterTA.value = activeVar.starterCode || '';
  starterPre.innerHTML = syntaxHighlight(activeVar.starterCode || '') + '<br/>';
  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('admin-starter-ta', 'admin-starter-pre', 'admin-starter-code', false, 'starterCode');
  }

  // Initialize Target Code Editor
  const targetTA = document.getElementById('admin-target-ta');
  const targetPre = document.getElementById('admin-target-code');
  targetTA.value = activeVar.code || '';
  targetPre.innerHTML = syntaxHighlight(activeVar.code || '') + '<br/>';
  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('admin-target-ta', 'admin-target-pre', 'admin-target-code', false, 'code');
  }

  lucide.createIcons();
}

function switchAdminVariant(idx) {
  adminState.activeVariantIndex = idx;
  renderAdminVariantForm();
}

function addAdminVariant() {
  const vLen = adminState.variants.length + 1;
  adminState.variants.push({
    id: generateId(),
    name: `Version ${vLen}`,
    description: '',
    starterCode: '',
    code: '',
    samples: []
  });
  adminState.activeVariantIndex = adminState.variants.length - 1;
  renderAdminVariantForm();
}

function deleteAdminVariant(idx) {
  showConfirm("Delete Version", "Remove this variant entirely?", () => {
    adminState.variants.splice(idx, 1);
    adminState.activeVariantIndex = Math.max(0, adminState.activeVariantIndex - 1);
    renderAdminVariantForm();
  });
}

function updateActiveVariantField(field, value) {
  if (adminState && adminState.variants[adminState.activeVariantIndex]) {
    adminState.variants[adminState.activeVariantIndex][field] = value;
    if (field === 'name') {
      const tabs = document.getElementById('admin-variant-tabs');
      if (tabs && tabs.children[adminState.activeVariantIndex]) {
        tabs.children[adminState.activeVariantIndex].childNodes[0].nodeValue = " " + value + " ";
      }
    }
  }
}

function addAdminSample() {
  adminState.variants[adminState.activeVariantIndex].samples.push({
    title: `Sample Output ${adminState.variants[adminState.activeVariantIndex].samples.length + 1}`,
    content: ''
  });
  renderAdminVariantForm();
}

function updateSampleField(idx, field, value) {
  adminState.variants[adminState.activeVariantIndex].samples[idx][field] = value;
}

function deleteAdminSample(idx) {
  adminState.variants[adminState.activeVariantIndex].samples.splice(idx, 1);
  renderAdminVariantForm();
}

function saveAdminForm(opts = {}) {
  const title = adminState.title.trim();
  if (!title) { showMessage("Error", "Program Title is required.", true); return false; }

  let isValid = true;
  adminState.variants.forEach((v) => {
    if (!v.name.trim() || !v.code.trim()) {
      isValid = false;
    }
  });

  if (!isValid) { showMessage("Error", "All versions must have a name and correct code defined.", true); return false; }

  // BUG-08 FIX: Properly strip activeVariantIndex for both new and existing saves
  const { activeVariantIndex, ...toSave } = adminState;

  if (toSave.id === 'new') {
    toSave.id = generateId();
    state.challenges.push(toSave);
  } else {
    state.challenges = state.challenges.map(c => c.id === toSave.id ? toSave : c);
  }

  saveData();
  closeAdminForm();
  renderAdmin();
  window.adminIsDirty = false;
  if (!opts.silent) showMessage("Success", "Program saved successfully.");
  return true;
}

function deleteChallenge(id) {
  showConfirm("Delete Challenge", "Are you sure you want to delete this challenge program?", () => {
    state.challenges = state.challenges.filter(c => c.id !== id);
    if (adminState && adminState.id === id) closeAdminForm();
    saveData();
    renderAdmin();
  });
}

function addCategory() {
  const input = document.getElementById('new-category-input');
  const val = input.value.trim();
  if (val) {
    createNode(val, 'folder', null, 'challenge');
    input.value = '';
    renderAdmin();
  }
}

function removeCategory(nodeId) {
  const folder = state.nodes.find(n => n.id === nodeId);
  if (!folder) return;
  showConfirm("Delete Folder", `Are you sure? Items in "${escapeHTML(folder.name)}" will become uncategorized.`, () => {
    deleteNode(nodeId);
    renderAdmin();
  });
}

function updateLockRule(nodeId, field, value) {
  if (!state.categoryRequirements[nodeId]) {
    state.categoryRequirements[nodeId] = { reqNodeId: null, count: 1 };
  }
  if (field === 'count') {
    state.categoryRequirements[nodeId].count = parseInt(value) || 1;
  } else if (field === 'reqNodeId') {
    state.categoryRequirements[nodeId].reqNodeId = (value === 'None') ? null : value;
  }
  saveData();
  renderAdmin();
}