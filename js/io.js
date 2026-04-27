/* ============================================================
   IO.JS — Import / Export Handlers
   ============================================================ */

function handleDataExport() {
  const data = {
    // New tree system
    nodes: state.nodes,
    expandedNodes: state.expandedNodes,
    // Legacy (backward compat)
    categories: getNodeNamesForScope('challenge'),
    snippetCategories: getNodeNamesForScope('snippet'),
    notebookCategories: getNodeNamesForScope('notebook'),
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
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `code_platform_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showMessage("Export Complete", "Your data has been downloaded as a JSON backup file.");
}

function handleDataImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  showConfirm("Import Data", "This will overwrite all your current data (folders, challenges, snippets, history, badges). Are you sure?", () => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.challenges) {
          state.challenges = migrateLegacyData(parsed.challenges);
          state.snippets = parsed.snippets || [];
          state.notebooks = parsed.notebooks || [];
          state.categoryRequirements = parsed.categoryRequirements || {};
          state.snippetProgress = parsed.snippetProgress || {};
          state.badges = parsed.badges || [];
          state.notebookHistory = parsed.notebookHistory || [];
          state.history = parsed.history || [];
          state.activeAttempts = parsed.activeAttempts || {};

          // Handle tree nodes: if present use them, otherwise migrate legacy
          if (parsed.nodes && parsed.nodes.length > 0) {
            state.nodes = parsed.nodes;
            state.expandedNodes = parsed.expandedNodes || [];
          } else {
            // Legacy import — migrate flat categories to nodes
            state.categories = parsed.categories || ['Basics'];
            state.snippetCategories = parsed.snippetCategories || [];
            state.notebookCategories = parsed.notebookCategories || ['General'];
            state.nodes = migrateCategoriesToNodes(parsed);
            state.expandedNodes = [];
            console.log('[Import] Migrated legacy flat categories → tree nodes');
          }

          saveData();
          showMessage("Success", "Data imported successfully. The page will now reload.");
          setTimeout(() => window.location.reload(), 1200);
        } else {
          showMessage("Error", "Invalid backup file. Missing required 'challenges' data.", true);
        }
      } catch (err) {
        showMessage("Error", "Could not parse the file. Please ensure it's a valid JSON backup.", true);
      }
    };
    reader.readAsText(file);
  });

  e.target.value = '';
}

function handleDataReset() {
  showConfirm("Reset All Data", "Are you absolutely sure you want to reset all data back to 0? This will replace your data with default examples and cannot be undone.", () => {

    const defaultChallengeId = generateId();
    const defaultVariantId = generateId();
    const defaultNotebookId = generateId();
    const folderBasicsId = generateId();
    const folderFunctionsId = generateId();
    const folderGeneralId = generateId();

    state = {
      view: 'browse',
      categories: ['Basics'],
      snippetCategories: ['Basics/Functions'],
      notebookCategories: ['General'],
      // Tree nodes with sample folders
      nodes: [
        { id: folderBasicsId, type: 'folder', name: 'Basics', parentId: null, scope: 'challenge' },
        { id: folderFunctionsId, type: 'folder', name: 'Basics/Functions', parentId: null, scope: 'snippet' },
        { id: folderGeneralId, type: 'folder', name: 'General', parentId: null, scope: 'notebook' }
      ],
      expandedNodes: [],
      activeNodeId: null,
      categoryRequirements: {},
      snippetProgress: {},
      badges: [],
      snippets: [
        {
          id: generateId(),
          title: "Hello World Function",
          category: "Basics/Functions",
          parentId: folderFunctionsId,
          description: "A simple function that prints Hello World",
          code: "function helloWorld() {\\n  console.log('Hello World');\\n}",
          language: "javascript",
          isExample: true
        }
      ],
      notebooks: [
        {
          id: defaultNotebookId,
          title: "Introduction to Javascript",
          category: "General",
          parentId: folderGeneralId,
          icon: "book-open",
          description: "Welcome to StudySession Pro. This is an example notebook covering JavaScript basics.",
          tags: ["javascript", "basics"],
          sections: [
            {
              id: 'sec_default_1',
              label: "JS Fundamentals",
              choices: 4,
              // BUG-09 FIXED: Replaced legacy format with properly structured questions array
              questions: [
                { qNum: 1, answer: 'B', explanation: 'let declares a block-scoped variable.', question: 'What keyword is used to declare a block-scoped variable?', hint: 'Think about ES6 additions.', choices: { A: 'var', B: 'let', C: 'function', D: 'int' } },
                { qNum: 2, answer: 'A', explanation: 'console.log() outputs to the browser console.', question: 'Which method outputs text to the console?', hint: '', choices: { A: 'console.log()', B: 'print()', C: 'echo()', D: 'write()' } },
                { qNum: 3, answer: 'C', explanation: 'const declares a constant that cannot be reassigned.', question: 'Which keyword declares a constant?', hint: '', choices: { A: 'var', B: 'static', C: 'const', D: 'final' } }
              ]
            }
          ]
        }
      ],
      notebookHistory: [
        {
          id: generateId(),
          notebookId: defaultNotebookId,
          notebookTitle: "Introduction to Javascript",
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
          duration: 45,
          sections: [
            {
              label: "JS Fundamentals",
              correct: 3,
              total: 3,
              questionsCount: 3,
              answers: { 1: 'B', 2: 'A', 3: 'C' },
              keyMap: {
                1: { answer: 'B', explanation: 'let declares a block-scoped variable.' },
                2: { answer: 'A', explanation: 'console.log() outputs to the browser console.' },
                3: { answer: 'C', explanation: 'const declares a constant that cannot be reassigned.' }
              }
            }
          ]
        }
      ],
      challenges: [
        {
          id: defaultChallengeId,
          title: "Hello World Program",
          category: "Basics",
          parentId: folderBasicsId,
          tags: ["basics", "getting-started"],
          coverDescription: "Write a program that outputs Hello World.",
          variants: [
            {
              id: defaultVariantId,
              name: "Version 1",
              description: "Return the string 'Hello World'",
              code: "function getHelloWorld() {\\n  // Your code here\\n}",
              samples: [
                { input: "", output: "Hello World" }
              ]
            }
          ]
        }
      ],
      history: [
        {
          id: generateId(),
          challengeId: defaultChallengeId,
          challengeTitle: "Hello World Program - Version 1",
          category: "Basics",
          date: new Date().toLocaleDateString(),
          startTime: new Date().getTime() - 1000 * 60 * 5,
          duration: 120,
          score: 100,
          userCode: "function getHelloWorld() {\\n  return 'Hello World';\\n}",
          expectedCode: "function getHelloWorld() {\\n  return 'Hello World';\\n}"
        }
      ],
      activeAttempts: {},
      activeChallenge: null,
      activeVariant: null,
      userCode: '',
      sessionData: null,
      timeLimit: 0,
      lastDiffs: []
    };

    saveData();
    showMessage("Success", "Data has been reset to defaults. The page will now reload.");
    setTimeout(() => window.location.reload(), 1200);
  });
}