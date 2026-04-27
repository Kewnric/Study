/* ============================================================
   HOME.JS — Dashboard Homepage Rendering
   ============================================================ */

// Local date helper — avoids UTC timezone shift from toISOString()
const _toLocalDate = (d) => {
  const dt = new Date(d);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
};

window.addEventListener('DOMContentLoaded', () => {
  loadData();
  initTheme();
  renderHomeDashboard();
  lucide.createIcons();
});

async function renderHomeDashboard() {
  renderHeroSection();
  renderStatsRow();
  renderHomeHeatmap();
  renderQuickActions();
  renderNotebookCarousel();
  renderHomeSRS();
  renderRecentActivity();
  lucide.createIcons();

  // Stagger cell animations on heatmap
  document.querySelectorAll('.home-heatmap .heatmap-cell').forEach((cell, i) => {
    cell.style.animationDelay = `${Math.min(i * 2, 800)}ms`;
  });
}

const BIBLE_VERSES = [
  "I can do all things through Christ who strengthens me. — Philippians 4:13",
  "Trust in the LORD with all your heart and lean not on your own understanding. — Proverbs 3:5",
  "For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future. — Jeremiah 29:11",
  "Be strong and courageous. Do not be afraid; do not be discouraged, for the LORD your God will be with you wherever you go. — Joshua 1:9",
  "The LORD is my shepherd, I lack nothing. — Psalm 23:1",
  "But those who hope in the LORD will renew their strength. They will soar on wings like eagles. — Isaiah 40:31",
  "Cast all your anxiety on him because he cares for you. — 1 Peter 5:7",
  "And we know that in all things God works for the good of those who love him. — Romans 8:28",
  "Let all that you do be done in love. — 1 Corinthians 16:14",
  "Your word is a lamp for my feet, a light on my path. — Psalm 119:105"
];

/* ======================== HERO ======================== */
function renderHeroSection() {
  const hour = new Date().getHours();
  let greeting;
  if (hour < 5)       greeting = 'Burning the midnight oil.';
  else if (hour < 12) greeting = 'Good morning.';
  else if (hour < 17) greeting = 'Good afternoon.';
  else if (hour < 21) greeting = 'Good evening.';
  else                greeting = 'Burning the midnight oil.';

  const subtitle = 'Welcome back Kenric and Kim.';
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const greetEl = document.getElementById('hero-greeting');
  const subEl   = document.getElementById('hero-subtitle');
  const dateEl  = document.getElementById('hero-date');
  const verseEl = document.getElementById('hero-verse');

  if (dateEl) dateEl.textContent = dateStr;

  // Random Bible Verse
  let randomVerse = "";
  if (verseEl) {
    randomVerse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];
    // Clear it out initially for the fade-in effect
    verseEl.textContent = '';
    verseEl.classList.remove('animate-fade-in');
  }

  // MiSide typing animations
  const greetAnimator = new TextAnimator(greetEl, {
    speed: 20, blur: true, glow: false, chromatic: false, cursor: true,
    onComplete: () => {
      greetAnimator.removeCursor();
      const subAnimator = new TextAnimator(subEl, {
        speed: 15, blur: true, glow: false, chromatic: false, cursor: true,
        onComplete: () => { 
          subAnimator.removeCursor(); 
          if (verseEl && randomVerse) {
            const verseAnimator = new TextAnimator(verseEl, {
              speed: 15, blur: true, glow: false, chromatic: false, cursor: false
            });
            verseAnimator.type(randomVerse);
          }
        }
      });
      subAnimator.type(subtitle);
    }
  });
  greetAnimator.type(greeting);
}

/* ======================== STATS ======================== */
function renderStatsRow() {
  const container = document.getElementById('home-stats');
  if (!container) return;

  const totalChallenges = state.challenges.length;
  const bestScore = state.history.length > 0
    ? Math.max(...state.history.map(h => h.score))
    : 0;

  // Streak: count consecutive days with activity ending today
  const streak = calculateStreak();
  const badgeCount = (state.badges || []).length;

  container.innerHTML = `
    <div class="home-stat-card">
      <div class="stat-icon"><i data-lucide="code"></i></div>
      <div class="stat-value" id="stat-challenges">0</div>
      <div class="stat-label">Programs</div>
    </div>
    <div class="home-stat-card">
      <div class="stat-icon"><i data-lucide="target"></i></div>
      <div class="stat-value" id="stat-best" data-suffix="%">0</div>
      <div class="stat-label">Best Score</div>
    </div>
    <div class="home-stat-card">
      <div class="stat-icon"><i data-lucide="flame"></i></div>
      <div class="stat-value" id="stat-streak">0</div>
      <div class="stat-label">Day Streak</div>
    </div>
    <div class="home-stat-card">
      <div class="stat-icon"><i data-lucide="award"></i></div>
      <div class="stat-value" id="stat-badges">0</div>
      <div class="stat-label">Badges</div>
    </div>
  `;
  lucide.createIcons();

  // Animate counters after a short delay
  setTimeout(() => {
    animateCounter(document.getElementById('stat-challenges'), totalChallenges, 900);
    animateCounter(document.getElementById('stat-best'), bestScore, 1100);
    animateCounter(document.getElementById('stat-streak'), streak, 800);
    animateCounter(document.getElementById('stat-badges'), badgeCount, 700);
  }, 400);
}

