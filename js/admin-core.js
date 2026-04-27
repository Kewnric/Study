let currentAdminMode = 'study';
let adminCategoryFilter = 'All';
let currentAdminStudyTab = 'notes'; // 'snippets' or 'notes'

window.adminIsDirty = false;
window.saveCurrentAdminForm = null;

document.addEventListener('DOMContentLoaded', () => {
  const adminContainers = [
    { id: 'admin-form-container', stateCheck: () => typeof adminState !== 'undefined' && adminState !== null },
    { id: 'study-form-container', stateCheck: () => typeof studyModeState !== 'undefined' && studyModeState !== null },
    { id: 'notebook-form-container', stateCheck: () => typeof notebookAdminState !== 'undefined' && notebookAdminState !== null }
  ];
  adminContainers.forEach(c => {
    const el = document.getElementById(c.id);
    if (el) {
      const setDirty = () => { if (c.stateCheck()) window.adminIsDirty = true; };
      el.addEventListener('input', setDirty);
      el.addEventListener('change', setDirty);
    }
  });
});

function updateAdminFilter() {
  const filterContainer = document.getElementById('admin-filter-container');
  if (!filterContainer) return;

  let scope = 'challenge';
  if (currentAdminMode === 'study') {
    scope = (currentAdminStudyTab === 'snippets') ? 'snippet' : 'notebook';
  }

  // Build folder options from tree
  const folderOptions = [];
  function buildOptions(parentId, depth) {
    const folders = getChildFolders(parentId, scope);
    folders.forEach(f => {
      const indent = '\u00A0\u00A0'.repeat(depth);
      folderOptions.push({ id: f.id, label: indent + f.name });
      buildOptions(f.id, depth + 1);
    });
  }
  buildOptions(null, 0);

  // Ensure current filter is valid
  if (adminCategoryFilter !== 'All' && !folderOptions.some(f => f.id === adminCategoryFilter)) {
    adminCategoryFilter = 'All';
  }

  filterContainer.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem; background: var(--bg-surface-hover); padding: 0.625rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
      <i data-lucide="filter" style="width:16px; height:16px; color:var(--text-tertiary);"></i>
      <label class="form-label" style="margin: 0;">Filter:</label>
      <select onchange="adminCategoryFilter = this.value; renderAdmin();" class="form-select" style="width: auto; padding: 0.25rem 2rem 0.25rem 0.75rem;">
        <option value="All" ${adminCategoryFilter === 'All' ? 'selected' : ''}>All Folders</option>
        <option value="__uncategorized__" ${adminCategoryFilter === '__uncategorized__' ? 'selected' : ''}>Uncategorized</option>
        ${folderOptions.map(f => `<option value="${f.id}" ${adminCategoryFilter === f.id ? 'selected' : ''}>${f.label}</option>`).join('')}
      </select>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openNewAdminItem() {
  if (currentAdminMode === 'practice') {
    openAdminForm('new');
  } else if (currentAdminMode === 'study') {
    if (currentAdminStudyTab === 'snippets') {
      openStudyForm('new');
    } else {
      openNotebookForm('new');
    }
  }
}

function renderAdminFolderTree(parentId, scope, depth) {
  const folders = getChildFolders(parentId, scope);
  let html = '';

  folders.forEach(folder => {
    const isEditing = window.editingCategory && window.editingCategory.nodeId === folder.id;
    const indent = depth * 1;
    const childCount = countItemsRecursive(folder.id, scope);

    html += `
      <li class="category-item" style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 0.5rem 0.75rem; padding-left: calc(0.75rem + ${indent}rem); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 0.25rem;">
        ${isEditing ? `
          <div style="display:flex; gap:0.5rem; flex:1; align-items:center;">
            <input id="rename-input-${folder.id}" type="text" class="form-input" value="${escapeHTML(folder.name)}" style="flex:1; padding:0.25rem 0.5rem;" onkeydown="if(event.key==='Enter') adminSaveFolderRename('${folder.id}', this.value)" />
            <button onclick="adminSaveFolderRename('${folder.id}', document.getElementById('rename-input-${folder.id}').value)" class="btn btn-ghost" style="padding:0.25rem;" title="Save">
              <i data-lucide="check" style="width:16px;height:16px;color:var(--color-success);"></i>
            </button>
            <button onclick="window.editingCategory = null; renderAdmin();" class="btn btn-ghost" style="padding:0.25rem;" title="Cancel">
              <i data-lucide="x" style="width:16px;height:16px;color:var(--text-tertiary);"></i>
            </button>
          </div>
        ` : `
          <div style="display: flex; align-items: center; gap: 0.5rem; flex:1; min-width:0;">
            <i data-lucide="folder" style="width:16px;height:16px;color:var(--color-accent);flex-shrink:0;"></i>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(folder.name)}</span>
            <span style="font-size:0.65rem; color:var(--text-tertiary);">${childCount}</span>
          </div>
          <div style="display:flex; gap:0.25rem;">
            <button onclick="window.editingCategory = {nodeId: '${folder.id}'}; renderAdmin();" class="btn btn-ghost" style="padding:0.25rem;" title="Rename">
              <i data-lucide="pencil" style="width:16px;height:16px;color:var(--text-secondary);"></i>
            </button>
            <button onclick="removeCategory('${folder.id}')" class="btn btn-ghost" style="padding:0.25rem;" title="Remove">
              <i data-lucide="x" style="width:16px;height:16px;color:var(--color-danger);"></i>
            </button>
          </div>
        `}
      </li>
    `;

    // Render children recursively
    html += renderAdminFolderTree(folder.id, scope, depth + 1);
  });

  return html;
}

function adminSaveFolderRename(nodeId, newName) {
  if (!newName || !newName.trim()) {
    window.editingCategory = null;
    renderAdmin();
    return;
  }
  renameNode(nodeId, newName.trim());
  window.editingCategory = null;
  renderAdmin();
}

function toggleAdminMode(mode) {
  if (window.adminIsDirty) {
    showUnsavedConfirm(
      () => { window.adminIsDirty = false; toggleAdminMode(mode); },
      () => { 
        if (window.saveCurrentAdminForm) {
          const success = window.saveCurrentAdminForm({ silent: true });
          if (success === false) return; // validation failed
        }
        window.adminIsDirty = false; toggleAdminMode(mode); 
      }
    );
    return;
  }

  currentAdminMode = mode;
  document.getElementById('admin-toggles').dataset.active = mode;
  document.getElementById('admin-practice-wrapper').classList.toggle('hidden', mode !== 'practice');
  document.getElementById('admin-study-wrapper').classList.toggle('hidden', mode !== 'study');

  // Update create button text based on mode + sub-tab
  const btnText = document.getElementById('new-btn-text');
  if (btnText) {
    if (mode === 'practice') {
      btnText.innerText = 'Create New Program';
    } else if (currentAdminStudyTab === 'notes') {
      btnText.innerText = 'Create New Notebook';
    } else {
      btnText.innerText = 'Create New Snippet';
    }
  }

  // Ensure 2nd Window reverts to Empty State on tab switch
  closeAdminForm();
  closeStudyForm();
  if (typeof closeNotebookForm === 'function') closeNotebookForm();

  adminCategoryFilter = 'All';
  updateAdminFilter();

  renderAdmin();
}