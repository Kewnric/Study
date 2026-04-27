/* ============================================================
   STUDY.JS — Training Grounds (Dual-Pane Layout)
   ============================================================ */

let activeSnippetId = null;
let activeSnippetFolderId = getSessionParam('studyOpenCat') || null;
let currentSnippetVariants = [];
let activeExampleIndex = 0;
let tryCodingTargetCodes = [];
let tryCodingTargetStarterCode = '';
let snippetCtxTargetNodeId = null;
let _snippetContainerCtxHandler = null;

// --- Tab Switching ---
function switchStudyTab(tabId, btnEl) {
  document.querySelectorAll('.study-tab').forEach(el => el.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const snippetList = document.getElementById('snippet-list-container');
  const snippetDetail = document.getElementById('snippet-detail-container');
  const notesSidebar = document.getElementById('notes-sidebar-container');
  const notesDetail = document.getElementById('notes-detail-container');
  const searchInput = document.getElementById('snippet-search');

  if (tabId === 'snippets') {
    snippetList.classList.remove('hidden');
    snippetList.classList.remove('animate-fade-in');
    void snippetList.offsetWidth;
    snippetList.classList.add('animate-fade-in');
    
    snippetDetail.classList.remove('hidden');
    snippetDetail.classList.remove('animate-fade-in');
    void snippetDetail.offsetWidth;
    snippetDetail.classList.add('animate-fade-in');
    
    if (notesSidebar) notesSidebar.classList.add('hidden');
    if (notesDetail) notesDetail.classList.add('hidden');
    if (searchInput) searchInput.placeholder = 'Search snippets...';
    renderSnippetList();
    if (activeSnippetId) renderSnippetDetail();
  } else if (tabId === 'notes') {
    snippetList.classList.add('hidden');
    snippetDetail.classList.add('hidden');
    if (notesSidebar) {
      notesSidebar.classList.remove('hidden');
      notesSidebar.classList.remove('animate-fade-in');
      void notesSidebar.offsetWidth;
      notesSidebar.classList.add('animate-fade-in');
    }
    if (notesDetail) {
      notesDetail.classList.remove('hidden');
      notesDetail.classList.remove('animate-fade-in');
      void notesDetail.offsetWidth;
      notesDetail.classList.add('animate-fade-in');
    }
    if (searchInput) searchInput.placeholder = 'Search notebooks...';
    if (typeof notesInit === 'function') notesInit();
  }
}

// Routes search to the correct renderer based on the active tab
function handleTrainingGroundsSearch() {
  const notesSidebar = document.getElementById('notes-sidebar-container');
  const isNotesTab = notesSidebar && !notesSidebar.classList.contains('hidden');
  if (isNotesTab) {
    if (typeof notesRenderSidebarFiltered === 'function') notesRenderSidebarFiltered();
  } else {
    renderSnippetList();
  }
}

// --- Snippet Manager ---
function renderStudyArea() {
  const targetTab = getSessionParam('studyTab') || 'notes';
  const targetNotebookId = getSessionParam('activeNotebook');
  const targetSnippetId = getSessionParam('activeSnippetId');

  if (targetTab === 'notes') {
    const notesTabBtn = document.getElementById('training-tab-notes');
    switchStudyTab('notes', notesTabBtn);
    if (targetNotebookId) {
      if (typeof notesSelectNotebook === 'function') {
        notesSelectNotebook(targetNotebookId);
      }
      clearSessionParam('activeNotebook');
      clearSessionParam('studyTab');
    }
  } else {
    renderSnippetList();
    if (targetSnippetId && (state.snippets || []).some(s => s.id === targetSnippetId)) {
      selectSnippet(targetSnippetId);
    }
  }
}

function renderSnippetList() {
  const container = document.getElementById('snippet-list-container');
  if (!container) return;

  const searchInput = document.getElementById('snippet-search');
  const query = searchInput ? searchInput.value.trim() : '';

  let html = renderSnippetTreeRecursive(null, 0, query);

  // Show root-level (orphaned) snippets count as Uncategorized
  const rootSnippets = (state.snippets || []).filter(s => s.parentId === null || s.parentId === undefined);
  let filteredRoot = rootSnippets;
  if (query) {
    filteredRoot = rootSnippets.filter(s =>
      fuzzyMatch(s.title, query) || (s.tags || []).some(t => fuzzyMatch(t, query))
    );
  }

  if (filteredRoot.length > 0 || state.nodes.filter(n => n.scope === 'snippet').length === 0) {
    const isActive = activeSnippetFolderId === '__root__';
    const count = filteredRoot.length;
    if (count > 0 || !html) {
      html += `
        <div class="tree-node" data-level="0">
          <div class="tree-node-row ${isActive ? 'active' : ''}" onclick="selectSnippetFolder('__root__')">
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

  // Attach right-click context to all tree rows
  container.querySelectorAll('.tree-node-row[data-node-id]').forEach(row => {
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showSnippetCtxMenu(e, row.getAttribute('data-node-id'));
    });
  });

  // Allow right-click on empty area to create root folder
  if (_snippetContainerCtxHandler) {
    container.removeEventListener('contextmenu', _snippetContainerCtxHandler);
  }
  _snippetContainerCtxHandler = (e) => {
    if (e.target === container || e.target.closest('.empty-state')) {
      e.preventDefault();
      showSnippetCtxMenu(e, null);
    }
  };
  container.addEventListener('contextmenu', _snippetContainerCtxHandler);

  // Restore Window 1 Scroll Position
  setTimeout(() => {
    const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content');
    if (pane1) pane1.scrollTop = getSessionParam('studySidebarScroll') || 0;
  }, 50);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSnippetTreeRecursive(parentId, depth, query) {
  const folders = getChildFolders(parentId, 'snippet');
  let html = '';

  folders.forEach(folder => {
    const totalItems = countItemsRecursive(folder.id, 'snippet');
    const hasChildren = getChildFolders(folder.id, 'snippet').length > 0;
    const expanded = isNodeExpanded(folder.id);
    const isActive = activeSnippetFolderId === folder.id;

    if (query) {
      const hasMatch = folderHasMatchingSnippets(folder.id, query);
      if (!hasMatch) return;
    }

    const indent = depth * 0.75;
    const chevronClass = (hasChildren || totalItems > 0) ? (expanded ? 'expanded' : '') : 'invisible';

    html += `
      <div class="tree-node" data-level="${depth}">
        <div class="tree-node-row ${isActive ? 'active' : ''}"
             data-node-id="${folder.id}"
             style="padding-left: calc(0.5rem + ${indent}rem)"
             onclick="selectSnippetFolder('${folder.id}')">
          <i data-lucide="chevron-right" class="tree-node-chevron ${chevronClass}" onclick="toggleSnippetFolder('${folder.id}', event)"></i>
          <i data-lucide="${folder.icon || 'folder'}" class="tree-node-icon folder-icon-color"></i>
          <span class="tree-node-label">${escapeHTML(folder.name)}</span>
          <span class="tree-node-badge">${totalItems}</span>
        </div>
        <div class="tree-children ${expanded || query ? '' : 'collapsed'}">
          <div class="tree-children-inner">
            ${renderSnippetTreeRecursive(folder.id, depth + 1, query)}
          </div>
        </div>
      </div>
    `;
  });

  return html;
}

function folderHasMatchingSnippets(folderId, query) {
  const items = getItemsInFolder(folderId, 'snippet');
  if (items.some(s => fuzzyMatch(s.title, query) || (s.tags || []).some(t => fuzzyMatch(t, query)))) return true;
  const childFolders = getChildFolders(folderId, 'snippet');
  return childFolders.some(cf => folderHasMatchingSnippets(cf.id, query));
}

function renderSnippetItem(s, depth) {
  return ''; // Deprecated: Snippets are now rendered in the right pane via renderSnippetFolderOverview
}

function toggleSnippetFolder(nodeId, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  toggleNodeExpanded(nodeId);
  renderSnippetList();
}

function selectSnippetFolder(folderId) {
  const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content');
  if (pane1) setSessionParam('studySidebarScroll', pane1.scrollTop);

  activeSnippetFolderId = folderId;
  activeSnippetId = null;
  setSessionParam('activeSnippetId', null);
  setSessionParam('studyOpenCat', folderId);

  renderSnippetList();
  renderSnippetDetail();
}


function selectSnippet(id) {
  const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content');
  if (pane1) setSessionParam('studySidebarScroll', pane1.scrollTop);

  const searchInput = document.getElementById('snippet-search');
  const wasSearching = searchInput && searchInput.value.trim() !== '';

  if (wasSearching) {
    // Clear search
    searchInput.value = '';

    const snippet = (state.snippets || []).find(s => s.id === id);
    if (snippet) {
      activeSnippetFolderId = snippet.parentId || null;
      setSessionParam('studyOpenCat', activeSnippetFolderId);

      // Expand tree
      if (activeSnippetFolderId) {
        let curr = state.nodes.find(n => n.id === activeSnippetFolderId);
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

  activeSnippetId = id;
  setSessionParam('activeSnippetId', id);

  if (wasSearching) {
    // Scroll to card
    setTimeout(() => {
      const detailHeader = document.querySelector('.snippet-detail');
      if (detailHeader) {
        detailHeader.classList.add('pulse-highlight');
        setTimeout(() => detailHeader.classList.remove('pulse-highlight'), 2000);
      }
    }, 100);
  }

  renderSnippetList();
  renderSnippetDetail();
}

function renderSnippetDetail() {
  const container = document.getElementById('snippet-detail-container');
  const snippet = (state.snippets || []).find(s => s.id === activeSnippetId);

  if (!snippet) {
    if (activeSnippetFolderId) {
      renderSnippetFolderOverview(container);
    } else {
      container.innerHTML = `
        <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
          <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i>
          <h2>Select a folder</h2>
          <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose a folder from the left pane to view its snippets.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    return;
  }

  const commentsContent = snippet.comments
    ? (snippet.comments.startsWith('<') ? snippet.comments : escapeHTML(snippet.comments))
    : '<p>No specific comments attached to this snippet.</p>';

  const isRoot = !snippet.parentId;
  let breadcrumbHtml = `<nav class="breadcrumb-nav" style="margin-bottom: 1rem;">`;
  breadcrumbHtml += `<button class="breadcrumb-item" style="cursor:default;"><i data-lucide="home" style="width:12px;height:12px;"></i></button>`;

  if (isRoot) {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<span class="breadcrumb-current">Uncategorized</span>`;
  } else {
    const pathNodes = getBreadcrumbPath(snippet.parentId);
    pathNodes.forEach((node, idx) => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      breadcrumbHtml += `<button class="breadcrumb-item" onclick="toggleSnippetFolder('${node.id}')">${escapeHTML(node.name)}</button>`;
    });
  }
  breadcrumbHtml += `</nav>`;

  container.innerHTML = `
    <div class="snippet-detail animate-fade-in">
      <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 1.5rem; margin-bottom: 1.5rem;">
        ${breadcrumbHtml}
        <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.75rem;">${escapeHTML(snippet.title)}</h2>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          ${(snippet.tags || []).map(t => `<span class="badge badge-primary">${escapeHTML(t)}</span>`).join('')}
        </div>
      </div>
      
      <div class="snippet-detail-body">
        
        ${snippet.description ? `
          <div class="snippet-rich-desc ql-snow" style="line-height: 1.6; color: var(--text-secondary); margin-bottom: 2.5rem;">
            <div class="ql-editor" style="padding:0;">
               ${snippet.description}
            </div>
          </div>
        ` : ''}
        
        <div style="margin-bottom: 2.5rem;">
          <h3 style="font-size: 1.125rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="message-square" style="width:18px;height:18px;color:var(--text-tertiary);"></i> Comments & Notes
          </h3>
          <div class="snippet-comments-display ql-snow" style="background: var(--bg-surface-hover); border: 1px solid var(--border-color); border-left: 3px solid var(--color-accent); padding: 1rem 1.25rem; border-radius: var(--radius-md); font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6;">
            <div class="ql-editor" style="padding:0; font-family: inherit; font-size: inherit;">
               ${commentsContent}
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 1rem; flex-wrap: wrap; background: var(--bg-surface-hover); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <button class="btn btn-primary" onclick="openExamplesModal()" id="view-examples-btn">
            <i data-lucide="code" style="width: 16px; height: 16px;"></i> View Examples (${(snippet.examples || []).length})
          </button>
          <button class="btn btn-secondary" onclick="openTryCodingModal()" id="try-coding-btn" style="border-color: var(--color-accent); color: var(--color-accent);">
            <i data-lucide="terminal" style="width: 16px; height: 16px;"></i> Try Coding
          </button>
          <button class="btn btn-secondary" onclick="openRelatedChallengesModal()" id="related-challenges-btn">
            <i data-lucide="link" style="width: 16px; height: 16px;"></i> Linked Challenges
          </button>
          <button class="btn btn-secondary" onclick="shareSnippet('${snippet.id}')" id="share-snippet-btn">
            <i data-lucide="share-2" style="width: 16px; height: 16px;"></i> Share
          </button>
        </div>
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSnippetFolderOverview(container) {
  const searchInput = document.getElementById('snippet-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const isRoot = activeSnippetFolderId === '__root__';
  const folder = isRoot ? null : state.nodes.find(n => n.id === activeSnippetFolderId);

  let breadcrumbHtml = `<nav class="breadcrumb-nav" style="margin-bottom: 1.5rem;">`;
  breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectSnippetFolder('__root__')"><i data-lucide="home" style="width:12px;height:12px;"></i></button>`;

  if (isRoot) {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<span class="breadcrumb-current">Uncategorized</span>`;
  } else if (folder) {
    const pathNodes = getBreadcrumbPath(folder.id);
    pathNodes.forEach((node, idx) => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      if (idx < pathNodes.length - 1) {
        breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectSnippetFolder('${node.id}')">${escapeHTML(node.name)}</button>`;
      } else {
        breadcrumbHtml += `<span class="breadcrumb-current">${escapeHTML(node.name)}</span>`;
      }
    });
  }
  breadcrumbHtml += `</nav>`;

  const folderId = isRoot ? null : activeSnippetFolderId;
  let snippets = [];
  let childFolders = [];

  if (query) {
    snippets = (state.snippets || []).filter(s => fuzzyMatch(s.title, query) || (s.tags || []).some(t => fuzzyMatch(t, query)));
  } else {
    snippets = (state.snippets || []).filter(s => s.parentId === folderId);
    childFolders = isRoot ? [] : getChildFolders(activeSnippetFolderId, 'snippet');
  }

  let subfoldersHtml = '';
  if (childFolders.length > 0) {
    subfoldersHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">`;
    childFolders.forEach(sf => {
      const sfCount = countItemsRecursive(sf.id, 'snippet');
      subfoldersHtml += `
        <div class="subfolder-card" onclick="selectSnippetFolder('${sf.id}'); toggleNodeExpanded('${sf.id}');">
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

  if (snippets.length === 0 && childFolders.length === 0) {
    container.innerHTML = breadcrumbHtml + `
      <div class="empty-state" style="height: 60%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i>
        <h2>No snippets found</h2>
        <p style="font-size: 0.875rem; margin-top: 0.5rem; color: var(--text-tertiary);">
          ${query ? `No results for "${escapeHTML(query)}"` : `No snippets available in ${escapeHTML(folderName)}.`}
        </p>
      </div>`;
  } else {
    const hideSubfolders = getSessionParam('hideSubfolders') === 'true';

    container.innerHTML = breadcrumbHtml + `
      <div class="animate-fade-in">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
          <div>
              <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary);">${escapeHTML(folderName)}</h2>
              <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">Select a snippet below to view its details.</p>
          </div>
          <div>
              <button class="btn btn-ghost" onclick="showConfirm('Toggle Visibility', 'Are you sure you want to ' + (${hideSubfolders} ? 'show' : 'hide') + ' subfolders?', () => { setSessionParam('hideSubfolders', '${!hideSubfolders}'); renderSnippetDetail(); })" title="Toggle Subfolders" style="padding: 0.5rem;">
                  <i data-lucide="${hideSubfolders ? 'eye-off' : 'eye'}"></i>
              </button>
          </div>
      </div>
      ${hideSubfolders ? '' : subfoldersHtml}
      ${snippets.length > 0 ? `
        <div class="card-grid stagger-children">
          ${snippets.map(s => {
      const tHtml = (s.tags || []).map(t => `<span class="badge badge-primary">${escapeHTML(t)}</span>`).join('');
      return `
              <div class="card" onclick="selectSnippet('${s.id}')" style="cursor: pointer;">
                <h3 style="font-weight:700; font-size:1.1rem; color:var(--text-primary); margin-bottom:0.5rem;">${escapeHTML(s.title)}</h3>
                <div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-bottom:0.75rem;">
                  ${tHtml}
                </div>
                <div style="margin-top:auto; display:flex; justify-content: flex-end;">
                  <button class="btn btn-ghost" title="Share Link" onclick="event.stopPropagation(); shareSnippet('${s.id}')" style="padding:0.5rem;">
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

// === EXAMPLES MODAL ===
function openExamplesModal() {
  const snippet = (state.snippets || []).find(s => s.id === activeSnippetId);
  if (!snippet) return;

  currentSnippetVariants = snippet.examples || [];
  activeExampleIndex = 0;

  document.getElementById('examples-modal-title').innerText = `${snippet.title} — Examples`;
  const modal = document.getElementById('examples-modal');
  modal.classList.remove('hidden');

  renderExamplesModal();
}

function closeExamplesModal() {
  document.getElementById('examples-modal').classList.add('hidden');
}

function renderExamplesModal() {
  const tabsContainer = document.getElementById('examples-tabs');
  const contentContainer = document.getElementById('examples-content');

  if (currentSnippetVariants.length === 0) {
    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = `<div class="empty-state" style="padding: 2rem;">
      <i data-lucide="code" style="width: 32px; height: 32px; margin-bottom: 1rem; opacity: 0.5;"></i>
      <h3 style="font-weight: 600;">No examples</h3>
      <p style="font-size: 0.875rem; color: var(--text-tertiary);">No code examples have been added to this snippet yet.</p>
    </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  tabsContainer.innerHTML = currentSnippetVariants.map((ex, i) => `
    <div onclick="switchExampleTab(${i})" class="variant-tab ${i === activeExampleIndex ? 'active' : ''}">
      ${escapeHTML(ex.name || 'Example ' + (i + 1))}
    </div>
  `).join('');

  const activeEx = currentSnippetVariants[activeExampleIndex];
  const codeStr = activeEx.code || '';

  const highlightSet = new Set();
  if (activeEx.highlightLines) {
    activeEx.highlightLines.split(',').forEach(part => {
      const p = part.trim();
      if (p.includes('-')) {
        const [start, end] = p.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let l = start; l <= end; l++) highlightSet.add(l);
        }
      } else {
        const num = Number(p);
        if (!isNaN(num)) highlightSet.add(num);
      }
    });
  }

  const lines = codeStr.split('\n');
  const highlightedLines = lines.map((line, idx) => {
    const lineNum = idx + 1;
    const highlighted = syntaxHighlight(line);
    if (highlightSet.has(lineNum)) {
      return `<span class="example-line example-line-highlight">${highlighted}\n</span>`;
    }
    return `<span class="example-line">${highlighted}\n</span>`;
  }).join('');

  contentContainer.innerHTML = `
    <div class="editor-container" style="min-height: 200px; border-radius: var(--radius-md); height: auto; display: block; overflow: hidden;">
      <pre id="example-view-pre" class="editor-pre" style="position: relative; height: auto; overflow-x: auto; overflow-y: hidden;"><code id="example-view-code" style="height: auto;">${highlightedLines}</code></pre>
    </div>
  `;

  const ta = contentContainer.querySelector('textarea');
  const pre = contentContainer.querySelector('.editor-pre');
  if (ta && pre) {
    ta.addEventListener('scroll', () => {
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
    });
  }
}

function switchExampleTab(idx) {
  activeExampleIndex = idx;
  renderExamplesModal();
}

// === TRY CODING MODAL ===
function openTryCodingModal() {
  const snippet = (state.snippets || []).find(s => s.id === activeSnippetId);
  if (!snippet) return;

  const examples = snippet.examples || [];
  if (examples.length === 0) {
    if (typeof showMessage === 'function') {
      showMessage("No Examples", "This snippet has no code examples to practice with. Add examples in the Admin panel first.", true);
    }
    return;
  }

  let targetIndices = snippet.tryCodingTargetIndices;
  if (!targetIndices || targetIndices.length === 0) {
    targetIndices = [snippet.tryCodingExampleIndex || 0];
  }

  targetIndices = targetIndices.filter(idx => idx >= 0 && idx < examples.length);
  if (targetIndices.length === 0) targetIndices = [0];

  tryCodingTargetCodes = targetIndices.map(idx => examples[idx].code || '');
  tryCodingTargetStarterCode = snippet.starterCode || '';

  const targetNames = targetIndices.map(idx => examples[idx].name || ('Example ' + (idx + 1))).join(' OR ');

  document.getElementById('try-coding-title').innerHTML = `
    <i data-lucide="terminal" style="width:24px; height:24px; display:inline; vertical-align:middle; margin-right:0.5rem;"></i>
    Try Coding — ${escapeHTML(snippet.title)}
  `;
  document.getElementById('try-coding-desc').innerHTML = `
    <strong>Target:</strong> ${escapeHTML(targetNames)} — Type the code from memory, then click <strong>Check Code</strong> to compare.
  `;

  const textarea = document.getElementById('try-coding-textarea');
  const codeEl = document.getElementById('try-coding-code');
  textarea.value = tryCodingTargetStarterCode;
  codeEl.innerHTML = syntaxHighlight(tryCodingTargetStarterCode) + '<br/>';

  const resultEl = document.getElementById('try-coding-result');
  resultEl.style.display = 'none';
  resultEl.innerHTML = '';

  document.getElementById('try-coding-modal').classList.remove('hidden');

  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('try-coding-textarea', 'try-coding-pre', 'try-coding-code', false);
  }

  const finalTA = document.getElementById('try-coding-textarea');
  finalTA.addEventListener('input', () => {
    const codePreEl = document.getElementById('try-coding-code');
    if (codePreEl) {
      codePreEl.innerHTML = syntaxHighlight(finalTA.value) + '<br/>';
    }
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
  finalTA.focus();
}

function closeTryCodingModal() {
  document.getElementById('try-coding-modal').classList.add('hidden');
}

function resetTryCoding() {
  const textarea = document.getElementById('try-coding-textarea');
  const codeEl = document.getElementById('try-coding-code');

  textarea.value = tryCodingTargetStarterCode;
  codeEl.innerHTML = syntaxHighlight(tryCodingTargetStarterCode) + '<br/>';

  const resultEl = document.getElementById('try-coding-result');
  resultEl.style.display = 'none';
  resultEl.innerHTML = '';
  textarea.focus();
}

function checkTryCoding() {
  const textarea = document.getElementById('try-coding-textarea');
  const userCode = textarea.value;

  if (!userCode.trim()) {
    if (typeof showMessage === 'function') {
      showMessage("Empty Code", "Please type some code before checking.", true);
    }
    return;
  }

  let bestPercentage = -1;
  let isPerfect = false;

  for (const targetCode of tryCodingTargetCodes) {
    const { diffs, scoreCount, cLinesLen } = computeDiffs(userCode, targetCode);
    const percentage = Math.min(Math.round((scoreCount / cLinesLen) * 100), 100);

    if (percentage > bestPercentage) {
      bestPercentage = percentage;
    }
  }

  isPerfect = bestPercentage === 100;
  const percentage = bestPercentage;

  const resultEl = document.getElementById('try-coding-result');
  resultEl.style.display = 'block';

  if (isPerfect) {
    resultEl.innerHTML = `
      <div style="background: var(--color-success-bg); border: 1px solid var(--color-success); border-radius: var(--radius-md); padding: 1rem; display: flex; align-items: center; gap: 0.75rem;">
        <i data-lucide="check-circle-2" style="width:28px; height:28px; color: var(--color-success); flex-shrink:0;"></i>
        <div>
          <div style="font-weight: 700; color: var(--color-success); font-size: 1.125rem;">Perfect Match! 🎉</div>
          <div style="font-size: 0.8125rem; color: var(--text-secondary);">Your code matches the target exactly. Well done!</div>
        </div>
      </div>
    `;
  } else {
    resultEl.innerHTML = `
      <div style="background: var(--color-warning-bg); border: 1px solid var(--color-warning); border-radius: var(--radius-md); padding: 1rem; display: flex; align-items: center; gap: 0.75rem;">
        <div style="background: var(--color-warning); color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.875rem; flex-shrink:0;">${percentage}%</div>
        <div>
          <div style="font-weight: 700; color: var(--color-warning); font-size: 1.125rem;">${percentage}% Match</div>
          <div style="font-size: 0.8125rem; color: var(--text-secondary);">Keep practicing! Review your code and try again.</div>
        </div>
      </div>
    `;
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// === RELATED CHALLENGES MODAL ===
function openRelatedChallengesModal() {
  document.getElementById('related-challenges-modal').classList.remove('hidden');
  const searchInput = document.getElementById('related-search');
  if (searchInput) searchInput.value = '';
  renderRelatedChallengesList();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeRelatedChallengesModal() {
  document.getElementById('related-challenges-modal').classList.add('hidden');
}

function renderRelatedChallengesList() {
  const container = document.getElementById('related-challenges-list');
  const searchInput = document.getElementById('related-search');
  const query = searchInput ? searchInput.value.trim() : '';

  const snippet = (state.snippets || []).find(s => s.id === activeSnippetId);
  if (!snippet) return;

  const linkedIds = snippet.relatedChallenges || [];
  let challenges = state.challenges.filter(c => linkedIds.includes(c.id));

  if (query) {
    challenges = challenges.filter(c =>
      fuzzyMatch(c.title, query) ||
      (c.tags || []).some(t => fuzzyMatch(t, query)) ||
      fuzzyMatch(c.category || '', query)
    );
  }

  if (challenges.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <i data-lucide="search-x" style="width: 32px; height: 32px; margin-bottom: 0.75rem; opacity: 0.5;"></i>
        <h3 style="font-weight: 600;">No linked challenges found</h3>
        <p style="font-size: 0.8125rem; color: var(--text-tertiary);">
          ${query ? `No results for "${escapeHTML(query)}"` : 'No related challenges have been linked to this snippet yet.'}
        </p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  container.innerHTML = challenges.map(c => `
    <div class="related-challenge-item" style="display: flex; align-items: center; gap: 1rem; padding: 0.875rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); transition: all 150ms ease; cursor: pointer;" onmouseover="this.style.borderColor='var(--color-primary)'; this.style.background='var(--color-primary-subtle)'" onmouseout="this.style.borderColor='var(--border-color)'; this.style.background='var(--bg-surface)'">
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 0.9375rem; color: var(--text-primary); margin-bottom: 0.25rem;">${escapeHTML(c.title)}</div>
        <div style="display: flex; gap: 0.375rem; align-items: center; flex-wrap: wrap;">
          <span class="badge badge-neutral" style="font-size: 0.625rem;">${escapeHTML(c.category || 'Uncategorized')}</span>
          ${(c.tags || []).slice(0, 3).map(t => `<span class="badge badge-primary" style="font-size: 0.6rem;">${escapeHTML(t)}</span>`).join('')}
          <span style="font-size: 0.75rem; color: var(--text-tertiary); margin-left: auto;">${c.variants.length} version${c.variants.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <button onclick="event.stopPropagation(); navigateToChallenge('${c.id}')" class="btn btn-practice" style="width: auto; padding: 0.5rem 1rem; font-size: 0.8125rem;">
        <i data-lucide="play" style="width:14px;height:14px;fill:currentColor;"></i> Practice
      </button>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function navigateToChallenge(challengeId) {
  const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content');
  if (pane1) setSessionParam('studySidebarScroll', pane1.scrollTop);

  closeRelatedChallengesModal();
  promptTimer(challengeId);
}

// === TIMER MODAL (For Practice Links) ===
function promptTimer(challengeId) {
  const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content');
  if (pane1) setSessionParam('studySidebarScroll', pane1.scrollTop);

  pendingChallengeId = challengeId;
  const challenge = (state?.challenges ?? []).find(c => c.id === challengeId);
  if (!challenge) return;

  const variantSelect = document.getElementById('timer-variant-select');
  if (!variantSelect) return;
  variantSelect.innerHTML = (challenge?.variants ?? []).map(v =>
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
  const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content');
  if (pane1) setSessionParam('studySidebarScroll', pane1.scrollTop);

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
// SHAREABLE SNIPPETS
// ============================================================

function shareSnippet(snippetId) {
  const snippet = (state.snippets || []).find(s => s.id === snippetId);
  if (!snippet) return;

  const shareable = {
    _type: 'snippet',
    title: snippet.title,
    tags: snippet.tags || [],
    description: snippet.description || '',
    comments: snippet.comments || '',
    examples: (snippet.examples || []).map(ex => ({
      name: ex.name,
      code: ex.code || '',
      highlightLines: ex.highlightLines || ''
    }))
  };

  const encoded = encodeShareData(shareable);
  if (!encoded) {
    if (typeof showMessage === 'function') showMessage('Error', 'Failed to encode snippet for sharing.', true);
    return;
  }

  const url = window.location.origin + window.location.pathname + '?data=' + encoded;

  navigator.clipboard.writeText(url).then(() => {
    if (typeof showShareToast === 'function') showShareToast('Snippet link copied!');
    else if (typeof showMessage === 'function') showMessage('Shared', 'Link copied to clipboard!');
  }).catch(() => {
    prompt('Copy this share link:', url);
  });
}

function checkSharedSnippet() {
  const params = new URLSearchParams(window.location.search);
  const dataParam = params.get('data');
  if (!dataParam) return;

  const shared = decodeShareData(dataParam);
  if (!shared || shared._type !== 'snippet') return;

  // Clean URL without reloading
  window.history.replaceState({}, document.title, window.location.pathname);

  // Inject as a temporary snippet
  const tempId = 'shared_snippet_' + Date.now();
  const tempSnippet = {
    id: tempId,
    title: '[Shared] ' + (shared.title || 'Snippet'),
    tags: shared.tags || [],
    description: shared.description || '',
    comments: shared.comments || '',
    parentId: null,
    examples: (shared.examples || []).map(ex => ({
      ...ex,
      id: ex.id || generateId()
    }))
  };

  // Add to state and persist
  if (!state.snippets) state.snippets = [];
  state.snippets.unshift(tempSnippet);
  saveData();

  // Auto-select and show the snippet
  setTimeout(() => {
    selectSnippet(tempId);
  }, 300);
}

// ============================================================
// SNIPPET CONTEXT MENU 
// ============================================================

function showSnippetCtxMenu(e, nodeId) {
  snippetCtxTargetNodeId = nodeId;
  const menu = document.getElementById('snippet-context-menu');
  if (!menu) return;

  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.classList.remove('hidden');

  const isRoot = nodeId === null;
  const newFolderBtn = document.getElementById('sctx-new-folder');
  const renameBtn = document.getElementById('sctx-rename');
  const moveBtn = document.getElementById('sctx-move');
  const deleteBtn = document.getElementById('sctx-delete');

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
  setTimeout(() => {
    document.addEventListener('click', closeSnippetCtxMenu, { once: true });
  }, 10);
}

function closeSnippetCtxMenu() {
  const menu = document.getElementById('snippet-context-menu');
  if (menu) menu.classList.add('hidden');
}

function snippetCtxNewFolder() {
  closeSnippetCtxMenu();
  const name = prompt('Enter folder name:');
  if (!name || !name.trim()) return;

  // Use the global createNode utility
  const newNode = createNode(name.trim(), 'folder', snippetCtxTargetNodeId, 'snippet');

  // CRITICAL: Expand the parent so the new child is visible
  if (snippetCtxTargetNodeId && !isNodeExpanded(snippetCtxTargetNodeId)) {
    toggleNodeExpanded(snippetCtxTargetNodeId);
  }

  saveData(); // Save to localStorage
  renderSnippetList(); // Force the UI to refresh
}

function snippetCtxRename() {
  closeSnippetCtxMenu();
  if (!snippetCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === snippetCtxTargetNodeId);
  if (!folder) return;

  const newName = prompt('Rename folder:', folder.name);
  if (!newName || !newName.trim() || newName.trim() === folder.name) return;

  renameNode(snippetCtxTargetNodeId, newName.trim());
  renderSnippetList();
}

function snippetCtxDelete() {
  closeSnippetCtxMenu();
  if (!snippetCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === snippetCtxTargetNodeId);
  if (!folder) return;

  if (typeof showConfirm === 'function') {
    showConfirm('Delete Folder', `Delete "${escapeHTML(folder.name)}" and all subfolders? Items will become uncategorized.`, () => {
      deleteNode(snippetCtxTargetNodeId);
      renderSnippetList();
    });
  } else {
    if (!confirm(`Delete "${folder.name}" and all subfolders?`)) return;
    deleteNode(snippetCtxTargetNodeId);
    renderSnippetList();
  }
}

function snippetCtxMove() {
  closeSnippetCtxMenu();
  if (!snippetCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === snippetCtxTargetNodeId);
  if (!folder) return;

  const validFolders = state.nodes.filter(n =>
    n.type === 'folder' && n.scope === 'snippet' && n.id !== snippetCtxTargetNodeId && !isDescendantOf(n.id, snippetCtxTargetNodeId)
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
  renderSnippetList();
}

async function snippetCtxChangeIcon() {
  closeSnippetCtxMenu();
  if (!snippetCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === snippetCtxTargetNodeId);
  if (!folder) return;

  const currentIcon = folder.icon || 'folder';
  const newIcon = await openIconPicker(currentIcon);
  if (!newIcon || !newIcon.trim() || newIcon.trim() === currentIcon) return;

  folder.icon = newIcon.trim();
  saveData();
  renderSnippetList();
}