/* ============================================================
   TUTORIAL.JS — Guided Tutorial Spotlight System
   ============================================================ */

const GuidedTutorial = (function () {
  let overlay, spotlight, tooltip, welcome, completeScreen;
  let steps = [];
  let currentStep = 0;
  let currentPageId = '';
  let isActive = false;
  let typewriterTimer = null;
  let previousHighlighted = null;

  // ── Shared sidebar steps (appended to pages with sidebar) ──
  const SIDEBAR_STEPS = [
    { selector: '.sidebar-toggle-btn', message: "Need more room? Collapse the sidebar to focus on code, or expand it to see full labels.", title: 'Toggle Sidebar' },
    { selector: '#brand-link', message: "Clicking the logo always brings you back to your main Dashboard.", title: 'Brand Link' },
    { selector: '.sidebar-bottom button[onclick*="toggleTheme"]', message: "Switch to Dark Mode for those late-night sessions to save your eyes.", title: 'Theme Toggle' },
    { selector: '#export-btn-sidebar', message: "Your data is yours. Click here to download your entire library and history as a JSON file.", title: 'Export Data' },
    { selector: '#import-input', message: "Already have a library file? Upload it here to restore your progress or load a new set of challenges.", title: 'Import Data', parentSelector: true },
    { selector: '.sidebar-bottom button[onclick*="handleDataReset"]', message: "The 'Nuclear Option.' This wipes everything and starts you from scratch. Use with caution!", title: 'Reset Data' },
  ];

  // ── Page step definitions ──
  const PAGE_STEPS = {
    dashboard: [
      { selector: '#hero-greeting', message: "I customize this based on the time of day. It's your personal welcome back!", title: 'Greeting' },
      { selector: '#home-stats', message: "Here is your high-level overview: Total wins, average accuracy, and your longest streak.", title: 'Stats Grid' },
      { selector: '#home-heatmap', message: "This tracks your daily consistency. Darker squares mean you were extra productive those days.", title: 'Heatmap' },
      { selector: '#home-notebook-carousel', message: "Your recently accessed notebooks live here for quick jumping back into study sessions.", title: 'Carousel' },
    ],
    browse: [
      { selector: '#browse-search', message: "Looking for something specific? Start typing keywords or tags to filter challenges in real-time.", title: 'Search Bar' },
      { selector: '#browse-category-list', message: "Navigate your folders here. Folders can be nested; click the chevron to expand or collapse subcategories.", title: 'Folder Tree' },
      { selector: '#tree-context-menu', message: "Right-click any folder to Rename it, Move it to another folder, or Delete it entirely.", title: 'Folder Right-Click', virtual: true },
      { selector: '.tree-node-lock', message: "If you see a lock, it means you need more 'wins' in a prerequisite category before this folder opens.", title: 'Lock Icon', optional: true },
      { selector: '.challenge-card', message: "Select a program to view its description. Click 'Practice' to choose the 'Version' you want to try.", title: 'Program Selection', optional: true, action: () => { if(window.selectChallenge) window.selectChallenge('default_challenge_1'); } },
      { selector: '#timer-h', message: "Want to simulate an interview? Set a time limit here. Leave it at 0:0:0 for an untimed practice session.", title: 'Timer Inputs', virtual: true },
    ],
    practice: [
      { selector: '.practice-sidebar', message: "Always check the requirements here first. Review the logic constraints and sample test cases before you start.", title: 'Description Pane' },
      { selector: '#editor-textarea', message: "This is your main stage. Type your logic here — I'll handle the syntax highlighting and auto-indenting for you.", title: 'Code Editor' },
      { selector: '#practice-timer', message: "Watch your pace here. If you set a limit, it will count down (and turn red when low); otherwise, it tracks total time spent.", title: 'Timer Display' },
      { selector: '#submit-btn', message: "The moment of truth. When finished, I'll run a line-by-line diff-comparison between your code and the correct solution.", title: 'Submit Button' },
    ],
    study: [
      { selector: '.study-tab', message: "Toggle between 'Notes' for multiple-choice notebooks and 'Snippets' for code logic.", title: 'Notes vs Snippets' },
      { selector: '#notes-sections-area', message: "Notes are organized into sections. Read the content and answer the MCQs to test your knowledge.", title: 'Notebook Sections', optional: true, action: () => { if(window.notesSelectNotebook) window.notesSelectNotebook('default_notebook_1'); } },
      { selector: '.ql-editor', message: "Deep-dive into the logic here. These descriptions often contain formatted instructions and core concepts.", title: 'Rich Text Area', optional: true, action: () => { if(window.selectSnippet) { const tab = document.getElementById('admin-subtab-snippets') || document.querySelector('.study-tab:not(.active)'); if(tab) tab.click(); window.selectSnippet('default_snippet_1'); } } },
      { selector: '#try-coding-btn', message: "This is a sandbox. You can type the snippet from memory to test your knowledge without the pressure of a full session.", title: 'Try Coding', optional: true },
      { selector: '#related-challenges-btn', message: "I've linked this snippet to actual coding challenges where you can apply this specific logic in a real session.", title: 'Related Challenges', optional: true },
    ],
    admin: [
      { selector: '#admin-toggles', message: "Choose whether you are editing 'Notes Mode' notebooks/snippets or 'Coding Mode' challenges.", title: 'Mode Toggle' },
      { selector: '#new-program-btn', message: "Starting a new item? Click here to open the creation form.", title: 'New Item', action: () => { 
        if(window.currentAdminMode === 'practice' && window.openAdminForm) window.openAdminForm();
        else if(window.currentAdminMode === 'study' && window.currentAdminStudyTab === 'snippets' && window.openStudyForm) window.openStudyForm();
        else if(window.currentAdminMode === 'study' && window.currentAdminStudyTab === 'notes' && window.openNotebookForm) window.openNotebookForm();
      } },
      { selector: '#admin-title', message: "Give your challenge a name and assign it to a folder to organize your library.", title: 'Title & Category', optional: true },
      { selector: '#admin-tag-input', message: "Add tags like 'Easy' or 'Recursion' to help users filter the library efficiently.", title: 'Tags Input', optional: true },
      { selector: '.variant-tab', message: "One challenge can have many versions (e.g., Python vs. JavaScript). Manage those different logic sets here.", title: 'Variant Tabs', optional: true },
      { selector: '#admin-lock-rules', message: "Gamify the experience! Set rules so that categories only unlock after completing a certain number of prerequisite challenges.", title: 'Lock Rules' },
    ],
    analytics: [
      { selector: '#analytics-sidebar-content', message: "Every attempt you've ever made is logged here. Select one to see exactly what you wrote during that session.", title: 'History List' },
      { selector: '#toggle-bulk-btn', message: "Need to clean up? Toggle this to select and delete multiple history entries at once.", title: 'Bulk Actions', optional: true },
    ],
    'notes-practice': [
      { selector: '#np-question-grid', message: "Click any number to jump directly to that question. White is unvisited, Blue is answered.", title: 'Question Grid' },
      { selector: '#np-bubbles-container', message: "Select your choice here. Your progress is saved automatically as you move between questions.", title: 'Answer Bubbles' },
      { selector: '#np-hint-btn', message: "Stuck? If the author provided a hint, this bulb will light up to give you a nudge.", title: 'Hint Button' },
    ],
  };

  // Pages that have the sidebar
  const SIDEBAR_PAGES = ['dashboard', 'browse', 'study', 'admin', 'analytics'];

  function getStepsForPage(pageId) {
    const pageSteps = (PAGE_STEPS[pageId] || []).slice();
    if (SIDEBAR_PAGES.includes(pageId)) {
      pageSteps.push(...SIDEBAR_STEPS);
    }
    return pageSteps;
  }

  function hasCompleted(pageId) {
    return localStorage.getItem('tutorial_done_' + pageId) === '1';
  }

  function markCompleted(pageId) {
    localStorage.setItem('tutorial_done_' + pageId, '1');
  }

  // ── DOM creation ──
  function createOverlayElements() {
    if (document.getElementById('tutorial-overlay')) return;

    // Spotlight
    spotlight = document.createElement('div');
    spotlight.className = 'tutorial-spotlight';
    spotlight.id = 'tutorial-spotlight';
    spotlight.style.display = 'none';
    document.body.appendChild(spotlight);

    // Tooltip
    tooltip = document.createElement('div');
    tooltip.className = 'tutorial-tooltip';
    tooltip.id = 'tutorial-tooltip';
    tooltip.innerHTML = `
      <div class="tutorial-tooltip-arrow"></div>
      <div class="tutorial-tooltip-header">
        <div class="tutorial-tooltip-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div>
        <span class="tutorial-tooltip-title"></span>
      </div>
      <div class="tutorial-tooltip-message"></div>
      <div class="tutorial-tooltip-footer">
        <span class="tutorial-progress-info"></span>
        <div class="tutorial-progress-bar-track"><div class="tutorial-progress-bar-fill"></div></div>
        <div class="tutorial-tooltip-controls">
          <button class="tutorial-btn tutorial-btn-prev" onclick="GuidedTutorial.prev()" title="Previous">◀</button>
          <button class="tutorial-btn tutorial-btn-next" onclick="GuidedTutorial.next()" title="Next">Next ▶</button>
          <button class="tutorial-btn tutorial-btn-skip" onclick="GuidedTutorial.skip()">Skip</button>
        </div>
      </div>
    `;
    document.body.appendChild(tooltip);

    // Click-to-advance overlay
    overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    overlay.id = 'tutorial-overlay';
    overlay.style.display = 'none';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) next();
    });
    document.body.appendChild(overlay);
  }

  function createWelcomeScreen(pageId, cb) {
    if (welcome) welcome.remove();
    welcome = document.createElement('div');
    welcome.className = 'tutorial-welcome';
    const pageName = pageId.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
    welcome.innerHTML = `
      <div class="tutorial-welcome-card">
        <div class="tutorial-welcome-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div>
        <div class="tutorial-welcome-title">Welcome to ${pageName}!</div>
        <div class="tutorial-welcome-desc">Let me show you around this page. I'll highlight each feature and explain what it does. You can click anywhere or press <kbd style="padding:2px 6px;background:var(--bg-surface-hover);border-radius:4px;font-size:0.8em;font-weight:600;">→</kbd> to advance.</div>
        <div class="tutorial-welcome-actions">
          <button class="btn tutorial-welcome-dismiss" onclick="GuidedTutorial.dismissWelcome(false)">Skip Tour</button>
          <button class="btn tutorial-welcome-start" onclick="GuidedTutorial.dismissWelcome(true)">Start Tour ✨</button>
        </div>
      </div>
    `;
    document.body.appendChild(welcome);
    requestAnimationFrame(() => requestAnimationFrame(() => welcome.classList.add('active')));
    welcome._cb = cb;
  }

  function dismissWelcome(shouldStart) {
    if (!welcome) return;
    welcome.classList.remove('active');
    const cb = welcome._cb;
    setTimeout(() => {
      if (welcome) welcome.remove();
      welcome = null;
      if (shouldStart && cb) cb();
      else markCompleted(currentPageId);
    }, 300);
  }

  // ── Spotlight positioning ──
  function getTargetEl(step) {
    if (step.virtual || !step.selector) return null;
    let el = document.querySelector(step.selector);
    if (!el) return null;
    if (step.parentSelector) el = el.closest('label') || el.parentElement || el;
    if (el.offsetParent === null && !step.optional) return null;
    return el;
  }

  function positionSpotlight(el) {
    const pad = 8;
    const rect = el.getBoundingClientRect();
    spotlight.style.display = 'block';
    spotlight.style.top = (rect.top - pad) + 'px';
    spotlight.style.left = (rect.left - pad) + 'px';
    spotlight.style.width = (rect.width + pad * 2) + 'px';
    spotlight.style.height = (rect.height + pad * 2) + 'px';
  }

  function positionTooltip(el) {
    const gap = 16;
    const rect = el.getBoundingClientRect();
    const tw = tooltip.offsetWidth || 360;
    const th = tooltip.offsetHeight || 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let pos = 'bottom';
    let top, left;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const spaceRight = vw - rect.right;
    const spaceLeft = rect.left;

    if (spaceBelow >= th + gap) {
      pos = 'bottom';
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tw / 2;
    } else if (spaceAbove >= th + gap) {
      pos = 'top';
      top = rect.top - th - gap;
      left = rect.left + rect.width / 2 - tw / 2;
    } else if (spaceRight >= tw + gap) {
      pos = 'right';
      top = rect.top + rect.height / 2 - th / 2;
      left = rect.right + gap;
    } else {
      pos = 'left';
      top = rect.top + rect.height / 2 - th / 2;
      left = rect.left - tw - gap;
    }

    // Clamp
    left = Math.max(12, Math.min(left, vw - tw - 12));
    top = Math.max(12, Math.min(top, vh - th - 12));

    tooltip.setAttribute('data-position', pos);
    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
  }

  // ── Typewriter effect ──
  function typeMessage(text, el, cb) {
    if (typewriterTimer) clearInterval(typewriterTimer);
    el.innerHTML = '';
    let i = 0;
    const cursor = document.createElement('span');
    cursor.className = 'tutorial-cursor';
    el.appendChild(cursor);

    typewriterTimer = setInterval(() => {
      if (i < text.length) {
        cursor.before(document.createTextNode(text[i]));
        i++;
      } else {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
        setTimeout(() => cursor.remove(), 600);
        if (cb) cb();
      }
    }, 18);
  }

  function finishTypewriter() {
    if (typewriterTimer) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
      const msgEl = tooltip.querySelector('.tutorial-tooltip-message');
      if (msgEl && steps[currentStep]) {
        msgEl.textContent = steps[currentStep].message;
      }
    }
  }

  // ── Show step ──
  function showStep(index) {
    // Clean previous
    if (previousHighlighted) {
      previousHighlighted.classList.remove('tutorial-highlighted');
      previousHighlighted = null;
    }
    tooltip.classList.remove('visible');

    // Skip steps whose elements don't exist
    let step = steps[index];
    let el = getTargetEl(step);
    while (!el && !step.virtual && index < steps.length - 1) {
      index++;
      step = steps[index];
      el = getTargetEl(step);
    }
    if (!el && !step.virtual) {
      finish();
      return;
    }
    currentStep = index;

    // Scroll into view
    if (el) {
      if (step.action) {
        try { step.action(); } catch (e) { console.error("Tutorial action failed:", e); }
      }
      // Wait briefly for action changes (like showing a tab) to render
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        setTimeout(() => renderStep(el, step), 350);
      }, 100);
    } else if (step.virtual) {
      if (step.action) {
        try { step.action(); } catch (e) { console.error("Tutorial action failed:", e); }
      }
      spotlight.style.display = 'none';
      renderVirtualStep(step);
    }
  }

  function renderStep(el, step) {
    // Highlight
    el.classList.add('tutorial-highlighted');
    previousHighlighted = el;

    positionSpotlight(el);

    // Update tooltip
    tooltip.querySelector('.tutorial-tooltip-title').textContent = step.title || 'Tip';
    tooltip.querySelector('.tutorial-progress-info').textContent = `${currentStep + 1} / ${steps.length}`;
    const pct = ((currentStep + 1) / steps.length) * 100;
    tooltip.querySelector('.tutorial-progress-bar-fill').style.width = pct + '%';

    // Prev button state
    const prevBtn = tooltip.querySelector('.tutorial-btn-prev');
    prevBtn.style.display = currentStep === 0 ? 'none' : '';

    // Next button text
    const nextBtn = tooltip.querySelector('.tutorial-btn-next');
    nextBtn.textContent = currentStep === steps.length - 1 ? 'Finish ✓' : 'Next ▶';

    // Position tooltip then type message
    requestAnimationFrame(() => {
      positionTooltip(el);
      tooltip.classList.add('visible');
      const msgEl = tooltip.querySelector('.tutorial-tooltip-message');
      typeMessage(step.message, msgEl);
    });
  }

  function renderVirtualStep(step) {
    // For steps where the element isn't visible (e.g. context menu, timer modal)
    // Center the tooltip on screen without a spotlight
    tooltip.querySelector('.tutorial-tooltip-title').textContent = step.title || 'Tip';
    tooltip.querySelector('.tutorial-progress-info').textContent = `${currentStep + 1} / ${steps.length}`;
    const pct = ((currentStep + 1) / steps.length) * 100;
    tooltip.querySelector('.tutorial-progress-bar-fill').style.width = pct + '%';

    const prevBtn = tooltip.querySelector('.tutorial-btn-prev');
    prevBtn.style.display = currentStep === 0 ? 'none' : '';
    const nextBtn = tooltip.querySelector('.tutorial-btn-next');
    nextBtn.textContent = currentStep === steps.length - 1 ? 'Finish ✓' : 'Next ▶';

    const tw = 380;
    const th = 220;
    tooltip.style.top = (window.innerHeight / 2 - th / 2) + 'px';
    tooltip.style.left = (window.innerWidth / 2 - tw / 2) + 'px';
    tooltip.setAttribute('data-position', 'bottom');
    tooltip.classList.add('visible');

    const msgEl = tooltip.querySelector('.tutorial-tooltip-message');
    typeMessage(step.message, msgEl);
  }

  // ── Navigation ──
  function next() {
    finishTypewriter();
    if (currentStep < steps.length - 1) {
      showStep(currentStep + 1);
    } else {
      finish();
    }
  }

  function prev() {
    finishTypewriter();
    if (currentStep > 0) {
      showStep(currentStep - 1);
    }
  }

  function skip() {
    finishTypewriter();
    finish();
  }

  function finish() {
    isActive = false;
    markCompleted(currentPageId);

    if (previousHighlighted) {
      previousHighlighted.classList.remove('tutorial-highlighted');
      previousHighlighted = null;
    }

    tooltip.classList.remove('visible');
    overlay.classList.remove('active');
    spotlight.style.display = 'none';

    setTimeout(() => {
      overlay.style.display = 'none';
      showCompletionScreen();
    }, 350);

    document.removeEventListener('keydown', handleKeyboard);
  }

  function showCompletionScreen() {
    if (completeScreen) completeScreen.remove();
    completeScreen = document.createElement('div');
    completeScreen.className = 'tutorial-complete-overlay';
    completeScreen.innerHTML = `
      <div class="tutorial-complete-card">
        <div class="tutorial-complete-icon">🎓</div>
        <div class="tutorial-complete-title">Tour Complete!</div>
        <div class="tutorial-complete-desc">You've seen all the highlights for this page. You can always replay this tour by clicking the <strong>?</strong> icon in the header.</div>
        <button class="tutorial-complete-btn" onclick="GuidedTutorial.closeComplete()">Got It!</button>
      </div>
    `;
    document.body.appendChild(completeScreen);
    requestAnimationFrame(() => requestAnimationFrame(() => completeScreen.classList.add('active')));
  }

  function closeComplete() {
    if (!completeScreen) return;
    completeScreen.classList.remove('active');
    setTimeout(() => {
      if (completeScreen) completeScreen.remove();
      completeScreen = null;
    }, 300);
  }

  // ── Keyboard ──
  function handleKeyboard(e) {
    if (!isActive) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      skip();
    }
  }

  // ── Start tutorial ──
  function startTutorial(force) {
    createOverlayElements();
    steps = getStepsForPage(currentPageId);
    if (steps.length === 0) return;
    currentStep = 0;
    isActive = true;

    overlay.style.display = 'block';
    requestAnimationFrame(() => overlay.classList.add('active'));
    document.addEventListener('keydown', handleKeyboard);

    showStep(0);
  }

  // ── Public init (called by each page) ──
  function init(pageId) {
    currentPageId = pageId;
    createOverlayElements();

    // Auto-show on first visit (slight delay so page renders)
    if (!hasCompleted(pageId)) {
      setTimeout(() => {
        createWelcomeScreen(pageId, () => startTutorial(false));
      }, 800);
    }
  }

  // ── Manual trigger ──
  function manualStart() {
    startTutorial(true);
  }

  // ── Resize handler ──
  window.addEventListener('resize', function () {
    if (!isActive || !previousHighlighted) return;
    positionSpotlight(previousHighlighted);
    positionTooltip(previousHighlighted);
  });

  // Public API
  return {
    init,
    start: manualStart,
    next,
    prev,
    skip,
    dismissWelcome,
    closeComplete,
  };
})();
