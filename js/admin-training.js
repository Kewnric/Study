/* ============================================================
   ADMIN-TRAINING.JS — Training Grounds Admin
   (Snippets, Notebooks, Answer Key, Given Question Modals)
   ============================================================ */

let studyQuillEditor = null;
let studyCommentsQuillEditor = null;
let studyModeState = null;

function initQuill() {
  if (!studyQuillEditor && window.Quill) {
    studyQuillEditor = new Quill('#study-desc-editor', {
      theme: 'snow',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
          ['clean']
        ]
      }
    });

    studyQuillEditor.on('text-change', function () {
      if (!studyModeState) return;
      studyModeState.description = studyQuillEditor.root.innerHTML;
      window.adminIsDirty = true;
    });

    studyCommentsQuillEditor = new Quill('#study-comments-editor', {
      theme: 'snow',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
          ['image', 'clean']
        ]
      }
    });

    studyCommentsQuillEditor.on('text-change', function () {
      if (!studyModeState) return;
      studyModeState.comments = studyCommentsQuillEditor.root.innerHTML;
      window.adminIsDirty = true;
    });
  }
}

function renderStudyAdmin() {
  updateAdminFilter();

  const tbody = document.getElementById('study-table-body');
  if (!tbody) return;

  // Build snippet folder picker
  const sfpOpts = [];
  function buildSFP(pid, d) {
    getChildFolders(pid, 'snippet').forEach(f => {
      sfpOpts.push({ id: f.id, label: '\u00A0\u00A0'.repeat(d) + f.name });
      buildSFP(f.id, d + 1);
    });
  }
  buildSFP(null, 0);

  if (!state.snippets || state.snippets.length === 0) {
    tbody.innerHTML = '<div class="empty-state" style="padding:2rem;"><p>No snippets inside Training Grounds.</p></div>';
  } else {
    let filteredSnippets = state.snippets;
    
    const searchInput = document.getElementById('admin-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    if (query) {
      filteredSnippets = filteredSnippets.filter(s => fuzzyMatch(s.title, query) || (s.tags || []).some(t => fuzzyMatch(t, query)));
    }
    
    if (adminCategoryFilter === '__uncategorized__') {
      filteredSnippets = filteredSnippets.filter(s => s.parentId === null || s.parentId === undefined);
    } else if (adminCategoryFilter !== 'All') {
      const fids = new Set();
      function collectSFIds(id) { fids.add(id); getChildFolders(id, 'snippet').forEach(cf => collectSFIds(cf.id)); }
      collectSFIds(adminCategoryFilter);
      filteredSnippets = filteredSnippets.filter(s => fids.has(s.parentId));
    }
    tbody.innerHTML = filteredSnippets.map(s => `
      <div class="admin-list-item" onclick="openStudyForm('${s.id}')">
        <div class="admin-list-item-left">
          <div class="admin-list-item-title">${escapeHTML(s.title)}</div>
          <div class="admin-list-item-meta">
            <span>${(s.examples || []).length} example${(s.examples || []).length !== 1 ? 's' : ''}</span>
            <span class="admin-list-item-dot">·</span>
            <select onclick="event.stopPropagation()" onchange="moveItemToFolder('${s.id}', 'snippet', this.value === '__none__' ? null : this.value)" class="form-select admin-list-item-select">
              <option value="__none__" ${!s.parentId ? 'selected' : ''}>Uncategorized</option>
              ${sfpOpts.map(f => `<option value="${f.id}" ${s.parentId === f.id ? 'selected' : ''}>${f.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="admin-list-item-actions">
          <button onclick="event.stopPropagation(); openStudyForm('${s.id}')" class="btn btn-ghost" title="Edit">
            <i data-lucide="pencil" style="width:16px;height:16px;color:var(--color-primary);"></i>
          </button>
          <button onclick="event.stopPropagation(); deleteStudySnippet('${s.id}')" class="btn btn-ghost" title="Delete">
            <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  // Folder list (tree view)
  const catList = document.getElementById('study-category-list');
  if (catList) {
    catList.innerHTML = renderAdminFolderTree(null, 'snippet', 0);
    if (!catList.innerHTML) {
      catList.innerHTML = '<p style="font-size:0.8rem; color:var(--text-tertiary); padding:0.5rem;">No folders. Add one below.</p>';
    }
  }

  lucide.createIcons();
}

function openStudyForm(id) {
  // Hide Empty State, Show Study Form
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.add('hidden');
  document.getElementById('study-form-container').classList.remove('hidden');

  window.adminIsDirty = false;
  window.saveCurrentAdminForm = saveStudyForm;

  initQuill();

  // Build folder picker for study form
  const catSelect = document.getElementById('study-category');
  const sFpOpts = [];
  function buildSFP2(pid, d) {
    getChildFolders(pid, 'snippet').forEach(f => {
      sFpOpts.push({ id: f.id, label: '\u00A0\u00A0'.repeat(d) + f.name });
      buildSFP2(f.id, d + 1);
    });
  }
  buildSFP2(null, 0);
  catSelect.innerHTML = `<option value="">Uncategorized</option>` + sFpOpts.map(f => `<option value="${f.id}">${f.label}</option>`).join('');

  if (id === 'new') {
    const firstSnippetFolder = state.nodes.find(n => n.type === 'folder' && n.scope === 'snippet');
    studyModeState = {
      id: 'new', title: '', parentId: firstSnippetFolder ? firstSnippetFolder.id : null,
      description: '', comments: '', tags: [], relatedChallenges: [], starterCode: '',
      examples: [{ id: generateId(), name: 'Example 1', code: '', highlightLines: '' }],
      activeExampleIndex: 0, tryCodingTargetIndices: [0]
    };
  } else {
    const s = state.snippets.find(x => x.id === id);
    studyModeState = JSON.parse(JSON.stringify(s));
    if (!studyModeState.tags) studyModeState.tags = [];
    if (!studyModeState.relatedChallenges) studyModeState.relatedChallenges = [];
    if (!studyModeState.starterCode) studyModeState.starterCode = '';
    if (!studyModeState.examples) studyModeState.examples = [];
    if (!studyModeState.tryCodingTargetIndices) {
      studyModeState.tryCodingTargetIndices = [studyModeState.tryCodingExampleIndex || 0];
    }
    studyModeState.activeExampleIndex = 0;
  }

  document.getElementById('study-form-title').innerText = id === 'new' ? 'New Snippet' : 'Edit Snippet';
  document.getElementById('study-title').value = studyModeState.title;
  document.getElementById('study-category').value = studyModeState.parentId || '';
  document.getElementById('study-tag-input').value = '';

  if (studyQuillEditor) studyQuillEditor.root.innerHTML = studyModeState.description || '';
  if (studyCommentsQuillEditor) studyCommentsQuillEditor.root.innerHTML = studyModeState.comments || '';

  // Setup Global Starter Code
  const gStarterTA = document.getElementById('study-global-starter-textarea');
  const gStarterPre = document.getElementById('study-global-starter-code');
  if (gStarterTA && gStarterPre) {
    gStarterTA.value = studyModeState.starterCode || '';
    gStarterPre.innerHTML = syntaxHighlight(studyModeState.starterCode || '') + '<br/>';
    if (typeof setupSpecificEditor === 'function') {
      setupSpecificEditor('study-global-starter-textarea', 'study-global-starter-pre', 'study-global-starter-code', false);
    }
    gStarterTA.addEventListener('input', (e) => { studyModeState.starterCode = e.target.value; });
  }

  renderStudyTags();
  renderStudyRelatedChallenges();
  renderStudyExamplesForm();
}

function closeStudyForm() {
  const el = document.getElementById('study-form-container');
  if (el) el.classList.add('hidden');

  // Show Empty State
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.remove('hidden');

  studyModeState = null;
}

function saveStudyForm(opts = {}) {
  if (!studyModeState) return false;

  if (studyQuillEditor) studyModeState.description = studyQuillEditor.root.innerHTML;
  if (studyCommentsQuillEditor) studyModeState.comments = studyCommentsQuillEditor.root.innerHTML;

  const title = studyModeState.title.trim();
  if (!title) { showMessage("Error", "Snippet Title is required.", true); return false; }

  if (!state.snippets) state.snippets = [];

  delete studyModeState.activeExampleIndex;
  delete studyModeState.tryCodingExampleIndex;

  if (studyModeState.id === 'new') {
    state.snippets.push({ ...studyModeState, id: generateId() });
  } else {
    state.snippets = state.snippets.map(s => s.id === studyModeState.id ? studyModeState : s);
  }

  saveData();
  closeStudyForm(); // Go back to empty state after save
  renderStudyAdmin();
  window.adminIsDirty = false;
  if (!opts.silent) showMessage("Success", "Snippet saved successfully.");
  return true;
}

function deleteStudySnippet(id) {
  showConfirm("Delete Snippet", "Are you sure you want to delete this snippet?", () => {
    state.snippets = state.snippets.filter(s => s.id !== id);
    if (studyModeState && studyModeState.id === id) closeStudyForm();
    saveData();
    renderStudyAdmin();
  });
}

function addStudyCategory() {
  const input = document.getElementById('new-study-category-input');
  const val = input.value.trim();
  if (val) {
    createNode(val, 'folder', null, 'snippet');
    input.value = '';
    renderStudyAdmin();
  }
}

function removeStudyCategory(nodeId) {
  const folder = state.nodes.find(n => n.id === nodeId);
  if (!folder) return;
  showConfirm("Delete Folder", `Delete "${escapeHTML(folder.name)}"? Items will become uncategorized.`, () => {
    deleteNode(nodeId);
    renderStudyAdmin();
  });
}

function renderStudyTags() {
  if (!studyModeState) return;
  const container = document.getElementById('study-tags-list');
  container.innerHTML = studyModeState.tags.map((t, idx) => `
    <span class="tag">
      ${escapeHTML(t)}
      <button onclick="removeStudyTag(${idx})" title="Remove tag"><i data-lucide="x" style="width:12px;height:12px;"></i></button>
    </span>
  `).join('');
  lucide.createIcons();
}

function addStudyTag() {
  const input = document.getElementById('study-tag-input');
  const val = input.value.trim();
  if (val && !studyModeState.tags.includes(val)) {
    studyModeState.tags.push(val);
    renderStudyTags();
    input.value = '';
  }
}

function removeStudyTag(idx) {
  studyModeState.tags.splice(idx, 1);
  renderStudyTags();
}

// === Linked Related Challenges ===
function renderStudyRelatedChallenges() {
  if (!studyModeState) return;
  const selectList = document.getElementById('study-challenge-select');
  const container = document.getElementById('study-related-challenges-list');

  const available = state.challenges.filter(c => !(studyModeState.relatedChallenges || []).includes(c.id));

  if (selectList) {
    selectList.innerHTML = available.map(c => `<option value="${c.id}">${escapeHTML(c.title)}</option>`).join('');
  }

  if (container) {
    container.innerHTML = (studyModeState.relatedChallenges || []).map(id => {
      const c = state.challenges.find(ch => ch.id === id);
      if (!c) return '';
      return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface-hover); padding:0.5rem 0.75rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
              <span style="font-size:0.875rem; font-weight:600;">${escapeHTML(c.title)}</span>
              <button onclick="removeStudyRelatedChallenge('${id}')" class="btn btn-ghost btn-sm" style="color:var(--color-danger); padding:0.25rem;">
                <i data-lucide="x" style="width:14px;height:14px;"></i>
              </button>
            </div>
          `;
    }).join('');
    lucide.createIcons();
  }
}

function addStudyRelatedChallenge() {
  const select = document.getElementById('study-challenge-select');
  if (select && select.value) {
    if (!studyModeState.relatedChallenges) studyModeState.relatedChallenges = [];
    studyModeState.relatedChallenges.push(select.value);
    renderStudyRelatedChallenges();
  }
}

function removeStudyRelatedChallenge(id) {
  if (!studyModeState.relatedChallenges) return;
  studyModeState.relatedChallenges = studyModeState.relatedChallenges.filter(cid => cid !== id);
  renderStudyRelatedChallenges();
}

// === Try Coding Target Manager ===
function updateTryCodingTargets(cb) {
  const idx = parseInt(cb.value);
  if (!studyModeState.tryCodingTargetIndices) {
    studyModeState.tryCodingTargetIndices = [studyModeState.tryCodingExampleIndex || 0];
  }
  if (cb.checked) {
    if (!studyModeState.tryCodingTargetIndices.includes(idx)) {
      studyModeState.tryCodingTargetIndices.push(idx);
    }
  } else {
    studyModeState.tryCodingTargetIndices = studyModeState.tryCodingTargetIndices.filter(i => i !== idx);
  }
}

// === Examples Form ===
function renderStudyExamplesForm() {
  if (!studyModeState) return;

  const tabsContainer = document.getElementById('study-examples-tabs');
  tabsContainer.innerHTML = studyModeState.examples.map((ex, i) => `
    <div onclick="switchStudyExampleTab(${i})" class="variant-tab ${i === studyModeState.activeExampleIndex ? 'active' : ''}">
      ${escapeHTML(ex.name || 'Unnamed')}
      <span onclick="event.stopPropagation(); removeStudyExample(${i})" class="variant-tab-close"><i data-lucide="x" style="width:12px;height:12px;"></i></span>
    </div>
  `).join('');

  const targetsContainer = document.getElementById('try-coding-targets-container');
  if (targetsContainer) {
    let targetIndices = studyModeState.tryCodingTargetIndices || [0];
    targetsContainer.innerHTML = studyModeState.examples.map((ex, i) => `
      <label style="display:flex; align-items:center; gap:0.25rem; cursor:pointer; background: var(--bg-surface); padding: 0.25rem 0.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
        <input type="checkbox" value="${i}" onchange="updateTryCodingTargets(this)" ${targetIndices.includes(i) ? 'checked' : ''} />
        ${escapeHTML(ex.name || 'Example ' + (i + 1))}
      </label>
    `).join('');
  }

  const activeIdx = studyModeState.activeExampleIndex;
  const activeEx = studyModeState.examples[activeIdx];
  const contentContainer = document.getElementById('study-examples-content');

  if (!activeEx) {
    contentContainer.innerHTML = '<p class="empty-state">No examples added.</p>';
    return;
  }

  contentContainer.innerHTML = `
    <div>
      <label class="form-label">Example Name</label>
      <input value="${escapeHTML(activeEx.name)}" oninput="updateStudyExampleField('name', this.value)" class="form-input" />
    </div>
    <div>
      <label class="form-label" title="Format: '3', '2-5', '1,4'">Lines to Highlight (Context)</label>
      <input value="${escapeHTML(activeEx.highlightLines || '')}" oninput="updateStudyExampleField('highlightLines', this.value)" class="form-input" placeholder="e.g. 2-4" />
    </div>

    <div style="display:flex; flex-direction:column; flex:1; min-height:220px;">
      <label class="form-label" style="color:var(--color-success);">Target Correct Code (Hidden solution)</label>
      <div class="editor-container" style="flex:1; border-color:var(--color-success);">
        <pre id="study-example-target-pre" class="editor-pre"><code id="study-example-target-code"></code></pre>
        <textarea id="study-example-target-textarea" spellcheck="false" class="editor-textarea" placeholder="function() { ... }"></textarea>
      </div>
    </div>
  `;

  const targetTA = document.getElementById('study-example-target-textarea');
  const targetPre = document.getElementById('study-example-target-code');
  targetTA.value = activeEx.code || '';
  targetPre.innerHTML = syntaxHighlight(activeEx.code || '') + '<br/>';
  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('study-example-target-textarea', 'study-example-target-pre', 'study-example-target-code', false);
  }
  const finalTargetTA = document.getElementById('study-example-target-textarea') || targetTA;
  finalTargetTA.addEventListener('input', (e) => updateStudyExampleField('code', e.target.value));

  lucide.createIcons();
}

function switchStudyExampleTab(idx) {
  studyModeState.activeExampleIndex = idx;
  renderStudyExamplesForm();
}

function addStudyExample() {
  studyModeState.examples.push({ id: generateId(), name: 'Example ' + (studyModeState.examples.length + 1), code: '', highlightLines: '' });
  studyModeState.activeExampleIndex = studyModeState.examples.length - 1;
  renderStudyExamplesForm();
}

function removeStudyExample(idx) {
  studyModeState.examples.splice(idx, 1);
  studyModeState.activeExampleIndex = Math.max(0, studyModeState.activeExampleIndex - 1);
  if (studyModeState.tryCodingTargetIndices) {
    studyModeState.tryCodingTargetIndices = studyModeState.tryCodingTargetIndices
      .filter(i => i !== idx).map(i => i > idx ? i - 1 : i);
  }
  renderStudyExamplesForm();
}

function updateStudyExampleField(field, value) {
  if (studyModeState && studyModeState.examples[studyModeState.activeExampleIndex]) {
    studyModeState.examples[studyModeState.activeExampleIndex][field] = value;
    if (field === 'name') {
      const tabs = document.getElementById('study-examples-tabs');
      if (tabs && tabs.children[studyModeState.activeExampleIndex]) {
        tabs.children[studyModeState.activeExampleIndex].childNodes[0].nodeValue = " " + value + " ";
      }
      const targetsContainer = document.getElementById('try-coding-targets-container');
      if (targetsContainer) {
        let targetIndices = studyModeState.tryCodingTargetIndices || [0];
        targetsContainer.innerHTML = studyModeState.examples.map((ex, i) => `
          <label style="display:flex; align-items:center; gap:0.25rem; cursor:pointer; background: var(--bg-surface); padding: 0.25rem 0.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
            <input type="checkbox" value="${i}" onchange="updateTryCodingTargets(this)" ${targetIndices.includes(i) ? 'checked' : ''} />
            ${escapeHTML(ex.name || 'Example ' + (i + 1))}
          </label>
        `).join('');
      }
    }
  }
}

// ============================================================
// NOTEBOOKS (MCQ) ADMIN
// ============================================================
let notebookAdminState = null;

function switchAdminStudyTab(tabId, btnEl) {
  if (window.adminIsDirty) {
    showUnsavedConfirm(
      () => { window.adminIsDirty = false; switchAdminStudyTab(tabId, btnEl); },
      () => { 
        if (window.saveCurrentAdminForm) {
          const success = window.saveCurrentAdminForm({ silent: true });
          if (success === false) return; // validation failed
        }
        window.adminIsDirty = false; switchAdminStudyTab(tabId, btnEl); 
      }
    );
    return;
  }

  document.querySelectorAll('#admin-study-wrapper .study-tab').forEach(el => el.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  currentAdminStudyTab = tabId;
  const snippetTbody = document.getElementById('study-table-body');
  const notebookTbody = document.getElementById('notebook-table-body');
  const studyCatContainer = document.getElementById('study-category-container');
  const notebookCatContainer = document.getElementById('notebook-category-container');
  const newProgramBtnText = document.getElementById('new-btn-text');

  if (tabId === 'snippets') {
    snippetTbody.classList.remove('hidden');
    notebookTbody.classList.add('hidden');
    studyCatContainer.classList.remove('hidden');
    notebookCatContainer.classList.add('hidden');
    if (newProgramBtnText) newProgramBtnText.textContent = 'Create New Snippet';
    renderStudyAdmin();
  } else {
    snippetTbody.classList.add('hidden');
    notebookTbody.classList.remove('hidden');
    studyCatContainer.classList.add('hidden');
    notebookCatContainer.classList.remove('hidden');
    if (newProgramBtnText) newProgramBtnText.textContent = 'Create New Notebook';
  }

  closeAdminForm();
  closeStudyForm();
  if (typeof closeNotebookForm === 'function') closeNotebookForm();

  adminCategoryFilter = 'All';
  updateAdminFilter();

  if (tabId === 'snippets') renderStudyAdmin();
  else renderNotebookAdmin();
}

function renderNotebookAdmin() {
  updateAdminFilter();

  const tbody = document.getElementById('notebook-table-body');
  if (!tbody) return;

  if (!state.notebooks || state.notebooks.length === 0) {
    tbody.innerHTML = '<div class="empty-state" style="padding:2rem;"><p>No notebooks inside Training Grounds.</p></div>';
  } else {
    // Build notebook folder picker
    const nfpOpts = [];
    function buildNFP(pid, d) {
      getChildFolders(pid, 'notebook').forEach(f => {
        nfpOpts.push({ id: f.id, label: '\u00A0\u00A0'.repeat(d) + f.name });
        buildNFP(f.id, d + 1);
      });
    }
    buildNFP(null, 0);

    let filteredNotebooks = state.notebooks;
    
    const searchInput = document.getElementById('admin-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    if (query) {
      filteredNotebooks = filteredNotebooks.filter(nb => fuzzyMatch(nb.title, query) || (nb.tags || []).some(t => fuzzyMatch(t, query)));
    }
    
    if (adminCategoryFilter === '__uncategorized__') {
      filteredNotebooks = filteredNotebooks.filter(nb => nb.parentId === null || nb.parentId === undefined);
    } else if (adminCategoryFilter !== 'All') {
      const fids = new Set();
      function collectNFIds(id) { fids.add(id); getChildFolders(id, 'notebook').forEach(cf => collectNFIds(cf.id)); }
      collectNFIds(adminCategoryFilter);
      filteredNotebooks = filteredNotebooks.filter(nb => fids.has(nb.parentId));
    }

    tbody.innerHTML = filteredNotebooks.map(nb => `
      <div class="admin-list-item" onclick="openNotebookForm('${nb.id}')">
        <div class="admin-list-item-left">
          <div class="admin-list-item-title" style="display:flex; align-items:center; gap:0.5rem;">
            <i data-lucide="${nb.icon || 'book'}" style="width:16px;height:16px;color:var(--color-primary);"></i>
            ${escapeHTML(nb.title)}
          </div>
          <div class="admin-list-item-meta">
            <span>${(nb.sections || []).length} section(s)</span>
            <span class="admin-list-item-dot">·</span>
            <select onclick="event.stopPropagation()" onchange="moveItemToFolder('${nb.id}', 'notebook', this.value === '__none__' ? null : this.value)" class="form-select admin-list-item-select">
              <option value="__none__" ${!nb.parentId ? 'selected' : ''}>Uncategorized</option>
              ${nfpOpts.map(f => `<option value="${f.id}" ${nb.parentId === f.id ? 'selected' : ''}>${f.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="admin-list-item-actions">
          <button onclick="event.stopPropagation(); openNotebookForm('${nb.id}')" class="btn btn-ghost" title="Edit">
            <i data-lucide="pencil" style="width:16px;height:16px;color:var(--color-primary);"></i>
          </button>
          <button onclick="event.stopPropagation(); deleteNotebook('${nb.id}')" class="btn btn-ghost" title="Delete">
            <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  // Folder list (tree view)
  const catList = document.getElementById('notebook-category-list');
  if (catList) {
    catList.innerHTML = renderAdminFolderTree(null, 'notebook', 0);
    if (!catList.innerHTML) {
      catList.innerHTML = '<p style="font-size:0.8rem; color:var(--text-tertiary); padding:0.5rem;">No folders. Add one below.</p>';
    }
  }

  lucide.createIcons();
}

function openNotebookForm(id) {
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.add('hidden');
  document.getElementById('notebook-form-container').classList.remove('hidden');

  window.adminIsDirty = false;
  window.saveCurrentAdminForm = saveNotebookForm;

  // Build notebook folder picker
  const catSelect = document.getElementById('notebook-category');
  const nbFpOpts = [];
  function buildNFP2(pid, d) {
    getChildFolders(pid, 'notebook').forEach(f => {
      nbFpOpts.push({ id: f.id, label: '\u00A0\u00A0'.repeat(d) + f.name });
      buildNFP2(f.id, d + 1);
    });
  }
  buildNFP2(null, 0);
  catSelect.innerHTML = `<option value="">Uncategorized</option>` + nbFpOpts.map(f => `<option value="${f.id}">${f.label}</option>`).join('');

  if (id === 'new') {
    const firstNbFolder = state.nodes.find(n => n.type === 'folder' && n.scope === 'notebook');
    notebookAdminState = {
      id: 'new', title: '', parentId: firstNbFolder ? firstNbFolder.id : null,
      icon: 'book', tags: [], description: '', sections: []
    };
  } else {
    const existing = state.notebooks.find(n => n.id === id);
    notebookAdminState = JSON.parse(JSON.stringify(existing));
  }

  document.getElementById('notebook-form-title').textContent = id === 'new' ? 'New Notebook' : 'Edit Notebook';
  document.getElementById('notebook-title').value = notebookAdminState.title;
  document.getElementById('notebook-category').value = notebookAdminState.parentId || '';
  renderIconDropdown('notebook-icon-picker-container', notebookAdminState.icon || 'book', (newIcon) => {
    notebookAdminState.icon = newIcon;
  });
  document.getElementById('notebook-desc').value = notebookAdminState.description || '';

  renderNotebookTags();
  renderNotebookSectionsForm();
}

function closeNotebookForm() {
  notebookAdminState = null;
  const form = document.getElementById('notebook-form-container');
  if (form) form.classList.add('hidden');
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.remove('hidden');
}

function saveNotebookForm(opts = {}) {
  if (!notebookAdminState.title.trim()) { showMessage('Error', 'Title is required', true); return false; }

  // Update sections with current input values
  notebookAdminState.sections.forEach((sec, idx) => {
    sec.label = document.getElementById(`nb-sec-label-${idx}`).value;
    sec.choices = parseInt(document.getElementById(`nb-sec-choices-${idx}`).value) || 4;

    // Parse question count, ensuring it's an array of numbers [1, 2, 3...]
    const count = parseInt(document.getElementById(`nb-sec-count-${idx}`).value) || 1;
    sec.questions = Array.from({ length: count }, (_, i) => i + 1);
  });

  if (notebookAdminState.id === 'new') {
    notebookAdminState.id = 'nb_' + Date.now();
    state.notebooks.unshift(notebookAdminState);
  } else {
    const index = state.notebooks.findIndex(n => n.id === notebookAdminState.id);
    if (index !== -1) state.notebooks[index] = notebookAdminState;
  }

  saveData();
  closeNotebookForm();
  window.adminIsDirty = false;
  if (!opts.silent) showMessage('Success', 'Notebook saved successfully!');
  renderNotebookAdmin();
  return true;
}

function deleteNotebook(id) {
  showConfirm('Delete Notebook', 'Are you sure you want to delete this notebook?', () => {
    state.notebooks = state.notebooks.filter(n => n.id !== id);
    saveData();
    renderNotebookAdmin();
  });
}

function addNotebookCategory() {
  const input = document.getElementById('new-notebook-category-input');
  const cat = input.value.trim();
  if (cat) {
    createNode(cat, 'folder', null, 'notebook');
    input.value = '';
    renderNotebookAdmin();
  }
}

function removeNotebookCategory(nodeId) {
  const folder = state.nodes.find(n => n.id === nodeId);
  if (!folder) return;
  showConfirm("Delete Folder", `Delete "${escapeHTML(folder.name)}"? Items will become uncategorized.`, () => {
    deleteNode(nodeId);
    renderNotebookAdmin();
  });
}

function addNotebookTag() {
  const input = document.getElementById('notebook-tag-input');
  const tag = input.value.trim();
  if (tag && !notebookAdminState.tags.includes(tag)) {
    notebookAdminState.tags.push(tag);
    input.value = '';
    renderNotebookTags();
  }
}

function removeNotebookTag(tag) {
  notebookAdminState.tags = notebookAdminState.tags.filter(t => t !== tag);
  renderNotebookTags();
}

function renderNotebookTags() {
  const list = document.getElementById('notebook-tags-list');
  list.innerHTML = notebookAdminState.tags.map(t => `<span class="tag">${escapeHTML(t)} <button onclick="removeNotebookTag('${escapeHTML(t)}')" style="margin-left:4px;background:none;border:none;cursor:pointer;color:inherit;">&times;</button></span>`).join('');
}

function addNotebookSection() {
  syncAllNotebookSections();
  const label = document.getElementById('new-sec-label')?.value.trim() || 'New Section';
  const choices = parseInt(document.getElementById('new-sec-choices')?.value) || 4;

  notebookAdminState.sections.push({
    id: 'sec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    label: label,
    choices: choices,
    questions: [1, 2, 3, 4, 5],
    answerKey: '',
    answerKeysData: []
  });
  renderNotebookSectionsForm();
}

// BUG-23 FIX applied inside this function (.slice instead of .substr)
function bulkAddNotebookSections() {
  syncAllNotebookSections();
  const input = document.getElementById('bulk-add-sec-input')?.value.trim();
  if (!input) return;

  // Format: Math 10 | Science 5 (A-E)
  const parts = input.split('|').map(p => p.trim());
  parts.forEach(part => {
    if (!part) return;
    // Extract choices e.g. (A-E)
    let choices = 4;
    const choiceMatch = part.match(/\([A-Ea-e]-[A-Ea-e]\)/);
    let label = part;
    if (choiceMatch) {
      const charStr = choiceMatch[0].toUpperCase();
      if (charStr === '(A-C)') choices = 3;
      else if (charStr === '(A-D)') choices = 4;
      else if (charStr === '(A-E)') choices = 5;
      label = part.replace(choiceMatch[0], '').trim();
    }

    // Extract count e.g. 10
    const countMatch = label.match(/\d+$/);
    let count = 5;
    if (countMatch) {
      count = parseInt(countMatch[0]);
      label = label.replace(/\d+$/, '').trim();
    }

    notebookAdminState.sections.push({
      id: 'sec_' + Date.now() + Math.random().toString(36).slice(2, 7),
      label: label || 'Section',
      choices: choices,
      questions: Array.from({ length: count }, (_, i) => i + 1),
      answerKey: '',
      answerKeysData: []
    });
  });
  renderNotebookSectionsForm();
}

function removeNotebookSection(idx) {
  notebookAdminState.sections.splice(idx, 1);
  renderNotebookSectionsForm();
}

function renderNotebookSectionsForm() {
  const container = document.getElementById('notebook-sections-content');

  let html = '<div style="display:flex; flex-direction:column; gap:1rem;">';

  if (!notebookAdminState.sections || notebookAdminState.sections.length === 0) {
    html += '<div style="color:var(--text-tertiary); font-size:0.875rem;">No sections added yet.</div>';
  } else {
    html += notebookAdminState.sections.map((sec, idx) => `
      <div class="card-flat" style="padding:1rem; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="font-weight:700; font-size:0.875rem;">Section ${idx + 1}</h4>
          <button onclick="syncAllNotebookSections(); removeNotebookSection(${idx})" class="btn btn-ghost btn-sm" title="Remove Section">
            <i data-lucide="trash-2" style="width:14px;height:14px;color:var(--color-danger);"></i>
          </button>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <div style="flex:1; min-width:150px;">
            <label style="font-size:0.75rem; color:var(--text-tertiary);">Label</label>
            <input id="nb-sec-label-${idx}" class="form-input" value="${escapeHTML(sec.label || '')}" oninput="syncNotebookSection(${idx})" style="font-size:0.875rem; padding:0.25rem 0.5rem; height:auto;" />
          </div>
          <div style="width:100px;">
            <label style="font-size:0.75rem; color:var(--text-tertiary);">Choices</label>
            <select id="nb-sec-choices-${idx}" class="form-select" onchange="syncNotebookSection(${idx})" style="font-size:0.875rem; padding:0.25rem 0.5rem; height:auto;">
              <option value="3" ${sec.choices === 3 ? 'selected' : ''}>3 (A-C)</option>
              <option value="4" ${sec.choices === 4 ? 'selected' : ''}>4 (A-D)</option>
              <option value="5" ${sec.choices === 5 ? 'selected' : ''}>5 (A-E)</option>
            </select>
          </div>
          <div style="width:80px;">
            <label style="font-size:0.75rem; color:var(--text-tertiary);">Questions</label>
            <input id="nb-sec-count-${idx}" type="number" min="1" class="form-input" value="${(sec.questions || []).length}" oninput="syncNotebookSection(${idx})" style="font-size:0.875rem; padding:0.25rem 0.5rem; height:auto;" />
          </div>
        </div>
        <div>
          <button onclick="openGivenQuestionModal(${idx})" class="btn btn-secondary" style="width:100%; border:1px solid var(--border-color); background:var(--bg-surface-hover); margin-bottom:0.5rem;">
            <i data-lucide="file-text" style="width:16px;height:16px;"></i> Modify Given Question
          </button>
          <button onclick="openAnswerKeyModal(${idx})" class="btn btn-secondary" style="width:100%; border:1px solid var(--border-color); background:var(--bg-surface-hover);">
            <i data-lucide="key" style="width:16px;height:16px;"></i> Modify Answer Key
          </button>
        </div>
      </div>
    `).join('');
  }

  html += `
    <div class="card-flat" style="padding:1.25rem; border:1px solid var(--border-color);">
      <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">NEW SECTION</h4>
      <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; margin-bottom:0.75rem;">
        <input id="new-sec-label" class="form-input" placeholder="Section name..." style="flex:1; min-width:200px; padding:0.5rem 0.75rem; font-size:0.875rem; background:transparent;" />
      </div>
      <div style="display:flex; gap:0.5rem;">
        <select id="new-sec-choices" class="form-select" style="width:120px; font-size:0.875rem; padding:0.5rem;">
          <option value="3">3 (A-C)</option>
          <option value="4" selected>4 (A-D)</option>
          <option value="5">5 (A-E)</option>
        </select>
        <button onclick="addNotebookSection()" class="btn btn-primary" style="flex:1; background-color:#6366f1; border-color:#6366f1;">
          <i data-lucide="plus" style="width:16px;height:16px;"></i> Add Section
        </button>
      </div>
    </div>
    
    <div class="card-flat" style="padding:1.25rem; border:1px solid var(--border-color);">
      <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">BULK ADD</h4>
      <input id="bulk-add-sec-input" class="form-input" placeholder="Math 10 | Science 5 (A-E)" style="width:100%; padding:0.5rem 0.75rem; font-size:0.875rem; margin-bottom:0.75rem; background:transparent;" />
      <button onclick="bulkAddNotebookSections()" class="btn btn-secondary" style="width:100%;">
        <i data-lucide="layers" style="width:16px;height:16px;"></i> Confirm Bulk Add
      </button>
    </div>
  </div>`;

  container.innerHTML = html;
  lucide.createIcons();
}

function syncNotebookSection(idx) {
  if (!notebookAdminState || !notebookAdminState.sections[idx]) return;
  const sec = notebookAdminState.sections[idx];
  const labelEl = document.getElementById('nb-sec-label-' + idx);
  const choicesEl = document.getElementById('nb-sec-choices-' + idx);
  const countEl = document.getElementById('nb-sec-count-' + idx);
  if (labelEl) sec.label = labelEl.value;
  if (choicesEl) sec.choices = parseInt(choicesEl.value) || 4;
  if (countEl) {
    const count = Math.max(0, parseInt(countEl.value) || 0);
    sec.questions = Array.from({ length: count }, (_, i) => i + 1);
  }
}

function syncAllNotebookSections() {
  if (!notebookAdminState || !notebookAdminState.sections) return;
  notebookAdminState.sections.forEach((_, idx) => syncNotebookSection(idx));
}

// === Answer Key Modal Logic ===
let activeAnswerKeySectionIdx = -1;
let currentAnswerKeysData = [];

function parseOldAnswerKey(str) {
  const data = [];
  if (!str) return data;
  str.split('\n').forEach(line => {
    const match = line.trim().match(/^(\d+)\s*[=:]\s*([A-Ea-e])/);
    if (match) {
      data.push({ qNum: parseInt(match[1]), answer: match[2].toUpperCase(), explanation: '' });
    }
  });
  return data;
}

function openAnswerKeyModal(idx) {
  syncAllNotebookSections();
  activeAnswerKeySectionIdx = idx;
  const sec = notebookAdminState.sections[idx];

  if (!sec.answerKeysData) {
    sec.answerKeysData = parseOldAnswerKey(sec.answerKey);
  }

  currentAnswerKeysData = JSON.parse(JSON.stringify(sec.answerKeysData));

  // Ensure we have an entry for every question in the section
  sec.questions.forEach(q => {
    if (!currentAnswerKeysData.find(d => d.qNum === q)) {
      currentAnswerKeysData.push({ qNum: q, answer: '', explanation: '' });
    }
  });
  currentAnswerKeysData.sort((a, b) => a.qNum - b.qNum);

  document.getElementById('answer-key-modal').classList.remove('hidden');
  renderAnswerKeyContent();
}

function closeAnswerKeyModal() {
  document.getElementById('answer-key-modal').classList.add('hidden');
  activeAnswerKeySectionIdx = -1;
  currentAnswerKeysData = [];
}

function saveAnswerKeyModal() {
  if (activeAnswerKeySectionIdx === -1) return;
  const sec = notebookAdminState.sections[activeAnswerKeySectionIdx];

  syncAnswerKeyData();

  sec.answerKeysData = JSON.parse(JSON.stringify(currentAnswerKeysData));

  // Update old answerKey string for backward compatibility
  sec.answerKey = currentAnswerKeysData
    .filter(d => d.answer && d.answer.trim() !== '')
    .map(d => `${d.qNum}=${d.answer.trim().toUpperCase()}`)
    .join('\n');

  closeAnswerKeyModal();
  renderNotebookSectionsForm();
}

function syncAnswerKeyData() {
  currentAnswerKeysData.forEach((d, i) => {
    const ansEl = document.getElementById(`ak-ans-${i}`);
    const expEl = document.getElementById(`ak-exp-${i}`);
    if (ansEl) d.answer = ansEl.value.toUpperCase();
    if (expEl) d.explanation = expEl.value;
  });
}

function addAnswerKeySample() {
  syncAnswerKeyData();
  const nextQ = currentAnswerKeysData.length > 0 ? Math.max(...currentAnswerKeysData.map(d => d.qNum)) + 1 : 1;
  currentAnswerKeysData.push({ qNum: nextQ, answer: '', explanation: '' });
  renderAnswerKeyContent();
}

function removeAnswerKeySample(idx) {
  syncAnswerKeyData();
  currentAnswerKeysData.splice(idx, 1);
  renderAnswerKeyContent();
}

function bulkAddAnswers() {
  syncAnswerKeyData();
  const input = document.getElementById('ak-bulk-input').value.trim();
  const expInput = document.getElementById('ak-bulk-exp-input') ? document.getElementById('ak-bulk-exp-input').value.trim() : '';
  if (!input && !expInput) return;

  if (input) {
    let autoQNum = 1;
    input.split('\n').forEach(line => {
      line = line.trim();
      if (!line) return;

      // Format: "1. A" or "1=A"
      const match = line.match(/^(\d+)[.=:\s]+([A-Ea-e])/);
      let qNum;
      let ans;
      if (match) {
        qNum = parseInt(match[1]);
        ans = match[2].toUpperCase();
        autoQNum = qNum + 1;
      } else {
        qNum = autoQNum;
        autoQNum++;
        // Attempt to extract just a single letter if possible
        const straightMatch = line.match(/^["']?([A-Ea-e])["']?$/i);
        ans = straightMatch ? straightMatch[1].toUpperCase() : line.charAt(0).toUpperCase();
      }

      const existing = currentAnswerKeysData.find(d => d.qNum === qNum);
      if (existing) {
        existing.answer = ans;
      } else {
        currentAnswerKeysData.push({ qNum: qNum, answer: ans, explanation: '' });
      }
    });
  }

  if (expInput) {
    let autoQNum = 1;
    expInput.split('\n').forEach(line => {
      line = line.trim();
      if (!line) return;

      const match = line.match(/^(\d+)[.=:\s]+["']?(.*?)["']?$/);
      let qNum;
      let text;
      if (match) {
        qNum = parseInt(match[1]);
        text = match[2].trim();
        autoQNum = qNum + 1;
      } else {
        qNum = autoQNum;
        autoQNum++;
        const stripQuotes = line.match(/^["']?(.*?)["']?$/);
        text = stripQuotes ? stripQuotes[1].trim() : line;
      }

      const existing = currentAnswerKeysData.find(d => d.qNum === qNum);
      if (existing) {
        existing.explanation = text;
      } else {
        currentAnswerKeysData.push({ qNum: qNum, answer: '', explanation: text });
      }
    });
  }

  currentAnswerKeysData.sort((a, b) => a.qNum - b.qNum);
  renderAnswerKeyContent();
}

function renderAnswerKeyContent() {
  const container = document.getElementById('answer-key-content');

  let html = `
    <div style="display: flex; gap: 2rem; height: 100%; flex-wrap: wrap;">
      <div style="flex: 1 1 500px; display:flex; flex-direction:column; min-width: 0; overflow-y: auto; max-height: 60vh;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin:0;">ANSWER KEYS</h4>
          <button onclick="addAnswerKeySample()" class="btn btn-ghost btn-sm" style="color:var(--color-primary); font-weight:600;">
            <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add Answer
          </button>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:1rem; margin-bottom:2rem;">
  `;

  if (currentAnswerKeysData.length === 0) {
    html += '<p style="color:var(--text-tertiary); font-size:0.875rem;">No answers added yet.</p>';
  } else {
    html += currentAnswerKeysData.map((d, i) => `
      <div class="card-flat" style="padding:1rem; border:1px solid var(--border-color); background:var(--bg-surface-hover);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <h5 style="font-weight:700; font-size:0.875rem; margin:0;">Question ${d.qNum}</h5>
          <button onclick="removeAnswerKeySample(${i})" class="btn btn-ghost btn-sm" title="Remove" style="padding:0.25rem;">
            <i data-lucide="trash-2" style="width:14px;height:14px;color:var(--color-danger);"></i>
          </button>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; background:var(--bg-surface); border:1px solid var(--border-color); padding:0.25rem 0.5rem; border-radius:var(--radius-sm);">
            <span style="font-size:0.875rem; font-family:var(--font-mono); color:var(--text-secondary);">Answer:</span>
            <input id="ak-ans-${i}" value="${escapeHTML(d.answer || '')}" class="form-input" style="flex:1; border:none; background:transparent; padding:0; height:auto; box-shadow:none; font-family:var(--font-mono); text-transform:uppercase;" maxlength="1" />
          </div>
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label style="font-size:0.75rem; color:var(--text-tertiary);">Explanation (Optional)</label>
            <textarea id="ak-exp-${i}" rows="2" class="form-textarea" placeholder="Explanation for this answer..." style="font-size:0.875rem; padding:0.5rem;">${escapeHTML(d.explanation || '')}</textarea>
          </div>
        </div>
      </div>
    `).join('');
  }

  html += `
        </div>
      </div>
      
      <div style="flex: 1 1 300px; max-width: 400px; display:flex; flex-direction:column; gap:1rem; min-width: 0; overflow-y: auto; max-height: 60vh;">
        <div class="card-flat" style="padding:1.25rem; border:1px solid var(--border-color);">
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">BULK ADD ANSWER KEY</h4>
          <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Format: '1. A' OR straight text per line (e.g. 'A')</p>
          <textarea id="ak-bulk-input" class="form-textarea" rows="4" placeholder="1. A\n2. B\nOR\nA\nB" style="font-family:var(--font-mono); font-size:0.875rem; margin-bottom:1rem;"></textarea>
          
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">BULK EXPLANATIONS</h4>
          <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Format: '1. Explanation text' OR straight text per line</p>
          <textarea id="ak-bulk-exp-input" class="form-textarea" rows="4" placeholder="1. Explanation...\n2. Explanation..." style="font-family:var(--font-mono); font-size:0.875rem; margin-bottom:1rem;"></textarea>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  lucide.createIcons();
}

// === Given Question Modal Logic ===
let activeGivenQuestionSectionIdx = -1;
let currentGivenQuestionsData = [];

function openGivenQuestionModal(idx) {
  syncAllNotebookSections();
  activeGivenQuestionSectionIdx = idx;
  const sec = notebookAdminState.sections[idx];

  if (!sec.answerKeysData) {
    sec.answerKeysData = [];
  }

  currentGivenQuestionsData = JSON.parse(JSON.stringify(sec.answerKeysData));

  sec.questions.forEach(q => {
    if (!currentGivenQuestionsData.find(d => d.qNum === q)) {
      currentGivenQuestionsData.push({ qNum: q, answer: '', explanation: '', question: '', hint: '' });
    }
  });
  currentGivenQuestionsData.sort((a, b) => a.qNum - b.qNum);

  document.getElementById('given-question-modal').classList.remove('hidden');
  renderGivenQuestionContent();
}

function closeGivenQuestionModal() {
  document.getElementById('given-question-modal').classList.add('hidden');
  activeGivenQuestionSectionIdx = -1;
  currentGivenQuestionsData = [];
}

function saveGivenQuestionModal() {
  if (activeGivenQuestionSectionIdx === -1) return;
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];

  syncGivenQuestionData();

  // Merge currentGivenQuestionsData into sec.answerKeysData to avoid overwriting answers
  if (!sec.answerKeysData) {
    sec.answerKeysData = [];
  }

  currentGivenQuestionsData.forEach(gq => {
    const existing = sec.answerKeysData.find(d => d.qNum === gq.qNum);
    if (existing) {
      existing.question = gq.question;
      existing.hint = gq.hint;
    } else {
      sec.answerKeysData.push(gq);
    }
  });

  closeGivenQuestionModal();
  renderNotebookSectionsForm();
}

function syncGivenQuestionData() {
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];
  const choiceLetters = Array.from({ length: sec.choices || 4 }, (_, i) => String.fromCharCode(65 + i));

  currentGivenQuestionsData.forEach((d, i) => {
    const qEl = document.getElementById(`gq-text-${i}`);
    const hEl = document.getElementById(`gq-hint-${i}`);
    if (qEl) d.question = qEl.value;
    if (hEl) d.hint = hEl.value;

    if (!d.choices) d.choices = {};
    choiceLetters.forEach(letter => {
      const cEl = document.getElementById(`gq-choice-${i}-${letter}`);
      if (cEl) {
        d.choices[letter] = cEl.value;
      }
    });
  });
}

// BUG-22 FIX applied inside this function (mojibake character fix)
function bulkAddGivenQuestions() {
  syncGivenQuestionData();
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];
  const choiceLetters = Array.from({ length: sec.choices || 4 }, (_, i) => String.fromCharCode(65 + i));
  const maxChoiceChar = choiceLetters[choiceLetters.length - 1];

  const qInput = document.getElementById('gq-bulk-questions').value.trim();
  const hInput = document.getElementById('gq-bulk-hints').value.trim();
  const cInput = document.getElementById('gq-bulk-choices') ? document.getElementById('gq-bulk-choices').value.trim() : '';

  // Helper: extract inline choices like "A) text B) text C) text" from a string
  function extractInlineChoices(text, maxLetter) {
    const choices = {};
    // Match patterns like A) text, A. text, A] text — capturing sentence-length content
    const regex = /\b([A-Ea-e])[\)\.\/\]]\s*/g;
    const parts = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      parts.push({ letter: m[1].toUpperCase(), index: m.index });
    }
    if (parts.length < 2) return { cleaned: text, choices: {} }; // Need at least 2 choices to be valid

    // Verify the choices are sequential starting from A
    const firstLetter = parts[0].letter;
    if (firstLetter !== 'A') return { cleaned: text, choices: {} };

    const questionText = text.substring(0, parts[0].index).trim();
    for (let i = 0; i < parts.length; i++) {
      const start = parts[i].index + parts[i].letter.length + 2; // skip "A) "
      const end = i + 1 < parts.length ? parts[i + 1].index : text.length;
      const choiceText = text.substring(start, end).trim();
      if (parts[i].letter <= maxLetter) {
        choices[parts[i].letter] = choiceText;
      }
    }
    return { cleaned: questionText, choices };
  }

  if (qInput) {
    let autoQNum = 1;
    let autoChoices = {};
    let bufferQNum = null;
    let bufferText = '';

    const lines = qInput.split('\n');
    lines.forEach((line, idx) => {
      line = line.trim();
      if (!line) return;

      // Check if line is a standalone choice, e.g. "A. Apple", "A) Apple", "A] Apple"
      const choiceMatch = line.match(/^([A-Ea-e])[\.\)\]]\s*(.*)$/);
      if (choiceMatch && bufferQNum !== null) {
        const letter = choiceMatch[1].toUpperCase();
        if (letter <= maxChoiceChar) {
          autoChoices[letter] = choiceMatch[2].trim();
          return;
        }
      }

      // Check if line starts a new question, e.g. "1. Question"
      const match = line.match(/^(\d+)[.=:\s]+["']?(.*?)["']?$/);
      let qNum;
      let text;
      let isNewQ = false;

      if (match) {
        qNum = parseInt(match[1]);
        text = match[2].trim();
        autoQNum = qNum + 1;
        isNewQ = true;
      } else if (!choiceMatch) {
        qNum = autoQNum;
        autoQNum++;
        const stripQuotes = line.match(/^["']?(.*?)["']?$/);
        text = stripQuotes ? stripQuotes[1].trim() : line;
        isNewQ = true;
      }

      if (isNewQ) {
        // Save previous question
        if (bufferQNum !== null) {
          // Try to extract inline choices from the buffer text
          const extracted = extractInlineChoices(bufferText, maxChoiceChar);
          if (Object.keys(extracted.choices).length > 0) {
            bufferText = extracted.cleaned;
            autoChoices = { ...autoChoices, ...extracted.choices };
          }
          const existing = currentGivenQuestionsData.find(d => d.qNum === bufferQNum);
          if (existing) {
            existing.question = bufferText;
            existing.choices = { ...existing.choices, ...autoChoices };
          } else {
            currentGivenQuestionsData.push({ qNum: bufferQNum, question: bufferText, hint: '', answer: '', explanation: '', choices: { ...autoChoices } });
          }
        }
        bufferQNum = qNum;
        bufferText = text;
        autoChoices = {};
      } else if (!choiceMatch && bufferQNum !== null) {
        bufferText += '\n' + line;
      }
    });

    // Save the last buffered question
    if (bufferQNum !== null) {
      const extracted = extractInlineChoices(bufferText, maxChoiceChar);
      if (Object.keys(extracted.choices).length > 0) {
        bufferText = extracted.cleaned;
        autoChoices = { ...autoChoices, ...extracted.choices };
      }
      const existing = currentGivenQuestionsData.find(d => d.qNum === bufferQNum);
      if (existing) {
        existing.question = bufferText;
        existing.choices = { ...existing.choices, ...autoChoices };
      } else {
        currentGivenQuestionsData.push({ qNum: bufferQNum, question: bufferText, hint: '', answer: '', explanation: '', choices: { ...autoChoices } });
      }
    }
  }

  if (hInput) {
    let autoQNum = 1;
    hInput.split('\n').forEach(line => {
      line = line.trim();
      if (!line) return;
      const match = line.match(/^(\d+)[.=:\s]+["']?(.*?)["']?$/);
      let qNum;
      let text;
      if (match) {
        qNum = parseInt(match[1]);
        text = match[2].trim();
        autoQNum = qNum + 1;
      } else {
        qNum = autoQNum;
        autoQNum++;
        const stripQuotes = line.match(/^["']?(.*?)["']?$/);
        text = stripQuotes ? stripQuotes[1].trim() : line;
      }
      const existing = currentGivenQuestionsData.find(d => d.qNum === qNum);
      if (existing) {
        existing.hint = text;
      } else {
        currentGivenQuestionsData.push({ qNum: qNum, question: '', hint: text, answer: '', explanation: '', choices: {} });
      }
    });
  }

  if (cInput) {
    let autoQNum = 1;
    let autoChoices = {};
    let bufferQNum = null;

    const lines = cInput.split('\n');
    lines.forEach((line, idx) => {
      line = line.trim();
      if (!line) return;

      const qMatch = line.match(/^(\d+)[.=:\s]*$/); // "1." or "1" alone on a line? Or assume unnumbered

      const match = line.match(/^(\d+)[.=:\s]+(.*)$/);
      if (qMatch) {
        if (bufferQNum !== null) {
          const existing = currentGivenQuestionsData.find(d => d.qNum === bufferQNum);
          if (existing) { existing.choices = { ...existing.choices, ...autoChoices }; }
          else { currentGivenQuestionsData.push({ qNum: bufferQNum, question: '', hint: '', answer: '', explanation: '', choices: { ...autoChoices } }); }
        }
        bufferQNum = parseInt(qMatch[1]);
        autoChoices = {};
        return;
      }

      if (match) {
        if (bufferQNum !== null) {
          const existing = currentGivenQuestionsData.find(d => d.qNum === bufferQNum);
          if (existing) { existing.choices = { ...existing.choices, ...autoChoices }; }
          else { currentGivenQuestionsData.push({ qNum: bufferQNum, question: '', hint: '', answer: '', explanation: '', choices: { ...autoChoices } }); }
        }
        bufferQNum = parseInt(match[1]);
        autoChoices = {};

        // Is there a choice on this same line?
        const choiceMatch = match[2].match(/^([A-Ea-e])[\.\)\]]\s*(.*)$/);
        if (choiceMatch) {
          const letter = choiceMatch[1].toUpperCase();
          if (letter <= maxChoiceChar) autoChoices[letter] = choiceMatch[2].trim();
        }
        return;
      }

      const choiceMatch = line.match(/^([A-Ea-e])[\.\)\]]\s*(.*)$/);
      if (choiceMatch) {
        if (bufferQNum === null) {
          bufferQNum = autoQNum;
          autoQNum++;
        }
        const letter = choiceMatch[1].toUpperCase();
        if (letter <= maxChoiceChar) {
          autoChoices[letter] = choiceMatch[2].trim();
        }

        // If we hit the max choice, auto-increment for next implicit block
        if (letter === maxChoiceChar) {
          const existing = currentGivenQuestionsData.find(d => d.qNum === bufferQNum);
          if (existing) { existing.choices = { ...existing.choices, ...autoChoices }; }
          else { currentGivenQuestionsData.push({ qNum: bufferQNum, question: '', hint: '', answer: '', explanation: '', choices: { ...autoChoices } }); }
          bufferQNum = null;
          autoChoices = {};
        }
      }
    });

    if (bufferQNum !== null && Object.keys(autoChoices).length > 0) {
      const existing = currentGivenQuestionsData.find(d => d.qNum === bufferQNum);
      if (existing) { existing.choices = { ...existing.choices, ...autoChoices }; }
      else { currentGivenQuestionsData.push({ qNum: bufferQNum, question: '', hint: '', answer: '', explanation: '', choices: { ...autoChoices } }); }
    }
  }

  currentGivenQuestionsData.sort((a, b) => a.qNum - b.qNum);
  renderGivenQuestionContent();
}

function renderGivenQuestionContent() {
  const container = document.getElementById('given-question-content');
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];
  const choiceLetters = Array.from({ length: sec.choices || 4 }, (_, i) => String.fromCharCode(65 + i));

  let html = `
    <div style="display: flex; gap: 2rem; height: 100%; flex-wrap: wrap;">
      <div style="flex: 1 1 500px; display:flex; flex-direction:column; min-width: 0; overflow-y: auto; max-height: 60vh;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin:0;">GIVEN QUESTIONS</h4>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:1rem; margin-bottom:2rem;">
  `;

  if (currentGivenQuestionsData.length === 0) {
    html += '<p style="color:var(--text-tertiary); font-size:0.875rem;">No questions added yet.</p>';
  } else {
    html += currentGivenQuestionsData.map((d, i) => {
      let choicesHtml = choiceLetters.map(letter => {
        let val = d.choices && d.choices[letter] ? escapeHTML(d.choices[letter]) : '';
        return `
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-tertiary); width:15px;">${letter}.</span>
            <input id="gq-choice-${i}-${letter}" class="form-input" style="flex:1; padding:0.25rem 0.5rem; font-size:0.875rem; height:auto;" placeholder="Choice ${letter}..." value="${val}" />
          </div>
        `;
      }).join('');

      return `
        <div class="card-flat" style="padding:1rem; border:1px solid var(--border-color); background:var(--bg-surface-hover);">
          <h5 style="font-weight:700; font-size:0.875rem; margin-bottom:0.75rem; margin-top:0;">Question ${d.qNum}</h5>
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
              <label style="font-size:0.75rem; color:var(--text-tertiary);">Given Question</label>
              <textarea id="gq-text-${i}" rows="2" class="form-textarea" placeholder="Question text..." style="font-size:0.875rem; padding:0.5rem;">${escapeHTML(d.question || '')}</textarea>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:0.25rem; margin-top:0.5rem; background:var(--bg-surface); padding:0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
              <label style="font-size:0.75rem; color:var(--text-tertiary);">MCQ Choices</label>
              <div style="display:flex; flex-direction:column; gap:0.375rem;">
                ${choicesHtml}
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:0.25rem; margin-top:0.5rem;">
              <label style="font-size:0.75rem; color:var(--text-tertiary);">Hint (Optional)</label>
              <textarea id="gq-hint-${i}" rows="2" class="form-textarea" placeholder="Hint for this question..." style="font-size:0.875rem; padding:0.5rem;">${escapeHTML(d.hint || '')}</textarea>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  html += `
        </div>
      </div>
      
      <div style="flex: 1 1 300px; max-width: 400px; display:flex; flex-direction:column; gap:1rem; min-width: 0; overflow-y: auto; max-height: 60vh;">
        <div class="card-flat" style="padding:1.25rem; border:1px solid var(--border-color);">
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">BULK ADD GIVEN QUESTION</h4>
          <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Format: 1. "Question text"<br/>(Choices A. B. appended below will be automatically parsed)</p>
          <textarea id="gq-bulk-questions" class="form-textarea" rows="4" placeholder="1. What is 1+1?\nA. 1\nB. 2" style="font-family:var(--font-mono); font-size:0.875rem; margin-bottom:1rem;"></textarea>
          
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">BULK ADD CHOICES</h4>
          <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Format: A. Apple<br/>(Implicitly assigns to next empty question block, or specify 1. first)</p>
          <textarea id="gq-bulk-choices" class="form-textarea" rows="4" placeholder="1.\nA. Apple\nB. Banana\n2.\nA. Cat\nB. Dog" style="font-family:var(--font-mono); font-size:0.875rem; margin-bottom:1rem;"></textarea>

          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">HINTS</h4>
          <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Format: 1. "Hint text"</p>
          <textarea id="gq-bulk-hints" class="form-textarea" rows="3" placeholder="1. Think about addition." style="font-family:var(--font-mono); font-size:0.875rem; margin-bottom:0.75rem;"></textarea>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  lucide.createIcons();
}