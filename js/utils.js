/* ============================================================
   UTILS.JS — Utility Functions
   ============================================================ */

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatTimeDisplay(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function calculateSimilarity(s1, s2) {
  // Quick equality checks first
  if (s1.trim() === s2.trim()) return 0.95;
  if (s1.replace(/\s/g, '') === s2.replace(/\s/g, '')) return 0.9;

  // Character-level LCS ratio for partial match detection
  const a = s1.replace(/\s/g, '');
  const b = s2.replace(/\s/g, '');
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Optimized 2-row LCS for memory efficiency
  const n = a.length, m = b.length;
  let prev = new Array(m + 1).fill(0);
  let curr = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  const lcsLen = prev[m];
  return (2 * lcsLen) / (a.length + b.length);
}

// Custom Rich Text + Markdown Support
function formatRichText(text) {
  if (!text) return '';
  // 1. Parse markdown if the library is loaded, otherwise fallback to escapeHTML
  let html = typeof marked !== 'undefined' ? marked.parse(text) : escapeHTML(text);

  // 2. Keep your custom color syntax: [[color:text]] → <span style="color: color;">text</span>
  html = html.replace(/\[\[([^:]+):(.*?)\]\]/g, '<span style="color: $1;">$2</span>');
  return html;
}

// Sample text: auto-highlight before colon + rich text
function formatSampleText(text) {
  if (!text) return '';
  let html = escapeHTML(text);
  html = html.replace(/^([^:\n]+):/gm, '<span class="sample-label">$1:</span>');
  html = html.replace(/\[\[([^:]+):(.*?)\]\]/g, '<span style="color: $1;">$2</span>');
  return html;
}

// Fuzzy Match (Subsequence Matching)
function fuzzyMatch(str, pattern) {
  if (!pattern) return true;
  str = str.toLowerCase();
  pattern = pattern.toLowerCase();

  if (str.includes(pattern)) return true;

  let patternIdx = 0;
  let strIdx = 0;
  while (patternIdx < pattern.length && strIdx < str.length) {
    if (pattern[patternIdx] === str[strIdx]) {
      patternIdx++;
    }
    strIdx++;
  }
  return patternIdx === pattern.length;
}
