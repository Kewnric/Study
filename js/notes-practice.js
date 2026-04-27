/* ============================================================
   NOTES-PRACTICE.JS — MCQ Notebook Practice + Inline Review
   ============================================================ */

let activeNotebook = null;
let timeLimit = 0;
let timeRemaining = 0;
let timerInterval = null;
let practiceStartTime = null;

let currentSectionIdx = 0;
let currentQuestionNum = 1;

// Session tracking
let sessionAnswers = [];   // answers[secIdx][qNum] = 'A'
let sessionStatus = [];    // status[secIdx][qNum] = 'unopened'|'opened'|'answered'

// Review mode
let reviewMode = false;
let isCheckingAnswer = false; // Flag to lock UI during grading delay
let gradeResults = [];     // gradeResults[secIdx][qNum] = 'correct'|'wrong'|'skipped'
let answerKeys = [];       // answerKeys[secIdx] = { qNum: { answer: 'A', explanation: '...' }, ... }
let reviewRecord = null;   // The saved record for review

/* ----------------------------------------------------------
   INITIALIZATION
   ---------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  loadData();
  if (typeof lucide !== 'undefined') lucide.createIcons();

  let nbId = getSessionParam('activeNotebook');
  const reviewRecordId = getSessionParam('reviewNotebookRecordId');

  if (reviewRecordId && state.notebookHistory) {
    reviewRecord = state.notebookHistory.find(h => h.id === reviewRecordId);
    if (reviewRecord) {
      nbId = reviewRecord.notebookId;
      clearSessionParam('reviewNotebookRecordId');
    }
  }

  timeLimit = getSessionParam('notebookTimeLimit') || 0;

  if (!nbId || !state.notebooks) {
    window.location.href = 'study.html';
    return;
  }

  const origNb = (state?.notebooks ?? []).find(n => n.id === nbId);
  if (!origNb || !origNb.sections || origNb.sections.length === 0) {
    window.location.href = 'study.html';
    return;
  }

  // Clone to avoid mutating state when shuffling questions
  activeNotebook = JSON.parse(JSON.stringify(origNb));

  const titleEl = document.getElementById('np-notebook-title');
  if (titleEl) titleEl.textContent = activeNotebook.title;

  practiceStartTime = Date.now();
  initSessionState();
  initTimer();

  currentSectionIdx = 0;
  const firstSec = activeNotebook.sections[0];
  if (firstSec.questions && firstSec.questions.length > 0) {
    currentQuestionNum = firstSec.questions[0];
  }

  renderSidebar();
  renderQuestion();

  // Initialize theme selector
  const savedTheme = localStorage.getItem('theme') || 'dark';
  const selector = document.getElementById('theme-selector');
  if (selector) {
    selector.value = savedTheme;
  }

  if (reviewRecord) {
    enterReviewMode();
  }
});

function changeTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

document.addEventListener('click', () => {
  if (window.npQuestionAnimator && window.npQuestionAnimator._aborted === false && !window.npQuestionAnimator._forceComplete) {
    window.npQuestionAnimator.complete();
  }
});

function initSessionState() {
  sessionAnswers = [];
  sessionStatus = [];
  answerKeys = [];
  gradeResults = [];

  activeNotebook.sections.forEach((sec, idx) => {
    if (!reviewRecord && sec.questions) {
      sec.questions.sort(() => Math.random() - 0.5);
    }

    const ans = {};
    const st = {};
    const gr = {};
    (sec.questions || []).forEach(q => {
      ans[q] = reviewRecord ? (reviewRecord.sections[idx]?.answers?.[q] || null) : null;
      st[q] = 'unopened';
      gr[q] = reviewRecord ? (reviewRecord.sections[idx]?.answers?.[q] && reviewRecord.sections[idx]?.answers?.[q] === (reviewRecord.sections[idx]?.keyMap?.[q]?.answer) ? 'correct' : (reviewRecord.sections[idx]?.answers?.[q] ? 'wrong' : 'skipped')) : 'skipped';
    });
    sessionAnswers.push(ans);
    sessionStatus.push(st);
    gradeResults.push(gr);

    // Parse answer key
    const keyMap = {};
    if (sec.answerKeysData && sec.answerKeysData.length > 0) {
      sec.answerKeysData.forEach(d => {
        keyMap[d.qNum] = { answer: d.answer, explanation: d.explanation, question: d.question, hint: d.hint, choices: d.choices || {} };
      });
    } else {
      const keyText = (sec.answerKey || '').trim();
      keyText.split('\n').forEach(line => {
        const match = line.trim().match(/^(\d+)\s*[=:]\s*([A-Ea-e])$/);
        if (match) keyMap[parseInt(match[1])] = { answer: match[2].toUpperCase(), explanation: '' };
      });
    }
    answerKeys.push(keyMap);
  });
}

/* ----------------------------------------------------------
   TIMER
   ---------------------------------------------------------- */
