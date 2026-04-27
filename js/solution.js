/* ============================================================
   SOLUTION.JS — Character-Level Diff View Rendering
   With Selective Diff Overlay (Feature 2)
   ============================================================ */

function initSolution() {
  const diffs = getSessionParam('lastDiffs');
  if (!diffs || diffs.length === 0) {
    window.location.href = 'index.html';
    return;
  }

  const backType = getSessionParam('solutionBack') || 'practice';

  const backBtn = document.getElementById('solution-back-btn');
  if (backType === 'analytics') {
    backBtn.onclick = () => window.location.href = 'analytics.html';
    backBtn.innerHTML = '<i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to History';
  } else {
    backBtn.onclick = () => window.location.href = 'practice.html';
    backBtn.innerHTML = '<i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to Practice';
  }

  renderDiffPanels(diffs);
  lucide.createIcons();
}

function renderCharSpans(chars, fallbackText) {
  if (!chars || chars.length === 0) {
    if (fallbackText) {
      return `<span class="diff-char-wrong">${escapeHTML(fallbackText)}</span>`;
    }
    return '<span class="diff-char-neutral">&nbsp;</span>';
  }

  let html = '';
  let currentStatus = null;
  let buffer = '';

  // Group consecutive same-status chars for cleaner HTML
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const status = c.status || 'neutral';

    if (status !== currentStatus) {
      if (buffer) {
        html += `<span class="diff-char-${currentStatus}">${escapeHTML(buffer)}</span>`;
      }
      currentStatus = status;
      buffer = c.char;
    } else {
      buffer += c.char;
    }
  }

  if (buffer) {
    html += `<span class="diff-char-${currentStatus}">${escapeHTML(buffer)}</span>`;
  }

  return html;
}

function renderDiffPanels(diffs) {
  const actualContainer = document.getElementById('diff-actual');
  const expectedContainer = document.getElementById('diff-expected');

  let actualHTML = '';
  let expectedHTML = '';

  diffs.forEach((line, i) => {
    const lineStatus = line.status;

    // --- LAZY CHAR DIFF COMPUTATION ---
    // Only compute the heavy character highlighting logic right before rendering
    if (!line.actualChars && !line.expectedChars) {
      if (lineStatus === 'partial' || lineStatus === 'wrong') {
        const charResult = computeCharDiffs(line.actual || '', line.expected || '');
        line.actualChars = charResult.actualChars;
        line.expectedChars = charResult.expectedChars;
      } else if (lineStatus === 'perfect') {
        line.actualChars = (line.actual || '').split('').map(c => ({ char: c, status: 'match' }));
      } else if (lineStatus === 'extra') {
        line.actualChars = (line.actual || '').split('').map(c => ({ char: c, status: 'wrong' }));
      } else if (lineStatus === 'missing') {
        line.expectedChars = (line.expected || '').split('').map(c => ({ char: c, status: 'missing' }));
      }
    }
    // ----------------------------------

    // ────────────────────────────────────────────
    // ACTUAL PANEL (Your Submission)
    // ────────────────────────────────────────────
    if (lineStatus === 'missing') {
      actualHTML += `
        <div class="diff-line missing">
          <span class="diff-line-number">${i + 1}</span>
          <span class="diff-line-content diff-char-placeholder">— missing —</span>
        </div>
      `;
    } else {
      const charHTML = line.actualChars
        ? renderCharSpans(line.actualChars)
        : `<span class="diff-char-neutral">${escapeHTML(line.actual || '')}</span>`;

      actualHTML += `
        <div class="diff-line ${lineStatus}">
          <span class="diff-line-number">${i + 1}</span>
          <span class="diff-line-content">${charHTML || '&nbsp;'}</span>
        </div>
      `;
    }

    // ────────────────────────────────────────────
    // EXPECTED PANEL (Correct Solution)
    // ────────────────────────────────────────────
    if (lineStatus === 'extra') {
      expectedHTML += `
        <div class="diff-line extra-expected">
          <span class="diff-line-number">${i + 1}</span>
          <span class="diff-line-content diff-char-placeholder">— extra line —</span>
        </div>
      `;
    } else if (lineStatus === 'perfect') {
      const syntaxHTML = typeof syntaxHighlight === 'function'
        ? syntaxHighlight(line.expected || '')
        : escapeHTML(line.expected || '');

      expectedHTML += `
        <div class="diff-line perfect">
          <span class="diff-line-number">${i + 1}</span>
          <span class="diff-line-content">${syntaxHTML || '&nbsp;'}</span>
        </div>
      `;
    } else {
      const charHTML = line.expectedChars
        ? renderCharSpans(line.expectedChars)
        : `<span class="diff-char-neutral">${escapeHTML(line.expected || '')}</span>`;

      expectedHTML += `
        <div class="diff-line expected-highlight ${lineStatus}">
          <span class="diff-line-number">${i + 1}</span>
          <span class="diff-line-content">${charHTML || '&nbsp;'}</span>
        </div>
      `;
    }
  });

  actualContainer.innerHTML = actualHTML;
  expectedContainer.innerHTML = expectedHTML;
}
