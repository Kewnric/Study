/* ============================================================
   BROWSE.JS — Browse View Rendering (Recursive Tree + Dual-Pane)
   ============================================================ */

let browseActiveNodeId = getSessionParam('browseActiveNode') || null;
let ctxTargetNodeId = null; // For context menu
let _browseContainerCtxHandler = null; // Named reference for removing duplicate listeners

function navigateToFolderAndFocus(parentId, itemId) {
  // Clear search
  const searchInput = document.getElementById('browse-search');
  if (searchInput) searchInput.value = '';

  window.disableNextStagger = true;

  // Select folder
  selectBrowseNode(parentId === '__root__' ? null : parentId);

  // Expand parent folders to ensure it is visible in the tree
  if (parentId && parentId !== '__root__') {
    let curr = state.nodes.find(n => n.id === parentId);
    while (curr) {
      if (!state.expandedNodes) state.expandedNodes = [];
      if (!state.expandedNodes.includes(curr.id)) {
        state.expandedNodes.push(curr.id);
      }
      curr = state.nodes.find(n => n.id === curr.parentId);
    }
    saveData();
    renderBrowseTree();
  }

  // Scroll to card
  setTimeout(() => {
    const card = document.getElementById(`card-${itemId}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('pulse-highlight');
      setTimeout(() => card.classList.remove('pulse-highlight'), 2000);
    }
  }, 100);
}

// ============================================================
// TREE RENDERING (LEFT PANE)
// ============================================================

function getCompletedCount(folderId) {
  const catChallenges = state.challenges.filter(c => c.parentId === folderId);
  let completed = 0;
  catChallenges.forEach(c => {
    const logs = state.history.filter(h => h.challengeId === c.id);
    if (logs.some(l => l.score === 100)) completed++;
  });
  // Also count recursively into child folders
  getChildFolders(folderId, 'challenge').forEach(child => {
    completed += getCompletedCount(child.id);
  });
  return completed;
}

function selectBrowseNode(nodeId) {
  browseActiveNodeId = nodeId;
  setSessionParam('browseActiveNode', nodeId);
  setSessionParam('browseScroll', 0);
  renderBrowse();
}

function toggleBrowseExpand(nodeId, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  toggleNodeExpanded(nodeId);
  renderBrowseTree();
}

function renderBrowse() {
  renderBrowseTree();
  renderBrowseContent();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderBrowseTree() {
  const container = document.getElementById('browse-category-list');
  if (!container) return;

  const searchInput = document.getElementById('browse-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  // Build tree HTML recursively
  let html = renderTreeRecursive(null, 'challenge', 0, query, browseActiveNodeId);

  // Also show root-level (orphaned) items count
  const rootOrphans = state.challenges.filter(c => c.parentId === null || c.parentId === undefined);
  if (rootOrphans.length > 0 || state.nodes.filter(n => n.scope === 'challenge').length === 0) {
    const isActive = browseActiveNodeId === '__root__';
    const count = rootOrphans.length;
    if (count > 0 || !html) {
      html += `
        <div class="tree-node" data-level="0">
          <div class="tree-node-row ${isActive ? 'active' : ''}" onclick="selectBrowseNode('__root__')">
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
    html = `<div class="empty-state" style="padding: 2rem;">
      <p style="color:var(--text-tertiary); font-size:0.875rem;">No folders. Right-click to create one.</p>
    </div>`;
  }

  container.innerHTML = html;

  // Attach right-click context to all tree rows
  container.querySelectorAll('.tree-node-row[data-node-id]').forEach(row => {
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTreeContextMenu(e, row.getAttribute('data-node-id'));
    });
  });

  // Allow right-click on empty area to create root folder
  if (_browseContainerCtxHandler) {
    container.removeEventListener('contextmenu', _browseContainerCtxHandler);
  }
  _browseContainerCtxHandler = (e) => {
    if (e.target === container || e.target.closest('.empty-state')) {
      e.preventDefault();
      showTreeContextMenu(e, null); // null = root level
    }
  };
  container.addEventListener('contextmenu', _browseContainerCtxHandler);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderTreeRecursive(parentId, scope, depth, query, activeId) {
  const folders = getChildFolders(parentId, scope);
  let html = '';

  folders.forEach(folder => {
    const totalItems = countItemsRecursive(folder.id, scope);
    const hasChildren = getChildFolders(folder.id, scope).length > 0;
    const expanded = isNodeExpanded(folder.id);
    const isActive = activeId === folder.id;

    // If searching, skip folders with no matching items
    if (query) {
      const hasMatch = folderHasMatchingItems(folder.id, scope, query);
      if (!hasMatch) return;
    }

    // Lock status
    let lockIcon = '';
    const req = state.categoryRequirements ? state.categoryRequirements[folder.id] : null;
    if (req && req.reqNodeId) {
      const completed = getCompletedCount(req.reqNodeId);
      if (completed < req.count) {
        lockIcon = `<i data-lucide="lock" class="tree-node-lock"></i>`;
      }
    }

    const chevronClass = hasChildren || totalItems > 0 ? (expanded ? 'expanded' : '') : 'invisible';
    const indent = depth * 0.75;

    html += `
      <div class="tree-node" data-level="${depth}">
        <div class="tree-node-row ${isActive ? 'active' : ''}" 
             data-node-id="${folder.id}"
             style="padding-left: calc(0.75rem + ${indent}rem)"
             onclick="selectBrowseNode('${folder.id}')">
          <i data-lucide="chevron-right" 
             class="tree-node-chevron ${chevronClass}"
             onclick="toggleBrowseExpand('${folder.id}', event)"></i>
          <i data-lucide="${folder.icon || 'folder'}" class="tree-node-icon folder-icon-color"></i>
          <span class="tree-node-label">${escapeHTML(folder.name)}</span>
          ${lockIcon}
          <span class="tree-node-badge">${totalItems}</span>
        </div>
        <div class="tree-children ${expanded ? '' : 'collapsed'}">
          <div class="tree-children-inner">
            ${renderTreeRecursive(folder.id, scope, depth + 1, query, activeId)}
          </div>
        </div>
      </div>
    `;
  });

  return html;
}

function folderHasMatchingItems(folderId, scope, query) {
  // Check direct items
  const items = getItemsInFolder(folderId, scope);
  const hasDirectMatch = items.some(item =>
    fuzzyMatch(item.title, query) || (item.tags || []).some(t => fuzzyMatch(t, query))
  );
  if (hasDirectMatch) return true;

  // Check child folders recursively
  const childFolders = getChildFolders(folderId, scope);
  return childFolders.some(cf => folderHasMatchingItems(cf.id, scope, query));
}

// ============================================================
// CONTENT RENDERING (RIGHT PANE)
// ============================================================

function renderBrowseContent() {
  const container = document.getElementById('browse-challenges-container');
  if (!container) return;

  const searchInput = document.getElementById('browse-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (!browseActiveNodeId) {
    container.innerHTML = `
      <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i>
        <h2>Select a folder</h2>
        <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose a folder from the left pane to view its programs.</p>
      </div>`;
    return;
  }

  // Get folder info for breadcrumbs
  const isRoot = browseActiveNodeId === '__root__';
  const currentFolder = isRoot ? null : state.nodes.find(n => n.id === browseActiveNodeId);

  // Breadcrumbs
  let breadcrumbHtml = `<nav class="breadcrumb-nav">`;
  breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectBrowseNode(null)">
    <i data-lucide="home" style="width:12px;height:12px;"></i>
  </button>`;

  if (isRoot) {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<span class="breadcrumb-current">Uncategorized</span>`;
  } else if (currentFolder) {
    const path = getBreadcrumbPath(browseActiveNodeId);
    path.forEach((node, idx) => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      if (idx < path.length - 1) {
        breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectBrowseNode('${node.id}')">${escapeHTML(node.name)}</button>`;
      } else {
        breadcrumbHtml += `<span class="breadcrumb-current">${escapeHTML(node.name)}</span>`;
      }
    });
  }
  breadcrumbHtml += `</nav>`;

  // Check lock status
  let isLocked = false;
  let lockMessage = '';
  if (!isRoot && currentFolder) {
    const req = state.categoryRequirements ? state.categoryRequirements[currentFolder.id] : null;
    if (req && req.reqNodeId) {
      const completed = getCompletedCount(req.reqNodeId);
      if (completed < req.count) {
        isLocked = true;
        const reqFolder = state.nodes.find(n => n.id === req.reqNodeId);
        const reqName = reqFolder ? reqFolder.name : req.reqCat || 'Unknown';
        lockMessage = `Requires ${req.count} completed program(s) in "${escapeHTML(reqName)}" (Currently: ${completed})`;
      }
    }
  }

  if (isLocked) {
    container.innerHTML = breadcrumbHtml + `
      <div class="empty-state" style="height: 80%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <i data-lucide="lock" style="width: 48px; height: 48px; color: var(--color-warning); margin-bottom: 1rem;"></i>
        <h2 style="color: var(--color-warning);">Folder Locked</h2>
        <p style="font-size: 0.875rem; margin-top: 0.5rem; color: var(--text-tertiary);">${lockMessage}</p>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Apply search filter globally if query exists
  let challenges = [];
  let childFolders = [];

  if (query) {
    challenges = state.challenges.filter(c =>
      fuzzyMatch(c.title, query) || (c.tags || []).some(t => fuzzyMatch(t, query))
    );
  } else {
    const folderId = isRoot ? null : browseActiveNodeId;
    challenges = state.challenges.filter(c => c.parentId === folderId);
    childFolders = isRoot ? [] : getChildFolders(browseActiveNodeId, 'challenge');
  }

  // Subfolders cards
  let subfoldersHtml = '';
  if (childFolders.length > 0) {
    subfoldersHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">`;
    childFolders.forEach(sf => {
      const sfCount = countItemsRecursive(sf.id, 'challenge');
      subfoldersHtml += `
        <div class="subfolder-card" onclick="selectBrowseNode('${sf.id}'); toggleNodeExpanded('${sf.id}');">
          <i data-lucide="folder"></i>
          <span class="subfolder-card-label">${escapeHTML(sf.name)}</span>
          <span class="subfolder-card-count">${sfCount} item${sfCount !== 1 ? 's' : ''}</span>
        </div>
      `;
    });
    subfoldersHtml += `</div>`;
  }

  let folderName = isRoot ? 'Uncategorized' : (currentFolder ? currentFolder.name : 'Library');

  if (query) {
    breadcrumbHtml = `<nav class="breadcrumb-nav"><span class="breadcrumb-current">Search Results for "${escapeHTML(query)}"</span></nav>`;
    folderName = `Search Results`;
  }

  if (challenges.length === 0 && childFolders.length === 0) {
    container.innerHTML = breadcrumbHtml + `
      <div class="empty-state" style="height: 80%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i>
        <h2>No programs found</h2>
        <p style="font-size: 0.875rem; margin-top: 0.5rem;">
          ${query ? `No results for "${escapeHTML(query)}"` : `No programs available in ${escapeHTML(folderName)}.`}
        </p>
      </div>`;
  } else {
    const hideSubfolders = getSessionParam('hideSubfolders') === 'true';

    container.innerHTML = breadcrumbHtml + `
      <div class="animate-fade-in">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
            <div>
                <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary);">${escapeHTML(folderName)}</h2>
                <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">Select a program below to start practicing.</p>
            </div>
            <div>
              <button class="btn btn-ghost" onclick="showConfirm('Toggle Visibility', 'Are you sure you want to ' + (${hideSubfolders} ? 'show' : 'hide') + ' subfolders?', () => { setSessionParam('hideSubfolders', '${!hideSubfolders}'); renderBrowseContent(); })" title="Toggle Subfolders" style="padding: 0.5rem;">
                  <i data-lucide="${hideSubfolders ? 'eye-off' : 'eye'}"></i>
              </button>
          </div>
        </div>
        ${hideSubfolders ? '' : subfoldersHtml}
        ${challenges.length > 0 ? `
        <div class="card-grid ${window.disableNextStagger ? '' : 'stagger-children'}">
          ${challenges.map(c => {
      const vCount = c.variants.length;
      const attemptsCount = state.history.filter(h => h.challengeId === c.id).length;
      return `
              <div class="card" id="card-${c.id}" ${query ? `onclick="navigateToFolderAndFocus('${c.parentId || '__root__'}', '${c.id}')" style="cursor: pointer;"` : ''}>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                  <h3 style="font-weight:700; font-size:1.1rem; color:var(--text-primary);">${escapeHTML(c.title)}</h3>
                  <span class="version-pill">${vCount} version${vCount !== 1 ? 's' : ''}</span>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-bottom:0.75rem;">
                  <span class="badge badge-neutral"><i data-lucide="rotate-ccw" style="width:12px;height:12px;margin-right:2px;"></i> ${attemptsCount} Attempt${attemptsCount !== 1 ? 's' : ''}</span>
                  ${(c.tags || []).map(t => `<span class="badge badge-primary">${escapeHTML(t)}</span>`).join('')}
                </div>
                <p class="line-clamp-2" style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:1rem; min-height:2.5rem;">
                  ${escapeHTML(c.coverDescription || c.variants[0]?.description || 'No description.')}
                </p>
                <div style="margin-top:auto; display:flex; gap:0.5rem;">
                  <button onclick="event.stopPropagation(); promptTimer('${c.id}')" class="btn btn-practice" id="practice-btn-${c.id}" style="flex:1;">
                    <i data-lucide="play" style="width:16px;height:16px;fill:currentColor;"></i> Practice
                  </button>
                  <button onclick="event.stopPropagation(); shareChallenge('${c.id}')" class="btn btn-ghost" title="Share Link" style="padding:0.5rem;">
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

  // Restore scroll
  setTimeout(() => {
    const pane2 = document.querySelector('.messenger-pane-2');
    if (pane2) pane2.scrollTop = getSessionParam('browseScroll') || 0;
  }, 50);

  if (typeof lucide !== 'undefined') lucide.createIcons();
  window.disableNextStagger = false;
}

// ============================================================
// CONTEXT MENU
// ============================================================

function showTreeContextMenu(e, nodeId) {
  ctxTargetNodeId = nodeId;
  const menu = document.getElementById('tree-context-menu');
  if (!menu) return;

  // Position menu
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.classList.remove('hidden');

  // Adjust menu label based on context
  const isRoot = nodeId === null;
  const newFolderBtn = document.getElementById('ctx-new-folder');
  const renameBtn = document.getElementById('ctx-rename');
  const moveBtn = document.getElementById('ctx-move');
  const deleteBtn = document.getElementById('ctx-delete');

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

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Close menu on outside click
  setTimeout(() => {
    document.addEventListener('click', closeTreeContextMenu, { once: true });
  }, 10);
}

function closeTreeContextMenu() {
  const menu = document.getElementById('tree-context-menu');
  if (menu) menu.classList.add('hidden');
}

function ctxNewFolder() {
  closeTreeContextMenu();
  const name = prompt('Enter folder name:');
  if (!name || !name.trim()) return;

  // Determine scope from parent
  let scope = 'challenge'; // default for browse page
  if (ctxTargetNodeId) {
    const parent = state.nodes.find(n => n.id === ctxTargetNodeId);
    if (parent) scope = parent.scope;
  }

  const node = createNode(name.trim(), 'folder', ctxTargetNodeId, scope);

  // Auto-expand parent
  if (ctxTargetNodeId && !isNodeExpanded(ctxTargetNodeId)) {
    toggleNodeExpanded(ctxTargetNodeId);
  }

  renderBrowse();
}

function ctxRenameFolder() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === ctxTargetNodeId);
  if (!folder) return;

  const newName = prompt('Rename folder:', folder.name);
  if (!newName || !newName.trim() || newName.trim() === folder.name) return;

  renameNode(ctxTargetNodeId, newName.trim());
  renderBrowse();
}

function ctxMoveFolder() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === ctxTargetNodeId);
  if (!folder) return;

  // Build a list of valid targets (folders in same scope, excluding self and descendants)
  const validTargets = state.nodes.filter(n =>
    n.type === 'folder' &&
    n.scope === folder.scope &&
    n.id !== ctxTargetNodeId &&
    !isDescendantOf(n.id, ctxTargetNodeId)
  );

  let options = 'Enter target folder number:\n0 — Root (no parent)\n';
  validTargets.forEach((t, i) => {
    const path = getBreadcrumbPath(t.id).map(n => n.name).join(' > ');
    options += `${i + 1} — ${path}\n`;
  });

  const choice = prompt(options);
  if (choice === null) return;
  const idx = parseInt(choice);
  if (isNaN(idx)) return;

  if (idx === 0) {
    moveNode(ctxTargetNodeId, null);
  } else if (idx > 0 && idx <= validTargets.length) {
    moveNode(ctxTargetNodeId, validTargets[idx - 1].id);
  }

  renderBrowse();
}

function ctxDeleteFolder() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === ctxTargetNodeId);
  if (!folder) return;

  if (typeof showConfirm === 'function') {
    showConfirm("Delete Folder", `Delete "${escapeHTML(folder.name)}" and all subfolders? Items will become uncategorized.`, () => {
      if (browseActiveNodeId === ctxTargetNodeId) browseActiveNodeId = null;
      deleteNode(ctxTargetNodeId);
      renderBrowse();
    });
  } else {
    if (!confirm(`Delete "${folder.name}" and all subfolders? Items will become uncategorized.`)) return;
    if (browseActiveNodeId === ctxTargetNodeId) browseActiveNodeId = null;
    deleteNode(ctxTargetNodeId);
    renderBrowse();
  }
}

async function ctxChangeIcon() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === ctxTargetNodeId);
  if (!folder) return;

  const currentIcon = folder.icon || 'folder';
  const newIcon = await openIconPicker(currentIcon);
  if (!newIcon || !newIcon.trim() || newIcon.trim() === currentIcon) return;

  folder.icon = newIcon.trim();
  saveData();
  renderBrowse();
}

// ============================================================
// TIMER MODAL LOGIC
// ============================================================
function promptTimer(challengeId) {
  const pane2 = document.querySelector('.messenger-pane-2');
  if (pane2) setSessionParam('browseScroll', pane2.scrollTop);

  pendingChallengeId = challengeId;
  const challenge = state.challenges.find(c => c.id === challengeId);

  const variantSelect = document.getElementById('timer-variant-select');
  variantSelect.innerHTML = challenge.variants.map(v =>
    `<option value="${v.id}">${escapeHTML(v.name)}</option>`
  ).join('');

  document.getElementById('timer-h').value = '0';
  document.getElementById('timer-m').value = '0';
  document.getElementById('timer-s').value = '0';
  document.getElementById('timer-modal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeTimerModal() {
  document.getElementById('timer-modal').classList.add('hidden');
}

function confirmStartPractice() {
  const pane2 = document.querySelector('.messenger-pane-2');
  if (pane2) setSessionParam('browseScroll', pane2.scrollTop);

  const h = parseInt(document.getElementById('timer-h').value) || 0;
  const m = parseInt(document.getElementById('timer-m').value) || 0;
  const s = parseInt(document.getElementById('timer-s').value) || 0;
  const vId = document.getElementById('timer-variant-select').value;

  closeTimerModal();

  setSessionParam('practiceChallenge', pendingChallengeId);
  setSessionParam('practiceVariant', vId);
  setSessionParam('timeLimit', (h * 3600) + (m * 60) + s);

  window.location.href = 'practice.html';
}

// ============================================================
// SHAREABLE CHALLENGES (Workstream 4)
// ============================================================

function shareChallenge(challengeId) {
  const challenge = state.challenges.find(c => c.id === challengeId);
  if (!challenge) return;

  // Create a minimal shareable object (strip history-only fields)
  const shareable = {
    _type: 'challenge',
    title: challenge.title,
    tags: challenge.tags || [],
    coverDescription: challenge.coverDescription || '',
    variants: (challenge.variants || []).map(v => ({
      id: v.id,
      name: v.name,
      description: v.description || '',
      code: v.code || '',
      starterCode: v.starterCode || '',
      samples: v.samples || []
    }))
  };

  const encoded = encodeShareData(shareable);
  if (!encoded) {
    if (typeof showMessage === 'function') showMessage('Error', 'Failed to encode challenge for sharing.', true);
    return;
  }

  const url = window.location.origin + window.location.pathname + '?data=' + encoded;

  navigator.clipboard.writeText(url).then(() => {
    showShareToast('Link copied to clipboard!');
  }).catch(() => {
    // Fallback: prompt
    prompt('Copy this share link:', url);
  });
}

function showShareToast(message) {
  let toast = document.getElementById('share-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'share-toast';
    toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--color-primary);color:#fff;padding:0.75rem 1.5rem;border-radius:var(--radius-md);font-weight:600;font-size:0.875rem;z-index:9999;opacity:0;transition:opacity 0.3s ease;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

function checkSharedChallenge() {
  const params = new URLSearchParams(window.location.search);
  const dataParam = params.get('data');
  if (!dataParam) return;

  const shared = decodeShareData(dataParam);
  if (!shared || shared._type !== 'challenge') return;

  // Clean URL without reloading
  window.history.replaceState({}, document.title, window.location.pathname);

  // Inject as a temporary challenge
  const tempId = 'shared_' + Date.now();
  const tempChallenge = {
    id: tempId,
    title: '[Shared] ' + (shared.title || 'Challenge'),
    tags: shared.tags || [],
    coverDescription: shared.coverDescription || '',
    parentId: null,
    variants: (shared.variants || []).map(v => ({
      ...v,
      id: v.id || generateId()
    }))
  };

  // Add to state and persist so it carries over to practice.html
  state.challenges.unshift(tempChallenge);
  saveData();

  // Select the Uncategorized folder so the user can see the shared challenge
  setTimeout(() => {
    selectBrowseNode('__root__');
    setTimeout(() => {
      const card = document.getElementById('card-' + tempId);
      if (card) {
        card.style.boxShadow = '0 0 0 2px var(--color-primary)';
        card.style.transition = 'box-shadow 0.3s ease';
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, 300);
}