function initTimer() {
  const display = document.getElementById('np-timer-display');
  if (!display) return;

  if (timeLimit <= 0) {
    timeRemaining = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      timeRemaining++;
      updateTimerDisplay();
    }, 1000);
    return;
  }

  timeRemaining = timeLimit;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    timeRemaining--;
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      timeRemaining = 0;
      updateTimerDisplay();
      if (typeof showMessage === 'function') {
        showMessage("Time's Up!", 'Your time has expired. Submitting automatically...', true);
      }
      setTimeout(() => npSubmitAttempt(true), 2000);
    } else {
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const display = document.getElementById('np-timer-display');
  if (!display) return;
  const m = Math.floor(timeRemaining / 60);
  const s = timeRemaining % 60;
  display.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');

  if (timeRemaining <= 60 && timeLimit > 0) {
    display.style.color = 'var(--color-danger)';
  }
}

/* ----------------------------------------------------------
   NAVIGATION
   ---------------------------------------------------------- */
function switchSection(idx) {
  currentSectionIdx = idx;
  const sec = activeNotebook.sections[idx];
  if (sec.questions && sec.questions.length > 0) {
    currentQuestionNum = sec.questions[0];
  } else {
    currentQuestionNum = null;
  }
  renderSidebar();
  renderQuestion();
}

function jumpToQuestion(qNum) {
  currentQuestionNum = qNum;
  renderSidebar();
  renderQuestion();
}

function npPrevQuestion() {
  const sec = activeNotebook.sections[currentSectionIdx];
  const qList = sec.questions || [];
  const idx = qList.indexOf(currentQuestionNum);
  if (idx > 0) {
    jumpToQuestion(qList[idx - 1]);
  } else if (currentSectionIdx > 0) {
    const prevSec = activeNotebook.sections[currentSectionIdx - 1];
    currentSectionIdx = currentSectionIdx - 1;
    const prevQList = prevSec.questions || [];
    if (prevQList.length > 0) {
      currentQuestionNum = prevQList[prevQList.length - 1];
    }
    renderSidebar();
    renderQuestion();
  }
}

function npNextQuestion() {
  const sec = activeNotebook.sections[currentSectionIdx];
  const qList = sec.questions || [];
  const idx = qList.indexOf(currentQuestionNum);
  if (idx < qList.length - 1) {
    jumpToQuestion(qList[idx + 1]);
  } else if (currentSectionIdx < activeNotebook.sections.length - 1) {
    switchSection(currentSectionIdx + 1);
  }
}

/* ----------------------------------------------------------
   ANSWER SELECTION (Practice Mode Only)
   ---------------------------------------------------------- */