function calculateStreak() {
  if (state.history.length === 0) return 0;
  const daySet = new Set();
  state.history.forEach(h => {
    daySet.add(_toLocalDate(h.startTime));
  });
  const sorted = [...daySet].sort().reverse();
  const today = _toLocalDate(new Date());
  if (sorted[0] !== today) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (prev - curr) / (1000 * 60 * 60 * 24);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

/* ======================== HEATMAP ======================== */
function renderHomeHeatmap() {
  const container = document.getElementById('home-heatmap');
  if (!container) return;

  const activityMap = {};
  state.history.forEach(log => {
    const d = _toLocalDate(log.startTime);
    activityMap[d] = (activityMap[d] || 0) + 1;
  });

  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setDate(today.getDate() - 364);

  const startDow = oneYearAgo.getDay();
  let cells = '';
  for (let p = 0; p < startDow; p++) {
    cells += `<div class="heatmap-cell" data-level="0" style="opacity:0;"></div>`;
  }
  for (let i = 0; i < 365; i++) {
    const d = new Date(oneYearAgo);
    d.setDate(d.getDate() + i);
    const ds = _toLocalDate(d);
    const c = activityMap[ds] || 0;
    let lv = 0;
    if (c === 1) lv = 1;
    else if (c === 2) lv = 2;
    else if (c >= 3 && c <= 4) lv = 3;
    else if (c > 4) lv = 4;
    cells += `<div class="heatmap-cell" data-level="${lv}" title="${ds}: ${c} submissions"></div>`;
  }

  container.innerHTML = `
    <div class="home-card-header"><i data-lucide="calendar"></i> Contribution Heatmap</div>
    <div class="home-heatmap" style="overflow-x:auto;">
      <div class="heatmap-grid">${cells}</div>
    </div>
  `;
}

/* ======================== QUICK ACTIONS ======================== */
function renderQuickActions() {
  const container = document.getElementById('home-actions');
  if (!container) return;

  container.innerHTML = `
    <div class="home-card-header"><i data-lucide="zap"></i> Quick Actions</div>
    <div class="home-quick-actions">
      <a href="browse.html" class="quick-action-card">
        <div class="quick-action-icon"><i data-lucide="layout-template"></i></div>
        <div>
          <div class="quick-action-label">Coding Library</div>
          <div class="quick-action-desc">Explore challenge programs</div>
        </div>
      </a>
      <a href="study.html" class="quick-action-card">
        <div class="quick-action-icon"><i data-lucide="book-open"></i></div>
        <div>
          <div class="quick-action-label">Notes Library</div>
          <div class="quick-action-desc">Snippets & notebooks</div>
        </div>
      </a>
      <a href="analytics.html" class="quick-action-card">
        <div class="quick-action-icon"><i data-lucide="bar-chart-3"></i></div>
        <div>
          <div class="quick-action-label">Analytics</div>
          <div class="quick-action-desc">View your history</div>
        </div>
      </a>
      <a href="admin.html" class="quick-action-card">
        <div class="quick-action-icon"><i data-lucide="settings"></i></div>
        <div>
          <div class="quick-action-label">Admin Panel</div>
          <div class="quick-action-desc">Manage content</div>
        </div>
      </a>
    </div>
  `;
}

/* ======================== SRS ======================== */
function renderHomeSRS() {
  const container = document.getElementById('home-srs');
  if (!container) return;

  const bestScores = {};
  state.history.forEach(log => {
    if (!bestScores[log.challengeId] || log.score > bestScores[log.challengeId].score) {
      bestScores[log.challengeId] = log;
    }
  });

  const queue = Object.values(bestScores)
    .filter(l => l.score < 100)
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);

  let itemsHtml;
  if (queue.length === 0) {
    itemsHtml = `<div style="color:var(--text-tertiary); font-size:0.8125rem; text-align:center; padding:1rem;">All caught up! No reviews needed.</div>`;
  } else {
    itemsHtml = queue.map(log => {
      const ch = state.challenges.find(c => c.id === log.challengeId);
      if (!ch) return '';
      return `
        <div class="home-srs-item" onclick="window.location.href='browse.html'">
          <span class="home-srs-title">${escapeHTML(ch.title)}</span>
          <span class="home-srs-score">${log.score}%</span>
        </div>
      `;
    }).join('');
  }

  container.innerHTML = `
    <div class="home-card-header" style="color:var(--color-warning);"><i data-lucide="brain"></i> Review Queue</div>
    ${itemsHtml}
  `;
}

