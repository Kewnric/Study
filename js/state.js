/* ============================================================
   STATE.JS — Global State, Data Persistence, Local Storage
   ============================================================ */

const generateId = () => Math.random().toString(36).slice(2, 11);

// --- Global State ---
let state = {
  view: 'browse',
  // Legacy (kept for migration only)
  categories: ['Basics', 'Algorithms', 'Data Structures'],
  snippetCategories: ['Basics/Loops', 'Basics/Functions', 'Advanced/Web'],
  notebookCategories: ['General'],
  // New Tree System
  nodes: [],            // Array of { id, type:'folder', name, parentId, scope }
  expandedNodes: [],     // Array of node IDs currently expanded in tree UI
  activeNodeId: null,    // Currently selected folder node ID
  // Existing
  categoryRequirements: {},
  snippetProgress: {},
  badges: [],
  snippets: [],
  notebooks: [],
  notebookHistory: [],
  challenges: [],
  history: [],
  activeAttempts: {},
  activeChallenge: null,
  activeVariant: null,
  userCode: '',
  sessionData: null,
  timeLimit: 0,
  lastDiffs: []
};

// Admin Flow State
let adminState = null;
let pendingChallengeId = null;
let activeTimerInterval = null;

// --- Data Migration ---
function migrateLegacyData(challenges) {
  return challenges.map(c => {
    if (!c.tags) c.tags = [];
    if (!c.variants) {
      return {
        id: c.id,
        title: c.title,
        category: c.category,
        tags: c.tags,
        coverDescription: c.description || '',
        variants: [{
          id: generateId(),
          name: 'Version 1',
          description: c.description || '',
          code: c.code || '',
          samples: []
        }]
      };
    }
    return c;
  });
}

// --- Migrate flat categories to tree nodes ---
function migrateCategoriesToNodes(parsed) {
  const nodes = [];
  const reqMapping = {}; // old category name → new node ID (for lock rules)

  // Practice categories → folder nodes
  (parsed.categories || []).forEach(cat => {
    const folderId = generateId();
    nodes.push({ id: folderId, type: 'folder', name: cat, parentId: null, scope: 'challenge' });
    reqMapping[cat] = folderId;
    state.challenges.forEach(c => {
      if (c.category === cat) c.parentId = folderId;
    });
  });
  // Orphan challenges → null parentId (root)
  state.challenges.forEach(c => { if (!c.parentId) c.parentId = null; });

  // Snippet categories → folder nodes
  (parsed.snippetCategories || []).forEach(cat => {
    const folderId = generateId();
    nodes.push({ id: folderId, type: 'folder', name: cat, parentId: null, scope: 'snippet' });
    (state.snippets || []).forEach(s => {
      if (s.category === cat) s.parentId = folderId;
    });
  });
  // Orphan snippets
  (state.snippets || []).forEach(s => { if (!s.parentId) s.parentId = null; });

  // Notebook categories → folder nodes
  (parsed.notebookCategories || []).forEach(cat => {
    const folderId = generateId();
    nodes.push({ id: folderId, type: 'folder', name: cat, parentId: null, scope: 'notebook' });
    (state.notebooks || []).forEach(n => {
      if (n.category === cat) n.parentId = folderId;
    });
  });
  // Orphan notebooks
  (state.notebooks || []).forEach(n => { if (!n.parentId) n.parentId = null; });

  // Migrate category requirements to use node IDs
  if (parsed.categoryRequirements) {
    const newReqs = {};
    Object.entries(parsed.categoryRequirements).forEach(([catName, req]) => {
      const nodeId = reqMapping[catName];
      if (nodeId) {
        newReqs[nodeId] = {
          reqNodeId: reqMapping[req.reqCat] || null,
          reqCat: req.reqCat, // Keep for display fallback
          count: req.count
        };
      }
    });
    state.categoryRequirements = newReqs;
  }

  return nodes;
}

// --- Data Persistence ---
function loadData() {
  const saved = localStorage.getItem('codePlatformData');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.categories = parsed.categories || state.categories;
      state.snippetCategories = parsed.snippetCategories || state.snippetCategories;
      state.categoryRequirements = parsed.categoryRequirements || {};
      state.snippetProgress = parsed.snippetProgress || {};
      state.badges = parsed.badges || [];
      state.snippets = parsed.snippets || [];
      state.notebooks = parsed.notebooks || [];
      state.notebookCategories = parsed.notebookCategories || ['General'];
      state.notebookHistory = parsed.notebookHistory || [];
      state.challenges = migrateLegacyData(parsed.challenges || state.challenges);
      state.history = parsed.history || [];
      state.activeAttempts = parsed.activeAttempts || {};
      state.expandedNodes = parsed.expandedNodes || [];

      // Tree migration: if nodes don't exist yet, migrate from flat categories
      if (parsed.nodes && parsed.nodes.length > 0) {
        state.nodes = parsed.nodes;
      } else {
        state.nodes = migrateCategoriesToNodes(parsed);
        console.log('[Migration] Converted flat categories → tree nodes:', state.nodes.length, 'folders created');
      }
    } catch (e) {
      console.error("Failed to parse local storage", e);
    }
  } else {
    // ── Seed default/example content for first-time users ──
    seedDefaultData();
  }
}

