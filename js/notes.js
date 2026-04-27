/* ============================================================
   NOTES.JS — Notebook Browsing for Training Grounds
   ============================================================ */

let activeNotebookId = null;
let activeNotebookFolderId = getSessionParam('studyOpenCat') || null;
let notebookCtxTargetNodeId = null; // Phase 4 FIX: Added Context Menu Target
let _notebookContainerCtxHandler = null;

// --- Init & Render ---
function notesInit() {
  notesRenderSidebar();
  notesRenderDetail();
}

function notesRenderSidebar() {
  const container = document.getElementById('notes-sidebar-container');
  if (!container) return;

  const searchInput = document.getElementById('snippet-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (!state.notebooks || state.notebooks.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding: 2rem;">No notebooks available.</div>';
    return;
  }

  let html = renderNotebookTreeRecursive(null, 0, query);

  // Show root-level (orphaned) notebooks count as Uncategorized
  const rootNotebooks = state.notebooks.filter(nb => nb.parentId === null || nb.parentId === undefined);
  let filteredRoot = rootNotebooks;
  if (query) {
    filteredRoot = rootNotebooks.filter(nb =>
      nb.title.toLowerCase().includes(query) || (nb.tags || []).some(t => t.toLowerCase().includes(query))
    );
  }
  
  if (filteredRoot.length > 0 || state.nodes.filter(n => n.scope === 'notebook').length === 0) {
    const isActive = activeNotebookFolderId === '__root__';
    const count = filteredRoot.length;
    if (count > 0 || !html) {
      html += `
        <div class="tree-node" data-level="0">
          <div class="tree-node-row ${isActive ? 'active' : ''}" onclick="selectNotebookFolder('__root__')">
            <i data-lucide="chevron-right" class="tree-node-chevron invisible"></i>
            <i data-lucide="inbox" class="tree-node-icon item-icon-color"></i>
            <span class="tree-node-label">Uncategorized</span>
            <span class="tree-node-badge">${count}</span>
          </div>
        </div>
      `;
    }
  }

  if (!html) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <p style="color:var(--text-tertiary); font-size:0.875rem;">No folders. Right-click to create one.</p>
      </div>`;
  } else {
    container.innerHTML = html;
  }

  // Phase 4 FIX: Attach right-click context menu listeners
  container.querySelectorAll('.tree-node-row[data-node-id]').forEach(row => {
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showNotebookCtxMenu(e, row.getAttribute('data-node-id'));
    });
  });

  // Root level context menu trigger
  if (_notebookContainerCtxHandler) {
    container.removeEventListener('contextmenu', _notebookContainerCtxHandler);
  }
  _notebookContainerCtxHandler = (e) => {
    if (e.target === container || e.target.closest('.empty-state')) {
      e.preventDefault();
      showNotebookCtxMenu(e, null);
    }
  };
  container.addEventListener('contextmenu', _notebookContainerCtxHandler);

  lucide.createIcons();
}

function renderNotebookTreeRecursive(parentId, depth, query) {
  const folders = getChildFolders(parentId, 'notebook');
  let html = '';

  folders.forEach(folder => {
    const totalItems = countItemsRecursive(folder.id, 'notebook');
    const hasChildren = getChildFolders(folder.id, 'notebook').length > 0;
    const expanded = isNodeExpanded(folder.id);
    const isActive = activeNotebookFolderId === folder.id;

    if (query) {
      const hasMatch = folderHasMatchingNotebooks(folder.id, query);
      if (!hasMatch) return;
    }

    const indent = depth * 0.75;
    const chevronClass = (hasChildren || totalItems > 0) ? (expanded ? 'expanded' : '') : 'invisible';

    html += `
      <div class="tree-node" data-level="${depth}">
        <div class="tree-node-row ${isActive ? 'active' : ''}"
             data-node-id="${folder.id}"
             style="padding-left: calc(0.5rem + ${indent}rem)"
             onclick="selectNotebookFolder('${folder.id}')">
          <i data-lucide="chevron-right" class="tree-node-chevron ${chevronClass}" onclick="toggleNotebookFolder('${folder.id}', event)"></i>
          <i data-lucide="${folder.icon || 'folder'}" class="tree-node-icon folder-icon-color"></i>
          <span class="tree-node-label">${escapeHTML(folder.name)}</span>
          <span class="tree-node-badge">${totalItems}</span>
        </div>
        <div class="tree-children ${expanded || query ? '' : 'collapsed'}">
          <div class="tree-children-inner">
            ${renderNotebookTreeRecursive(folder.id, depth + 1, query)}
          </div>
        </div>
      </div>
    `;
  });

  return html;
}

function folderHasMatchingNotebooks(folderId, query) {
  const items = getItemsInFolder(folderId, 'notebook');
  if (items.some(nb => nb.title.toLowerCase().includes(query) || (nb.tags || []).some(t => t.toLowerCase().includes(query)))) return true;
  const childFolders = getChildFolders(folderId, 'notebook');
  return childFolders.some(cf => folderHasMatchingNotebooks(cf.id, query));
}

function renderNotebookItem(nb, depth) {
  return ''; // Deprecated: Notebooks are now rendered in the right pane via renderNotebookFolderOverview
}

function toggleNotebookFolder(nodeId, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  toggleNodeExpanded(nodeId);
  notesRenderSidebar();
}

function selectNotebookFolder(folderId) {
  const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content.hidden:not(.hidden)');
  if (pane1) setSessionParam('studySidebarScroll', pane1.scrollTop);

  activeNotebookFolderId = folderId;
  activeNotebookId = null;
  setSessionParam('activeNotebook', null);
  setSessionParam('studyOpenCat', folderId);

  notesRenderSidebar();
  notesRenderDetail();
}

// Filtered version called by the shared Training Grounds search bar
function notesRenderSidebarFiltered() {
  notesRenderSidebar();
  notesRenderDetail();
}

function notesSelectNotebook(id) {
  const searchInput = document.getElementById('snippet-search');
  const wasSearching = searchInput && searchInput.value.trim() !== '';

  if (wasSearching) {
    // Clear search
    searchInput.value = '';

    const nb = (state.notebooks || []).find(n => n.id === id);
    if (nb) {
      activeNotebookFolderId = nb.parentId || null;
      setSessionParam('studyOpenCat', activeNotebookFolderId);

      // Expand tree
      if (activeNotebookFolderId) {
        let curr = state.nodes.find(n => n.id === activeNotebookFolderId);
        while (curr) {
          if (!state.expandedNodes) state.expandedNodes = [];
          if (!state.expandedNodes.includes(curr.id)) {
            state.expandedNodes.push(curr.id);
          }
          curr = state.nodes.find(n => n.id === curr.parentId);
        }
      }
    }
  }

  activeNotebookId = id;
  notesRenderSidebar(); // Update active class
  
  if (wasSearching) {
    // Scroll to detail view
    setTimeout(() => {
      const detailHeader = document.querySelector('h1');
      if (detailHeader) {
        detailHeader.classList.add('pulse-highlight');
        setTimeout(() => detailHeader.classList.remove('pulse-highlight'), 2000);
      }
    }, 100);
  }

  notesRenderDetail();

  if (window.innerWidth <= 768) {
    document.querySelector('.messenger-pane-1').style.display = 'none';
    document.querySelector('.messenger-pane-2').style.display = 'flex';
  }
}

function notesRenderDetail() {
  const container = document.getElementById('notes-detail-container');
  const emptyState = document.getElementById('notes-empty-state');
  const sectionsArea = document.getElementById('notes-sections-area');

  if (!container || !emptyState || !sectionsArea) return;

  if (!activeNotebookId) {
    sectionsArea.innerHTML = '';
    if (activeNotebookFolderId) {
      emptyState.classList.add('hidden');
      renderNotebookFolderOverview(sectionsArea);
    } else {
      emptyState.classList.remove('hidden');
    }
    return;
  }

  const nb = (state?.notebooks ?? []).find(n => n.id === activeNotebookId);
  if (!nb) {
    activeNotebookId = null;
    notesRenderDetail();
    return;
  }

  emptyState.classList.add('hidden');

  const tagsHtml = (nb.tags || []).map(t => `<span class="tag">${escapeHTML(t)}</span>`).join('');

  const totalQs = (nb.sections || []).reduce((sum, sec) => sum + (sec.questions ? sec.questions.length : 0), 0);

  const isRoot = !nb.parentId;
  let breadcrumbHtml = `<nav class="breadcrumb-nav" style="margin-bottom: 1rem;">`;
  breadcrumbHtml += `<button class="breadcrumb-item" style="cursor:default;"><i data-lucide="home" style="width:12px;height:12px;"></i></button>`;
  
  if (isRoot) {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<span class="breadcrumb-current">Uncategorized</span>`;
  } else {
    const pathNodes = getBreadcrumbPath(nb.parentId);
    pathNodes.forEach((node, idx) => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      breadcrumbHtml += `<button class="breadcrumb-item" onclick="toggleNotebookFolder('${node.id}')">${escapeHTML(node.name)}</button>`;
    });
  }
  breadcrumbHtml += `</nav>`;

  let html = `
    <div class="animate-fade-in" style="max-width: 800px; margin: 0 auto;">
      ${breadcrumbHtml}
      <div style="display:flex; align-items:flex-start; gap:1.5rem; margin-bottom:2rem;">
        <div style="width:64px; height:64px; border-radius:var(--radius-md); background:var(--color-primary-subtle); color:var(--color-primary); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <i data-lucide="${nb.icon || 'book'}" style="width:32px; height:32px;"></i>
        </div>
        <div style="flex:1;">
          <h1 style="font-size:2rem; font-weight:800; margin-bottom:0.5rem; color:var(--text-primary);">${escapeHTML(nb.title)}</h1>
          <div style="display:flex; gap:1rem; color:var(--text-tertiary); font-size:0.875rem; margin-bottom:1rem;">
            <span style="display:flex; align-items:center; gap:0.25rem;"><i data-lucide="layers" style="width:14px;height:14px;"></i> ${(nb.sections || []).length} Sections</span>
            <span style="display:flex; align-items:center; gap:0.25rem;"><i data-lucide="help-circle" style="width:14px;height:14px;"></i> ${totalQs} Questions</span>
          </div>
          ${tagsHtml ? `<div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">${tagsHtml}</div>` : ''}
          <p style="color:var(--text-secondary); line-height:1.6;">${escapeHTML(nb.description || 'No description provided.')}</p>
        </div>
      </div>

      <div class="divider"></div>

      <div style="margin-bottom:2rem;">
        <h2 style="font-size:1.25rem; font-weight:700; margin-bottom:1rem;">Notebook Contents</h2>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          ${(nb.sections || []).length === 0 ? '<div class="empty-state">No sections in this notebook.</div>' : ''}
          ${(nb.sections || []).map((sec, idx) => `
            <div class="card-flat" style="padding:1rem; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; color:var(--text-primary); margin-bottom:0.25rem;">${escapeHTML(sec.label)}</div>
                <div style="font-size:0.8125rem; color:var(--text-tertiary);">
                  ${(sec.questions || []).length} Questions · ${sec.choices} Choices (A-${String.fromCharCode(64 + sec.choices)})
                </div>
              </div>
              <div style="font-weight:800; color:var(--text-tertiary); font-size:1.5rem; opacity:0.3;">
                ${String(idx + 1).padStart(2, '0')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap: 1rem;">
        <button class="btn btn-secondary btn-lg" onclick="shareNotebook('${nb.id}')">
          <i data-lucide="share-2" style="width:20px;height:20px;"></i> Share
        </button>
        <button class="btn btn-primary btn-lg" onclick="notesStartAttempt()" ${(nb.sections || []).length === 0 ? 'disabled' : ''}>
          <i data-lucide="play-circle" style="width:20px;height:20px;"></i> Start Attempt
        </button>
      </div>
    </div>
  `;

  sectionsArea.innerHTML = html;
  lucide.createIcons();
}

function notesStartAttempt() {
  if (!activeNotebookId) return;
  const nb = state.notebooks.find(n => n.id === activeNotebookId);
  if (!nb || !nb.sections || nb.sections.length === 0) {
    showMessage("No Sections", "This notebook has no sections configured. Add sections in the Admin panel first.", true);
    return;
  }

  // Use the study.html's existing timer modal — repurpose it for notebooks
  const variantSelect = document.getElementById('timer-variant-select');
  if (variantSelect) {
    // Replace variant select with a simple minutes input for notebook timer
    variantSelect.closest('div').style.display = 'none';
  }

  const timerModal = document.getElementById('timer-modal');
  if (!timerModal) {
    // Fallback: prompt inline
    const mins = parseInt(prompt('Set a time limit in minutes (0 for untimed):', '0')) || 0;
    setSessionParam('activeNotebook', activeNotebookId);
    setSessionParam('notebookTimeLimit', mins);
    window.location.href = 'notes-practice.html';
    return;
  }

  // Update modal title and description for notebook context
  const modalTitle = timerModal.querySelector('.modal-title');
  const modalDesc = timerModal.querySelector('.modal-desc');
  if (modalTitle) modalTitle.textContent = 'Start Notebook Session';
  if (modalDesc) modalDesc.textContent = 'Set an optional time limit in minutes (0 for untimed).';

  document.getElementById('timer-h').value = '0';
  document.getElementById('timer-m').value = '0';
  document.getElementById('timer-s').value = '0';

  // Swap the confirm button action
  const confirmBtn = timerModal.querySelector('button[onclick="confirmStartPractice()"]');
  if (confirmBtn) confirmBtn.setAttribute('onclick', 'notesConfirmStart()');

  timerModal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function notesConfirmStart() {
  const h = parseInt(document.getElementById('timer-h').value) || 0;
  const m = parseInt(document.getElementById('timer-m').value) || 0;
  const s = parseInt(document.getElementById('timer-s').value) || 0;
  const totalSeconds = (h * 3600) + (m * 60) + s;

  const timerModal = document.getElementById('timer-modal');
  if (timerModal) {
    timerModal.classList.add('hidden');
    // Restore the variant select visibility and confirm button
    const variantSelect = document.getElementById('timer-variant-select');
    if (variantSelect) variantSelect.closest('div').style.display = '';
    const confirmBtn = timerModal.querySelector('button[onclick="notesConfirmStart()"]');
    if (confirmBtn) confirmBtn.setAttribute('onclick', 'confirmStartPractice()');
    const modalTitle = timerModal.querySelector('.modal-title');
    if (modalTitle) modalTitle.textContent = 'Session Setup';
    const modalDesc = timerModal.querySelector('.modal-desc');
    if (modalDesc) modalDesc.textContent = 'Select a version and set an optional time limit.';
  }

  setSessionParam('activeNotebook', activeNotebookId);
  setSessionParam('notebookTimeLimit', totalSeconds);
  window.location.href = 'notes-practice.html';
}

function renderNotebookFolderOverview(container) {
  const searchInput = document.getElementById('snippet-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const isRoot = activeNotebookFolderId === '__root__';
  const folder = isRoot ? null : state.nodes.find(n => n.id === activeNotebookFolderId);

  let breadcrumbHtml = `<nav class="breadcrumb-nav" style="margin-bottom: 1.5rem;">`;
  breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectNotebookFolder('__root__')"><i data-lucide="home" style="width:12px;height:12px;"></i></button>`;
  
  if (isRoot) {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<span class="breadcrumb-current">Uncategorized</span>`;
  } else if (folder) {
    const pathNodes = getBreadcrumbPath(folder.id);
    pathNodes.forEach((node, idx) => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      if (idx < pathNodes.length - 1) {
        breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectNotebookFolder('${node.id}')">${escapeHTML(node.name)}</button>`;
      } else {
        breadcrumbHtml += `<span class="breadcrumb-current">${escapeHTML(node.name)}</span>`;
      }
    });
  }
  breadcrumbHtml += `</nav>`;

  const folderId = isRoot ? null : activeNotebookFolderId;
  let notebooks = [];
  let childFolders = [];

  if (query) {
    notebooks = (state.notebooks || []).filter(nb => fuzzyMatch(nb.title, query) || (nb.tags || []).some(t => fuzzyMatch(t, query)));
  } else {
    notebooks = (state.notebooks || []).filter(nb => nb.parentId === folderId);
    childFolders = isRoot ? [] : getChildFolders(activeNotebookFolderId, 'notebook');
  }

  let subfoldersHtml = '';
  if (childFolders.length > 0) {
    subfoldersHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">`;
    childFolders.forEach(sf => {
      const sfCount = countItemsRecursive(sf.id, 'notebook');
      subfoldersHtml += `
        <div class="subfolder-card" onclick="selectNotebookFolder('${sf.id}'); toggleNodeExpanded('${sf.id}');">
          <div style="display:flex; align-items:center; gap:0.5rem; font-weight: 600;">
            <i data-lucide="${sf.icon || 'folder'}" style="color:var(--color-primary); width: 18px; height: 18px;"></i>
            ${escapeHTML(sf.name)}
          </div>
          <span style="font-size: 0.8rem; color: var(--text-tertiary);">${sfCount} item${sfCount !== 1 ? 's' : ''}</span>
        </div>
      `;
    });
    subfoldersHtml += `</div>`;
  }

  let folderName = isRoot ? 'Uncategorized' : (folder ? folder.name : 'Library');

  if (query) {
    breadcrumbHtml = `<nav class="breadcrumb-nav"><span class="breadcrumb-current">Search Results for "${escapeHTML(query)}"</span></nav>`;
    folderName = `Search Results`;
  }

  if (notebooks.length === 0 && childFolders.length === 0) {
    container.innerHTML = breadcrumbHtml + `
      <div class="empty-state" style="height: 60%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i>
        <h2>No notebooks found</h2>
        <p style="font-size: 0.875rem; margin-top: 0.5rem; color: var(--text-tertiary);">
          ${query ? `No results for "${escapeHTML(query)}"` : `No notebooks available in ${escapeHTML(folderName)}.`}
        </p>
      </div>`;
  } else {
    const hideSubfolders = getSessionParam('hideSubfolders') === 'true';

    container.innerHTML = breadcrumbHtml + `
      <div class="animate-fade-in">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
          <div>
              <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary);">${escapeHTML(folderName)}</h2>
              <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">Select a notebook below to begin.</p>
          </div>
          <div>
              <button class="btn btn-ghost" onclick="showConfirm('Toggle Visibility', 'Are you sure you want to ' + (${hideSubfolders} ? 'show' : 'hide') + ' subfolders?', () => { setSessionParam('hideSubfolders', '${!hideSubfolders}'); notesRenderDetail(); })" title="Toggle Subfolders" style="padding: 0.5rem;">
                  <i data-lucide="${hideSubfolders ? 'eye-off' : 'eye'}"></i>
              </button>
          </div>
      </div>
      ${hideSubfolders ? '' : subfoldersHtml}
      ${notebooks.length > 0 ? `
        <div class="card-grid stagger-children">
          ${notebooks.map(nb => {
            const tHtml = (nb.tags || []).map(t => `<span class="badge badge-primary">${escapeHTML(t)}</span>`).join('');
            return `
              <div class="card" onclick="notesSelectNotebook('${nb.id}')" style="cursor: pointer;">
                <h3 style="font-weight:700; font-size:1.1rem; color:var(--text-primary); margin-bottom:0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                  <i data-lucide="${nb.icon || 'book'}" style="width: 18px; height: 18px; color: var(--color-primary);"></i>
                  ${escapeHTML(nb.title)}
                </h3>
                <div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-bottom:0.75rem;">
                  ${tHtml}
                </div>
                <div style="font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                  ${(nb.sections || []).length} Section${(nb.sections || []).length !== 1 ? 's' : ''}
                </div>
                <div style="margin-top:auto; display:flex; justify-content: flex-end;">
                  <button class="btn btn-ghost" title="Share Link" onclick="event.stopPropagation(); shareNotebook('${nb.id}')" style="padding:0.5rem;">
                    <i data-lucide="share-2" style="width:16px;height:16px;"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
      </div>
    `;
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}


// ============================================================
// NOTEBOOK SHARING
// ============================================================

function shareNotebook(notebookId) {
  const notebook = state.notebooks.find(n => n.id === notebookId);
  if (!notebook) return;

  const shareable = {
    _type: 'notebook',
    title: notebook.title,
    tags: notebook.tags || [],
    description: notebook.description || '',
    icon: notebook.icon || 'book',
    sections: (notebook.sections || []).map(s => ({
      ...s,
      id: s.id || generateId()
    }))
  };

  const encoded = encodeShareData(shareable);
  if (!encoded) {
    if (typeof showMessage === 'function') showMessage('Error', 'Failed to encode notebook for sharing.', true);
    return;
  }

  const url = window.location.origin + window.location.pathname + '?data=' + encoded;

  navigator.clipboard.writeText(url).then(() => {
    if (typeof showShareToast === 'function') showShareToast('Notebook link copied!');
    else if (typeof showMessage === 'function') showMessage('Shared', 'Link copied to clipboard!');
  }).catch(() => {
    prompt('Copy this share link:', url);
  });
}

function checkSharedNotebook() {
  const params = new URLSearchParams(window.location.search);
  const dataParam = params.get('data');
  if (!dataParam) return;

  const shared = decodeShareData(dataParam);
  if (!shared || shared._type !== 'notebook') return;

  window.history.replaceState({}, document.title, window.location.pathname);

  const tempId = 'shared_notebook_' + Date.now();
  const tempNotebook = {
    id: tempId,
    title: '[Shared] ' + (shared.title || 'Notebook'),
    tags: shared.tags || [],
    description: shared.description || '',
    icon: shared.icon || 'book',
    parentId: null,
    sections: (shared.sections || []).map(sec => ({
      ...sec,
      id: sec.id || generateId()
    }))
  };

  if (!state.notebooks) state.notebooks = [];
  state.notebooks.unshift(tempNotebook);
  saveData();

  setTimeout(() => {
    // Switch to notes tab if in study.html
    const notesTabBtn = document.getElementById('training-tab-notes');
    if (notesTabBtn) notesTabBtn.click();
    
    // Select the notebook
    notesSelectNotebook(tempId);
  }, 300);
}

// ============================================================
// NOTEBOOK CONTEXT MENU 
// ============================================================

function showNotebookCtxMenu(e, nodeId) {
  notebookCtxTargetNodeId = nodeId;
  const menu = document.getElementById('notebook-context-menu');
  if (!menu) return;

  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.classList.remove('hidden');

  const isRoot = nodeId === null;

  const newFolderBtn = document.getElementById('nctx-new-folder');
  const renameBtn = document.getElementById('nctx-rename');
  const moveBtn = document.getElementById('nctx-move');
  const deleteBtn = document.getElementById('nctx-delete');

  if (isRoot) {
    if (newFolderBtn) newFolderBtn.innerHTML = `<i data-lucide="folder-plus"></i> New Root Folder`;
    if (renameBtn) renameBtn.style.display = 'none';
    if (moveBtn) moveBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
  } else {
    if (newFolderBtn) newFolderBtn.innerHTML = `<i data-lucide="folder-plus"></i> New Subfolder`;
    if (renameBtn) renameBtn.style.display = '';
    if (moveBtn) moveBtn.style.display = '';
    if (deleteBtn) deleteBtn.style.display = '';
  }

  // Event handler attachments mapping directly to the UI elements
  if (newFolderBtn) newFolderBtn.onclick = notebookCtxNewFolder;
  if (renameBtn) renameBtn.onclick = notebookCtxRename;
  if (moveBtn) moveBtn.onclick = notebookCtxMove;
  if (deleteBtn) deleteBtn.onclick = notebookCtxDelete;

  if (typeof lucide !== 'undefined') lucide.createIcons();
  setTimeout(() => {
    document.addEventListener('click', closeNotebookCtxMenu, { once: true });
  }, 10);
}

function closeNotebookCtxMenu() {
  const menu = document.getElementById('notebook-context-menu');
  if (menu) {
    menu.classList.add('hidden');
  }
}

function notebookCtxNewFolder() {
  closeNotebookCtxMenu();
  const name = prompt('Enter folder name:');
  if (!name || !name.trim()) return;

  createNode(name.trim(), 'folder', notebookCtxTargetNodeId, 'notebook');

  if (notebookCtxTargetNodeId && !isNodeExpanded(notebookCtxTargetNodeId)) {
    toggleNodeExpanded(notebookCtxTargetNodeId);
  }

  saveData();
  notesRenderSidebar(); // Refresh the notebook list
}

function notebookCtxRename() {
  closeNotebookCtxMenu();
  if (!notebookCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === notebookCtxTargetNodeId);
  if (!folder) return;

  const newName = prompt('Rename folder:', folder.name);
  if (!newName || !newName.trim() || newName.trim() === folder.name) return;

  renameNode(notebookCtxTargetNodeId, newName.trim());
  notesRenderSidebar();
}

function notebookCtxDelete() {
  closeNotebookCtxMenu();
  if (!notebookCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === notebookCtxTargetNodeId);
  if (!folder) return;

  if (typeof showConfirm === 'function') {
    showConfirm('Delete Folder', `Delete "${escapeHTML(folder.name)}" and all subfolders? Items will become uncategorized.`, () => {
      deleteNode(notebookCtxTargetNodeId);
      notesRenderSidebar();
    });
  } else {
    if (!confirm(`Delete "${folder.name}" and all subfolders?`)) return;
    deleteNode(notebookCtxTargetNodeId);
    notesRenderSidebar();
  }
}

function notebookCtxMove() {
  closeNotebookCtxMenu();
  if (!notebookCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === notebookCtxTargetNodeId);
  if (!folder) return;

  const validFolders = state.nodes.filter(n =>
    n.type === 'folder' && n.scope === 'notebook' && n.id !== notebookCtxTargetNodeId && !isDescendantOf(n.id, notebookCtxTargetNodeId)
  );

  let promptMsg = `Where do you want to move "${folder.name}"?\n\n[0] (Move to Root)\n`;
  validFolders.forEach((f, idx) => { 
    const path = getBreadcrumbPath(f.id).map(n => n.name).join(' > ');
    promptMsg += `[${idx + 1}] ${path}\n`; 
  });

  const selection = prompt(promptMsg, "0");
  if (selection === null) return;

  const selIndex = parseInt(selection);
  if (isNaN(selIndex) || selIndex < 0 || selIndex > validFolders.length) return;
  folder.parentId = selIndex === 0 ? null : validFolders[selIndex - 1].id;
  saveData();
  notesRenderSidebar();
}

async function notebookCtxChangeIcon() {
  closeNotebookCtxMenu();
  if (!notebookCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === notebookCtxTargetNodeId);
  if (!folder) return;

  const currentIcon = folder.icon || 'folder';
  const newIcon = await openIconPicker(currentIcon);
  if (!newIcon || !newIcon.trim() || newIcon.trim() === currentIcon) return;

  folder.icon = newIcon.trim();
  saveData();
  notesRenderSidebar();
}