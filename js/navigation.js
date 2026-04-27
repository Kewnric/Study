/* ============================================================
   NAVIGATION.JS — Theme Toggle, Sidebar + Navigation Helpers
   ============================================================ */

// --- Sidebar Toggle ---
function toggleSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('expanded');
    // Save state so it stays open/closed as the user browses
    localStorage.setItem('sidebarExpanded', sidebar.classList.contains('expanded'));
  }
}

const THEMES = ['dark', 'light', 'purple', 'green'];

function toggleTheme() {
  const root = document.documentElement;
  
  root.classList.add('theme-transitioning');
  
  const currentTheme = root.getAttribute('data-theme') || 'dark';
  let nextIndex = THEMES.indexOf(currentTheme) + 1;
  if (nextIndex >= THEMES.length) nextIndex = 0;
  const newTheme = THEMES[nextIndex];
  
  root.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);

  updateThemeIcon(newTheme);
  
  setTimeout(() => {
    root.classList.remove('theme-transitioning');
  }, 600);
}

function updateThemeIcon(theme) {
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    let iconName = 'moon'; // default for dark
    if (theme === 'light') iconName = 'sun';
    else if (theme === 'purple') iconName = 'sparkles';
    else if (theme === 'green') iconName = 'leaf';
    
    themeIcon.setAttribute('data-lucide', iconName);
    if (window.lucide) {
      lucide.createIcons();
    }
  }
}

function initTheme() {
  // 1. Suppress all entry animations during initial page paint
  document.body.classList.add('no-entry-animation');

  // 2. Init Theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  // 3. Init Sidebar State — suppress transition to prevent layout jump
  const sidebar = document.querySelector('.app-sidebar');
  if (sidebar) {
    sidebar.classList.add('no-transition');
    if (localStorage.getItem('sidebarExpanded') === 'true') {
      sidebar.classList.add('expanded');
    }
  }

  // 4. Re-enable transitions and animations after first paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (sidebar) sidebar.classList.remove('no-transition');
      document.body.classList.remove('no-entry-animation');
    });
  });
}

// --- Nav Active State ---
function setActiveNav(page) {
  document.querySelectorAll('.sidebar-link').forEach(el => {
    el.classList.remove('active');
  });
  const activeEl = document.getElementById('nav-' + page);
  if (activeEl) activeEl.classList.add('active');
}

// --- Page Navigation Helper ---
function navigateTo(page) {
  const pageMap = {
    'home': 'index.html',
    'browse': 'browse.html',
    'admin': 'admin.html',
    'analytics': 'analytics.html',
    'practice': 'practice.html',
    'solution': 'solution.html',
    'study': 'study.html'
  };
  window.location.href = pageMap[page] || 'index.html';
}

// --- Unsaved Changes Interceptor ---
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const dest = link.getAttribute('href');
      if (!dest || dest === '#' || dest.startsWith('javascript:')) return;
      
      if (window.adminIsDirty) {
        e.preventDefault();
        showUnsavedConfirm(
          () => {
            window.adminIsDirty = false;
            window.location.href = dest;
          },
          () => {
            if (window.saveCurrentAdminForm) {
              const success = window.saveCurrentAdminForm({ silent: true });
              if (success === false) return; // Validation failed, do not navigate
            }
            window.adminIsDirty = false;
            window.location.href = dest;
          }
        );
      }
    });
  });
});