function seedDefaultData() {
  const fChallenge = { id: 'default_folder_challenge', type: 'folder', name: 'Getting Started', parentId: null, scope: 'challenge' };
  const fSnippet  = { id: 'default_folder_snippet',  type: 'folder', name: 'Basics', parentId: null, scope: 'snippet' };
  const fNotebook = { id: 'default_folder_notebook', type: 'folder', name: 'General', parentId: null, scope: 'notebook' };

  state.nodes = [fChallenge, fSnippet, fNotebook];

  state.challenges = [{
    id: 'default_challenge_1', _isDefault: true,
    title: 'Hello World',
    parentId: fChallenge.id,
    tags: ['Beginner', 'Example'],
    coverDescription: 'A simple program that prints Hello World to the console.',
    variants: [{
      id: 'default_v1',
      name: 'JavaScript',
      description: 'Write a function that returns the string "Hello World".',
      code: 'function helloWorld() {\n  return "Hello World";\n}',
      samples: ['Input: helloWorld()\nOutput: "Hello World"']
    }]
  }];

  state.snippets = [{
    id: 'default_snippet_1', _isDefault: true,
    title: 'For Loop Pattern',
    parentId: fSnippet.id,
    tags: ['Loop', 'Beginner'],
    description: '<p>A basic for loop iterates over a range of numbers.</p>',
    comments: '<p>Remember: for loops have 3 parts — initialization, condition, increment.</p>',
    globalStarterCode: '',
    relatedChallengeIds: [],
    examples: [{
      id: 'default_ex1',
      name: 'Basic Loop',
      code: 'for (let i = 0; i < 5; i++) {\n  console.log(i);\n}',
      isTryCodingTarget: true
    }]
  }];

  state.notebooks = [{
    id: 'default_notebook_1', _isDefault: true,
    title: 'Quick Start Quiz',
    parentId: fNotebook.id,
    icon: 'book',
    tags: ['Beginner'],
    description: 'A sample notebook with example questions to get you started.',
    sections: [{
      id: 'default_sec1',
      title: 'Basics',
      content: '<p>Answer these fundamental programming questions.</p>',
      questions: [
        { id: 'q1', text: 'What does "console.log()" do in JavaScript?', choices: ['Prints to console', 'Creates a variable', 'Defines a function', 'Imports a module'], correctIndex: 0, hint: 'Think about debugging output.' },
        { id: 'q2', text: 'Which keyword declares a constant in JavaScript?', choices: ['var', 'let', 'const', 'def'], correctIndex: 2, hint: 'It means the value cannot be reassigned.' }
      ]
    }]
  }];

  state.expandedNodes = [fChallenge.id, fSnippet.id, fNotebook.id];
  saveData();
}

let saveTimeout;

function saveData() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const dataToSave = {
      // Legacy (kept for backward compat on export)
      categories: getNodeNamesForScope('challenge'),
      snippetCategories: getNodeNamesForScope('snippet'),
      notebookCategories: getNodeNamesForScope('notebook'),
      // New tree system
      nodes: state.nodes,
      expandedNodes: state.expandedNodes,
      // Existing
      categoryRequirements: state.categoryRequirements,
      snippetProgress: state.snippetProgress,
      badges: state.badges,
      snippets: state.snippets,
      notebooks: state.notebooks,
      notebookHistory: state.notebookHistory,
      challenges: state.challenges,
      history: state.history,
      activeAttempts: state.activeAttempts
    };
    try {
      localStorage.setItem('codePlatformData', JSON.stringify(dataToSave));
    } catch (e) {
      console.error("Storage Error:", e);
      if (typeof showMessage === 'function') {
        showMessage("Storage Limit Reached", "Could not save data. Local storage has a 5MB limit.", true);
      } else {
        alert("Could not save data: Local storage 5MB limit exceeded.");
      }
    }
  }, 500);
}

// ============================================================
// TREE HELPER FUNCTIONS
// ============================================================

// Get root-level folder names for a scope (for legacy compat)
function getNodeNamesForScope(scope) {
  return state.nodes
    .filter(n => n.type === 'folder' && n.scope === scope && n.parentId === null)
    .map(n => n.name);
}

// Get child folders of a parent
function getChildFolders(parentId, scope) {
  return state.nodes.filter(n =>
    n.type === 'folder' &&
    n.parentId === (parentId || null) &&
    (!scope || n.scope === scope)
  );
}

// Count all items recursively inside a folder
function countItemsRecursive(folderId, scope) {
  let count = 0;
  // Direct items
  if (scope === 'challenge') count += state.challenges.filter(c => c.parentId === folderId).length;
  else if (scope === 'snippet') count += (state.snippets || []).filter(s => s.parentId === folderId).length;
  else if (scope === 'notebook') count += (state.notebooks || []).filter(n => n.parentId === folderId).length;
  // Child folders
  const childFolders = state.nodes.filter(n => n.type === 'folder' && n.parentId === folderId);
  childFolders.forEach(cf => { count += countItemsRecursive(cf.id, scope); });
  return count;
}