function selectAnswer(letter) {
  if (reviewMode || currentQuestionNum === null || isCheckingAnswer) return;

  // If already answered, do not allow changing
  if (sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered') return;

  sessionAnswers[currentSectionIdx][currentQuestionNum] = letter;
  sessionStatus[currentSectionIdx][currentQuestionNum] = 'answered';

  const correctObj = answerKeys[currentSectionIdx][currentQuestionNum];
  const correctAns = correctObj ? correctObj.answer : null;
  const explanation = correctObj ? correctObj.explanation : '';

  isCheckingAnswer = true;
  renderSidebar();
  renderQuestion();

  if (letter === correctAns) {
    gradeResults[currentSectionIdx][currentQuestionNum] = 'correct';
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
    setTimeout(() => {
      isCheckingAnswer = false;
      renderSidebar();
      npNextQuestion();
    }, 1500);
  } else {
    gradeResults[currentSectionIdx][currentQuestionNum] = 'wrong';
    const hurtOverlay = document.getElementById('hurt-overlay');
    if (hurtOverlay) {
      hurtOverlay.classList.remove('hurt-active');
      void hurtOverlay.offsetWidth; // trigger reflow
      hurtOverlay.classList.add('hurt-active');
    }
    setTimeout(() => {
      isCheckingAnswer = false;
      renderSidebar();
      showWrongAnswerPopup(correctAns, explanation);
    }, 1500);
  }
}

function showWrongAnswerPopup(correctAns, explanation) {
  const dialogIcon = document.getElementById('dialog-icon');
  const dialogTitle = document.getElementById('dialog-title');
  const dialogMsg = document.getElementById('dialog-msg');
  const dialogActions = document.getElementById('dialog-actions');

  if (dialogIcon) dialogIcon.innerHTML = '<i data-lucide="x-circle" style="width:48px;height:48px;color:var(--color-danger);"></i>';
  if (dialogTitle) dialogTitle.textContent = 'Incorrect';
  if (dialogMsg) {
    dialogMsg.innerHTML = `
      <p style="margin-bottom: 0.5rem; color: var(--text-primary);"><strong>Correct Answer:</strong> ${correctAns || 'Not specified'}</p>
      ${explanation ? `<div style="background: #111111; color: #ffffff; padding: 1rem; border-radius: var(--radius-md); margin-top: 1rem; font-family: var(--font-mono); font-size: 0.875rem; text-align: left; border: 1px solid #333;"><strong style="color: var(--color-primary); margin-bottom: 0.5rem; display: block; font-family: var(--font-sans);">Explanation</strong>${escapeHTML(explanation).replace(/\n/g, '<br/>')}</div>` : ''}
    `;
  }
  if (dialogActions) {
    dialogActions.innerHTML = `
      <button onclick="closeWrongAnswerPopupAndNext()" class="btn btn-primary" style="width:100%;">Continue to Next Question</button>
    `;
  }

  const modal = document.getElementById('dialog-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function closeWrongAnswerPopupAndNext() {
  const modal = document.getElementById('dialog-modal');
  if (modal) modal.classList.add('hidden');
  npNextQuestion();
}

/* ----------------------------------------------------------
   RENDERING — SIDEBAR
   ---------------------------------------------------------- */
function renderSidebar() {
  const tabsContainer = document.getElementById('np-sections-tabs');
  if (!tabsContainer) return;

  tabsContainer.innerHTML = activeNotebook.sections.map((sec, idx) => {
    const isActive = idx === currentSectionIdx;

    // In review mode, show per-section score
    let scoreHtml = '';
    if (reviewMode) {
      const gr = gradeResults[idx];
      const qList = sec.questions || [];
      const correct = qList.filter(q => gr[q] === 'correct').length;
      const total = qList.length;
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      const color = pct === 100 ? '#10b981' : pct >= 70 ? '#fbbf24' : '#ef4444';
      scoreHtml = `<span style="font-size:0.6875rem; font-weight:700; color:${color}; margin-left:auto;">${correct}/${total}</span>`;
    } else {
      scoreHtml = `<span style="font-size:0.6875rem; opacity:0.6; margin-top:0.125rem;">${(sec.questions || []).length} Qs</span>`;
    }

    return `
      <button class="np-sidebar-tab-dark ${isActive ? 'active' : ''}" onclick="switchSection(${idx})">
        <div style="display:flex; align-items:center; gap:0.5rem; flex:1;">
          <span style="font-family:var(--font-mono); font-size:0.6875rem; opacity:0.5;">${String(idx + 1).padStart(2, '0')}</span>
          <span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHTML(sec.label)}
          </span>
        </div>
        ${scoreHtml}
      </button>
    `;
  }).join('');

  // Grid
  const sec = activeNotebook.sections[currentSectionIdx];
  const sectionTitle = document.getElementById('np-current-section-title');
  if (sectionTitle) sectionTitle.textContent = sec.label;

  const gridContainer = document.getElementById('np-question-grid');
  if (!gridContainer) return;

  gridContainer.innerHTML = (sec.questions || []).map(qNum => {
    let cls = 'np-grid-box';

    if (reviewMode) {
      const result = gradeResults[currentSectionIdx][qNum];
      if (result === 'correct') cls += ' review-correct';
      else if (result === 'wrong') cls += ' review-wrong';
      else cls += ' review-skipped';
    } else {
      const status = sessionStatus[currentSectionIdx][qNum];
      if (status === 'answered') {
        const result = gradeResults[currentSectionIdx][qNum];
        if (result === 'correct') cls += ' review-correct';
        else if (result === 'wrong') cls += ' review-wrong';
        else cls += ' answered';
      }
      else if (status === 'opened') cls += ' opened';
    }

    if (qNum === currentQuestionNum) cls += ' active';

    return `<button class="${cls}" onclick="jumpToQuestion(${qNum})">${qNum}</button>`;
  }).join('');
}

/* ----------------------------------------------------------
   RENDERING — QUESTION + BUBBLES
   ---------------------------------------------------------- */
function renderQuestion() {
  const heading = document.getElementById('np-q-heading');
  const reviewStatus = document.getElementById('np-review-status');

  if (currentQuestionNum === null) {
    document.getElementById('np-q-label').textContent = 'No Questions';
    document.getElementById('np-q-progress').textContent = '0 / 0';
    document.getElementById('np-bubbles-container').innerHTML = '<div style="color:#8b949e; font-size:0.875rem; text-align:center; padding:2rem;">This section has no questions configured.</div>';
    const btnPrev = document.getElementById('np-btn-prev');
    const btnNext = document.getElementById('np-btn-next');
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    if (heading) heading.textContent = 'No Questions';
    if (reviewStatus) reviewStatus.classList.add('hidden');
    return;
  }

  // Mark as opened if not answered (practice mode only)
  if (!reviewMode && sessionStatus[currentSectionIdx][currentQuestionNum] === 'unopened') {
    sessionStatus[currentSectionIdx][currentQuestionNum] = 'opened';
    renderSidebar();
  }

  const sec = activeNotebook.sections[currentSectionIdx];
  const qList = sec.questions || [];
  const idx = qList.indexOf(currentQuestionNum);

  document.getElementById('np-q-label').textContent = `Question ${currentQuestionNum}`;
  document.getElementById('np-q-progress').textContent = `${idx + 1} / ${qList.length}`;

  // Heading text
  if (reviewMode) {
    const result = gradeResults[currentSectionIdx][currentQuestionNum];
    if (result === 'correct') {
      heading.textContent = 'Correct!';
      heading.style.color = '#10b981';
    } else if (result === 'wrong') {
      heading.textContent = 'Incorrect';
      heading.style.color = '#ef4444';
    } else {
      heading.textContent = 'Skipped';
      heading.style.color = '#8b949e';
    }

    // Show review status details
    const userAns = sessionAnswers[currentSectionIdx][currentQuestionNum];
    const correctObj = answerKeys[currentSectionIdx][currentQuestionNum];
    const correctAns = correctObj ? correctObj.answer : null;
    let statusHtml = '';
    if (result === 'correct') {
      statusHtml = `<div class="np-review-badge np-review-badge-correct"><i data-lucide="check-circle-2" style="width:16px;height:16px;"></i> You answered ${userAns} — Correct!</div>`;
    } else if (result === 'wrong') {
      statusHtml = `<div class="np-review-badge np-review-badge-wrong"><i data-lucide="x-circle" style="width:16px;height:16px;"></i> You answered ${userAns || '—'} · Correct: ${correctAns || '?'}</div>`;
    } else {
      statusHtml = `<div class="np-review-badge np-review-badge-skipped"><i data-lucide="minus-circle" style="width:16px;height:16px;"></i> Not answered · Correct: ${correctAns || '?'}</div>`;
    }
    if (reviewStatus) {
      reviewStatus.innerHTML = statusHtml;
      reviewStatus.classList.remove('hidden');
    }
  } else {
    heading.textContent = 'Select your answer';
    heading.style.color = '#e6edf3';
    if (reviewStatus) reviewStatus.classList.add('hidden');
  }

  // Render bubbles
  const choices = sec.choices || 4;
  const letters = Array.from({ length: choices }, (_, i) => String.fromCharCode(65 + i));
  const selected = sessionAnswers[currentSectionIdx][currentQuestionNum];
  const correctObj = answerKeys[currentSectionIdx][currentQuestionNum];
  const correctAns = correctObj ? correctObj.answer : null;

  // Update Question Text & Hint Button
  const qTextDiv = document.getElementById('np-q-text');
  const hintBtn = document.getElementById('np-hint-btn');

  if (qTextDiv) {
    if (correctObj && correctObj.question && correctObj.question.trim() !== '') {
      const qTrackerId = currentSectionIdx + '-' + currentQuestionNum;
      if (qTextDiv.dataset.currentQId !== qTrackerId) {
        qTextDiv.dataset.currentQId = qTrackerId;
        qTextDiv.textContent = '';
        qTextDiv.classList.remove('hidden');
        if (window.npQuestionAnimator) {
          window.npQuestionAnimator.abort();
          window.npQuestionAnimator.removeCursor();
        }
        window.npQuestionAnimator = new TextAnimator(qTextDiv, {
          speed: 7, blur: true, glow: false, chromatic: false, cursor: true,
          onComplete: () => { window.npQuestionAnimator.removeCursor(); }
        });
        window.npQuestionAnimator.type(correctObj.question);
      }
    } else {
      qTextDiv.dataset.currentQId = '';
      qTextDiv.classList.add('hidden');
      if (window.npQuestionAnimator) {
        window.npQuestionAnimator.abort();
        window.npQuestionAnimator.removeCursor();
      }
    }
  }

  if (hintBtn) {
    if (correctObj && correctObj.hint && correctObj.hint.trim() !== '' && !reviewMode) {
      hintBtn.classList.remove('hidden');
    } else {
      hintBtn.classList.add('hidden');
    }
  }

  const bubblesContainer = document.getElementById('np-bubbles-container');
  if (!bubblesContainer) return;

  bubblesContainer.innerHTML = letters.map(letter => {
    let cls = 'ns-bubble'; // basic button class

    if (reviewMode) {
      cls += ' review-locked';
      if (letter === correctAns && selected === correctAns) {
        cls += ' review-correct';
      } else if (letter === selected && selected !== correctAns) {
        cls += ' review-wrong';
      } else if (letter === correctAns && selected !== correctAns) {
        cls += ' review-expected';
      }
    } else {
      if (selected === letter) {
        cls += ' selected';
        if (isCheckingAnswer) {
          if (letter === correctAns) cls += ' review-correct';
          else cls += ' review-wrong';
        }
      }
    }

    const choiceText = correctObj && correctObj.choices && correctObj.choices[letter] ? correctObj.choices[letter] : '';
    const onclick = (reviewMode || (sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered')) ? '' : `onclick="selectAnswer('${letter}')"`;

    return `
      <div style="display:flex; flex-direction:column; gap:0.25rem; text-align:left; width: 100%;">
        <span style="font-size:0.75rem; font-weight:700; color:var(--text-tertiary); margin-left:0.25rem;">${letter}.</span>
        <button class="${cls}" style="width:100%; border-radius:var(--radius-md); padding:1rem; text-align:left; font-size:1rem; min-height:60px; justify-content: flex-start; align-items: flex-start;" ${onclick}>
          ${choiceText ? escapeHTML(choiceText) : letter}
        </button>
      </div>
    `;
  }).join('');

  // Update nav buttons
  const btnPrev = document.getElementById('np-btn-prev');
  const btnNext = document.getElementById('np-btn-next');
  if (btnPrev) btnPrev.disabled = (currentSectionIdx === 0 && idx === 0);
  if (btnNext) btnNext.disabled = (currentSectionIdx === activeNotebook.sections.length - 1 && idx === qList.length - 1);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ----------------------------------------------------------
   SUBMISSION
   ---------------------------------------------------------- */
function npSubmitAttempt(force = false) {
  if (reviewMode) return;

  if (!force) {
    let unanswered = 0;
    sessionStatus.forEach(st => Object.values(st).forEach(s => { if (s !== 'answered') unanswered++; }));

    if (unanswered > 0) {
      showConfirm('Unanswered Questions', `You have ${unanswered} unanswered question${unanswered !== 1 ? 's' : ''}. Submit anyway?`, () => {
        processSubmission();
      });
      return;
    }

    showConfirm('Submit Attempt', 'Are you sure you want to submit your answers?', () => {
      processSubmission();
    });
    return;
  }

  processSubmission();
}

function processSubmission() {
  if (timerInterval) clearInterval(timerInterval);

  const elapsed = Math.round((Date.now() - (practiceStartTime || Date.now())) / 1000);

  // Grade all answers
  let totalCorrect = 0;
  let totalQuestions = 0;

  const record = {
    id: 'nr_' + Date.now(),
    notebookId: activeNotebook.id,
    notebookTitle: activeNotebook.title,
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    duration: elapsed,
    sections: []
  };

  activeNotebook.sections.forEach((sec, idx) => {
    const keyMap = answerKeys[idx];
    const userAnswers = sessionAnswers[idx];
    let correct = 0;
    const qList = sec.questions || [];
    const total = qList.length;

    qList.forEach(qNum => {
      const correctAns = keyMap[qNum] ? keyMap[qNum].answer : null;
      if (userAnswers[qNum] && correctAns && userAnswers[qNum] === correctAns) {
        gradeResults[idx][qNum] = 'correct';
        correct++;
      } else if (userAnswers[qNum]) {
        gradeResults[idx][qNum] = 'wrong';
      } else {
        gradeResults[idx][qNum] = 'skipped';
      }
    });

    totalCorrect += correct;
    totalQuestions += total;

    record.sections.push({
      label: sec.label,
      correct: correct,
      total: total,
      questionsCount: total,
      answers: { ...userAnswers },
      keyMap: { ...keyMap }
    });
  });

  // Save to history
  if (!state.notebookHistory) state.notebookHistory = [];
  state.notebookHistory.unshift(record);
  saveData();

  reviewRecord = record;

  // Show results overlay
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  showResultsOverlay(totalCorrect, totalQuestions, accuracy, elapsed, record);
}

/* ----------------------------------------------------------
   RESULTS OVERLAY
   ---------------------------------------------------------- */
function showResultsOverlay(correct, total, accuracy, elapsed, record) {
  const overlay = document.getElementById('np-results-overlay');
  if (!overlay) return;

  const iconEl = document.getElementById('np-results-icon');
  const titleEl = document.getElementById('np-results-title');
  const descEl = document.getElementById('np-results-desc');
  const breakdownEl = document.getElementById('np-results-breakdown');

  // Icon
  let iconColor, iconName, titleText;
  if (accuracy === 100) {
    iconColor = 'var(--color-success)';
    iconName = 'trophy';
    titleText = 'Perfect Score! 🎉';
  } else if (accuracy >= 80) {
    iconColor = 'var(--color-success)';
    iconName = 'check-circle-2';
    titleText = 'Great Job!';
  } else if (accuracy >= 50) {
    iconColor = 'var(--color-warning)';
    iconName = 'alert-circle';
    titleText = 'Good Effort';
  } else {
    iconColor = 'var(--color-danger)';
    iconName = 'x-circle';
    titleText = 'Keep Practicing';
  }

  iconEl.innerHTML = `<i data-lucide="${iconName}" style="width:56px;height:56px;color:${iconColor};"></i>`;
  titleEl.textContent = titleText;
  titleEl.style.color = iconColor;
  descEl.innerHTML = `You scored <strong style="font-size:1.25em;color:${iconColor};">${correct}/${total}</strong> (${accuracy}%) in ${formatTimeDisplay(elapsed)}`;

  // Section breakdown
  let breakdownHtml = '<div style="display:flex; flex-direction:column; gap:0.5rem;">';
  record.sections.forEach(sec => {
    const pct = sec.total > 0 ? Math.round((sec.correct / sec.total) * 100) : 0;
    const barColor = pct === 100 ? 'var(--color-success)' : pct >= 70 ? 'var(--color-warning)' : 'var(--color-danger)';
    breakdownHtml += `
      <div style="background:var(--bg-surface-hover); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:0.625rem 0.875rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.375rem;">
          <span style="font-weight:600; font-size:0.8125rem;">${escapeHTML(sec.label)}</span>
          <span style="font-weight:700; font-size:0.8125rem; color:${barColor};">${sec.correct}/${sec.total}</span>
        </div>
        <div style="height:4px; background:var(--border-color); border-radius:4px; overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:${barColor}; border-radius:4px; transition:width 0.5s ease;"></div>
        </div>
      </div>
    `;
  });
  breakdownHtml += '</div>';
  breakdownEl.innerHTML = breakdownHtml;

  overlay.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ----------------------------------------------------------
   REVIEW MODE
   ---------------------------------------------------------- */
function enterReviewMode() {
  const overlay = document.getElementById('np-results-overlay');
  if (overlay) overlay.classList.add('hidden');

  reviewMode = true;

  // Swap topbars
  const pracTopbar = document.getElementById('np-topbar-practice');
  const revTopbar = document.getElementById('np-topbar-review');
  if (pracTopbar) pracTopbar.classList.add('hidden');
  if (revTopbar) revTopbar.classList.remove('hidden');

  // Show score in review topbar
  const scoreEl = document.getElementById('np-review-score');
  if (scoreEl && reviewRecord) {
    let totalCorrect = 0, totalQs = 0;
    (reviewRecord.sections || []).forEach(s => {
      totalCorrect += s.correct || 0;
      totalQs += s.total || 0;
    });
    const accuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;
    const color = accuracy === 100 ? '#10b981' : accuracy >= 70 ? '#fbbf24' : '#ef4444';
    scoreEl.innerHTML = `
      <span style="color:#8b949e;">Score:</span>
      <span style="font-family:var(--font-mono); font-size:1.25rem; color:${color};">${totalCorrect}/${totalQs}</span>
      <span style="font-family:var(--font-mono); color:${color};">(${accuracy}%)</span>
    `;
  }

  // Update footer
  const footer = document.getElementById('np-footer-text');
  if (footer) footer.innerHTML = '<p style="color:#10b981;">Review mode — navigate questions to see correct answers highlighted.</p>';

  // Re-render with review styling
  currentSectionIdx = 0;
  const firstSec = activeNotebook.sections[0];
  if (firstSec.questions && firstSec.questions.length > 0) {
    currentQuestionNum = firstSec.questions[0];
  }

  renderSidebar();
  renderQuestion();
}

function exitReview() {
  window.location.href = 'study.html';
}

/* ----------------------------------------------------------
   HINT MODAL
   ---------------------------------------------------------- */
function showHintModal() {
  const correctObj = answerKeys[currentSectionIdx][currentQuestionNum];
  if (!correctObj || !correctObj.hint) return;

  const textEl = document.getElementById('hint-modal-text');
  if (textEl) {
    textEl.innerHTML = escapeHTML(correctObj.hint).replace(/\n/g, '<br/>');
  }

  const modal = document.getElementById('hint-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function closeHintModal() {
  const modal = document.getElementById('hint-modal');
  if (modal) modal.classList.add('hidden');
}