/* ======================== RECENT ACTIVITY ======================== */
function renderRecentActivity() {
  const container = document.getElementById('home-activity');
  if (!container) return;

  const recent = state.history.slice(0, 6);

  let itemsHtml;
  if (recent.length === 0) {
    itemsHtml = `<div style="color:var(--text-tertiary); font-size:0.8125rem; text-align:center; padding:1rem;">No activity yet. Start practicing!</div>`;
  } else {
    itemsHtml = recent.map((log, i) => {
      const ch = state.challenges.find(c => c.id === log.challengeId);
      const title = ch ? ch.title : 'Unknown';
      const dotClass = log.score >= 100 ? 'perfect' : log.score >= 50 ? 'partial' : 'low';
      const scoreClass = dotClass;
      const timeAgo = getTimeAgo(log.startTime);
      return `
        <div class="home-activity-item" style="animation-delay:${i * 0.08}s">
          <div class="activity-dot ${dotClass}"></div>
          <div class="activity-info">
            <div class="activity-title">${escapeHTML(title)}</div>
            <div class="activity-meta">${timeAgo}</div>
          </div>
          <div class="activity-score ${scoreClass}">${log.score}%</div>
        </div>
      `;
    }).join('');
  }

  container.innerHTML = `
    <div class="home-card-header"><i data-lucide="activity"></i> Recent Activity</div>
    ${itemsHtml}
  `;
}

function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/* ======================== CAROUSEL ======================== */
let notebookCarouselIndex = 0;

function renderNotebookCarousel() {
  const container = document.getElementById('home-notebook-carousel');
  if (!container) return;

  if (!state.notebooks || state.notebooks.length === 0) {
    container.innerHTML = '';
    return;
  }

  const notebooks = state.notebooks;
  const displayNotebooks = notebooks;
  
  if (notebookCarouselIndex >= displayNotebooks.length) notebookCarouselIndex = 0;
  if (notebookCarouselIndex < 0) notebookCarouselIndex = displayNotebooks.length - 1;

  const slidesHTML = displayNotebooks.map((nb, idx) => {
    let className = 'carousel-slide';
    if (idx === notebookCarouselIndex) className += ' active';
    else if (idx === (notebookCarouselIndex - 1 + displayNotebooks.length) % displayNotebooks.length) className += ' prev';
    else if (idx === (notebookCarouselIndex + 1) % displayNotebooks.length) className += ' next';

    const bgGradient = `linear-gradient(135deg, var(--bg-surface-hover) 0%, var(--bg-body) 100%)`;
    
    return `
      <div class="${className}" onclick="selectNotebookFromCarousel('${nb.id}')">
        <div class="carousel-slide-bg" style="background: ${bgGradient}"></div>
        <div class="carousel-slide-content">
          <div class="carousel-badge">
            <i data-lucide="book"></i> NOTEBOOK
          </div>
          <div class="carousel-item-title">${escapeHTML(nb.title)}</div>
          <div class="carousel-item-subtitle">${(nb.sections || []).length} SECTIONS AVAILABLE</div>
        </div>
      </div>
    `;
  }).join('');

  const dotsHTML = displayNotebooks.map((_, idx) => `
    <div class="carousel-dot ${idx === notebookCarouselIndex ? 'active' : ''}" onclick="jumpToNotebookCarousel(${idx})"></div>
  `).join('');

  container.innerHTML = `
    <div class="premium-carousel-container">
      <div class="carousel-title-main">
        <i data-lucide="sparkles" style="width:16px;height:16px;color:var(--color-primary);"></i>
        Notebooks
        <i data-lucide="sparkles" style="width:16px;height:16px;color:var(--color-primary);"></i>
      </div>
      <div class="carousel-viewport">
        <button class="carousel-nav-btn prev-btn" onclick="prevNotebookCarousel(event)">
          <i data-lucide="chevron-left"></i>
        </button>
        <div class="carousel-track">
          ${slidesHTML}
        </div>
        <button class="carousel-nav-btn next-btn" onclick="nextNotebookCarousel(event)">
          <i data-lucide="chevron-right"></i>
        </button>
      </div>
      <div class="carousel-indicators">
        ${dotsHTML}
      </div>
    </div>
  `;
}

window.nextNotebookCarousel = function(e) {
  if(e) e.stopPropagation();
  notebookCarouselIndex = (notebookCarouselIndex + 1) % state.notebooks.length;
  renderNotebookCarousel();
  lucide.createIcons();
};

window.prevNotebookCarousel = function(e) {
  if(e) e.stopPropagation();
  notebookCarouselIndex = (notebookCarouselIndex - 1 + state.notebooks.length) % state.notebooks.length;
  renderNotebookCarousel();
  lucide.createIcons();
};

window.jumpToNotebookCarousel = function(idx) {
  notebookCarouselIndex = idx;
  renderNotebookCarousel();
  lucide.createIcons();
};

window.selectNotebookFromCarousel = function(id) {
  setSessionParam('activeNotebook', id);
  setSessionParam('studyTab', 'notes');
  window.location.href = 'study.html';
};