// Get items directly in a folder
function getItemsInFolder(folderId, scope) {
  const parentId = folderId || null;
  if (scope === 'challenge') return state.challenges.filter(c => c.parentId === parentId);
  if (scope === 'snippet') return (state.snippets || []).filter(s => s.parentId === parentId);
  if (scope === 'notebook') return (state.notebooks || []).filter(n => n.parentId === parentId);
  return [];
}

// Build breadcrumb path from node to root
function getBreadcrumbPath(nodeId) {
  const path = [];
  let current = state.nodes.find(n => n.id === nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? state.nodes.find(n => n.id === current.parentId) : null;
  }
  return path;
}

// Check if nodeId is a descendant of ancestorId (circular reference guard)
function isDescendantOf(nodeId, ancestorId) {
  let current = state.nodes.find(n => n.id === nodeId);
  while (current) {
    if (current.parentId === ancestorId) return true;
    current = current.parentId ? state.nodes.find(n => n.id === current.parentId) : null;
  }
  return false;
}

// --- CRUD Operations ---
function createNode(name, type, parentId, scope) {
  const node = { id: generateId(), type, name, parentId: parentId || null, scope: scope || 'challenge' };
  state.nodes.push(node);
  saveData();
  return node;
}

function deleteNode(nodeId) {
  const toDelete = new Set();
  function collectDescendants(id) {
    toDelete.add(id);
    state.nodes.filter(n => n.parentId === id).forEach(child => collectDescendants(child.id));
  }
  collectDescendants(nodeId);

  // Remove folder nodes
  state.nodes = state.nodes.filter(n => !toDelete.has(n.id));
  // Orphan items whose parentId was deleted → set to null
  state.challenges.forEach(c => { if (toDelete.has(c.parentId)) c.parentId = null; });
  (state.snippets || []).forEach(s => { if (toDelete.has(s.parentId)) s.parentId = null; });
  (state.notebooks || []).forEach(n => { if (toDelete.has(n.parentId)) n.parentId = null; });
  // Clean up requirements
  toDelete.forEach(id => { delete state.categoryRequirements[id]; });

  saveData();
}

function moveNode(nodeId, newParentId) {
  // Guard: can't move into self or descendant
  if (nodeId === newParentId) return;
  if (newParentId && isDescendantOf(newParentId, nodeId)) return;

  const node = state.nodes.find(n => n.id === nodeId);
  if (node) {
    node.parentId = newParentId || null;
    saveData();
  }
}

function renameNode(nodeId, newName) {
  if (!newName || !newName.trim()) return;
  const node = state.nodes.find(n => n.id === nodeId);
  if (node) {
    node.name = newName.trim();
    saveData();
  }
}

function moveItemToFolder(itemId, itemType, newFolderId) {
  if (itemType === 'challenge') {
    const item = state.challenges.find(c => c.id === itemId);
    if (item) { item.parentId = newFolderId || null; saveData(); }
  } else if (itemType === 'snippet') {
    const item = (state.snippets || []).find(s => s.id === itemId);
    if (item) { item.parentId = newFolderId || null; saveData(); }
  } else if (itemType === 'notebook') {
    const item = (state.notebooks || []).find(n => n.id === itemId);
    if (item) { item.parentId = newFolderId || null; saveData(); }
  }
}

// Toggle expand/collapse
function toggleNodeExpanded(nodeId) {
  const idx = state.expandedNodes.indexOf(nodeId);
  if (idx >= 0) {
    state.expandedNodes.splice(idx, 1);
  } else {
    state.expandedNodes.push(nodeId);
  }
  saveData();
}

function isNodeExpanded(nodeId) {
  return state.expandedNodes.includes(nodeId);
}

// --- Session Storage Helpers (for cross-page data) ---
function setSessionParam(key, value) {
  sessionStorage.setItem('cm_' + key, JSON.stringify(value));
}

function getSessionParam(key) {
  const val = sessionStorage.getItem('cm_' + key);
  if (val) {
    try { return JSON.parse(val); } catch (e) { return null; }
  }
  return null;
}

function clearSessionParam(key) {
  sessionStorage.removeItem('cm_' + key);
}

// --- Shareable Challenge/Snippet URL Encoding ---
function encodeShareData(data) {
  try {
    // Safely encode Base64 so '+' and '/' don't break URL parsers
    return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
  } catch (e) {
    console.error('[Share] Encode failed:', e);
    return null;
  }
}

function decodeShareData(str) {
  try {
    // Fallback: URLSearchParams.get() replaces '+' with ' ' if not encoded.
    const base64Str = str.replace(/ /g, '+');
    return JSON.parse(decodeURIComponent(escape(atob(base64Str))));
  } catch (e) {
    console.error('[Share] Decode failed:', e);
    return null;
  }
}
