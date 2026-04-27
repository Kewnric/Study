/* ============================================================
   PRACTICE.JS — Practice Session + Timer Logic
   ============================================================ */

function initPractice() {
  const challengeId = getSessionParam('practiceChallenge');
  const variantId = getSessionParam('practiceVariant');
  const timeLimit = getSessionParam('timeLimit') || 0;

  if (!challengeId || !variantId) {
    window.location.href = 'browse.html';
    return;
  }

  const challenge = state.challenges.find(c => c.id === challengeId);
  const variant = challenge ? challenge.variants.find(v => v.id === variantId) : null;

  if (!challenge || !variant) {
    window.location.href = 'browse.html';
    return;
  }

  state.activeChallenge = challenge;
  state.activeVariant = variant;
  state.userCode = '';
  state.timeLimit = timeLimit;
  state.sessionData = { startTime: Date.now(), timeLimit: timeLimit, attemptsThisSession: 1 };

  // Populate UI
  document.getElementById('practice-title').innerText = `${challenge.title} — ${variant.name}`;
  document.getElementById('practice-desc').innerHTML = formatRichText(variant.description) || 'No description provided.';

  const samplesContainer = document.getElementById('practice-samples-container');
  if (variant.samples.length > 0) {
    samplesContainer.innerHTML = variant.samples.map(s => `
      <div style="margin-bottom:0.5rem;">
        <h3 class="sample-title">${escapeHTML(s.title)}</h3>
        <div class="sample-content">${formatSampleText(s.content)}</div>
      </div>
    `).join('');
  } else {
    samplesContainer.innerHTML = '';
  }

  // Inject Starter Code with MiSide typing animation
  state.userCode = variant.starterCode || '';

  const textarea = document.getElementById('editor-textarea');
  const preCode = document.getElementById('editor-code');

  // If there's starter code, animate it typing in
  if (state.userCode && typeof TextAnimator !== 'undefined') {
    textarea.value = '';
    preCode.innerHTML = '<br/>';
    animateStarterCode(state.userCode, textarea, preCode);
  } else {
    textarea.value = state.userCode;
    preCode.innerHTML = syntaxHighlight(state.userCode) + '<br/>';
  }

  // Setup editor
  setupSpecificEditor('editor-textarea', 'editor-pre', 'editor-code', true);

  // Start timer
  if (activeTimerInterval) clearInterval(activeTimerInterval);
  updateTimerDisplay();
  activeTimerInterval = setInterval(updateTimerDisplay, 1000);

  textarea.focus();
  lucide.createIcons();
}

let _starterAnimAborted = false;
let _starterAnimator = null;

/** MiSide-style animation for starter code appearing in the editor (DOM-safe) */
async function animateStarterCode(code, textarea, preCode) {
  _starterAnimAborted = false;

  // Abort any previous animator
  if (_starterAnimator) _starterAnimator.abort();

  _starterAnimator = new SyntaxTextAnimator({
    speed: 18,
    onComplete: () => {
      if (typeof state !== 'undefined') state.userCode = code;
    }
  });

  // Sync state as animation progresses
  const originalAnimate = _starterAnimator.animate.bind(_starterAnimator);
  await _starterAnimator.animate(code, preCode, textarea, syntaxHighlight);

  if (!_starterAnimAborted && typeof state !== 'undefined') {
    state.userCode = code;
  }
}

function updateTimerDisplay() {
  if (!state.sessionData) {
    if (activeTimerInterval) clearInterval(activeTimerInterval);
    return;
  }

  const elapsed = Math.floor((Date.now() - state.sessionData.startTime) / 1000);
  const displayEl = document.getElementById('practice-timer');

  if (state.sessionData.timeLimit > 0) {
    const remaining = state.sessionData.timeLimit - elapsed;
    if (remaining <= 0) {
      displayEl.innerText = "00:00";
      displayEl.classList.add('timer-expired');
      clearInterval(activeTimerInterval);
      submitCode();
    } else {
      displayEl.innerText = formatTimeDisplay(remaining);
      displayEl.classList.remove('timer-expired');
    }
  } else {
    displayEl.innerText = formatTimeDisplay(elapsed);
    displayEl.classList.remove('timer-expired');
  }
}

function submitCode() {
  if (!state.activeVariant) return;
  if (activeTimerInterval) clearInterval(activeTimerInterval);

  const { diffs, scoreCount, cLinesLen } = computeDiffs(state.userCode, state.activeVariant.code);

  const percentage = cLinesLen > 0 ? Math.round((scoreCount / cLinesLen) * 100) : 0;
  const finalPercentage = Math.min(percentage, 100);
  const isPerfect = finalPercentage === 100;
  const submitTime = Date.now();
  const durationSeconds = Math.round((submitTime - state.sessionData.startTime) / 1000);

  const attemptCounter = (state.activeAttempts[state.activeChallenge.id] || 0) + 1;

  const historyEntry = {
    id: generateId(),
    challengeId: state.activeChallenge.id,
    challengeTitle: `${state.activeChallenge.title} - ${state.activeVariant.name}`,
    category: state.activeChallenge.category || 'Uncategorized',
    date: new Date().toLocaleDateString(),
    startTime: state.sessionData.startTime,
    submitTime: submitTime,
    duration: durationSeconds,
    score: finalPercentage,
    attemptNumber: attemptCounter,
    userCode: state.userCode,
    expectedCode: state.activeVariant.code
  };

  // --- Gamification: Achievement Badges ---
  const earnedBadges = [];
  const hour = new Date().getHours();

  // 1. Flawless: 100% on the very first attempt
  if (isPerfect && attemptCounter === 1 && !state.badges.includes('Flawless')) {
    state.badges.push('Flawless');
    earnedBadges.push({ name: 'Flawless', icon: '🎯', desc: '100% on First Try' });
  }
  // 2. Speed Demon: 100% in under 60 seconds
  if (isPerfect && durationSeconds < 60 && !state.badges.includes('Speed Demon')) {
    state.badges.push('Speed Demon');
    earnedBadges.push({ name: 'Speed Demon', icon: '⚡', desc: 'Perfect in Under 60s' });
  }
  // 3. Night Owl: Coding between 10 PM and 4 AM
  if ((hour >= 22 || hour < 4) && !state.badges.includes('Night Owl')) {
    state.badges.push('Night Owl');
    earnedBadges.push({ name: 'Night Owl', icon: '🦉', desc: 'Late Night Coder' });
  }
  // 4. Persistent: 5+ attempts on the same challenge
  if (attemptCounter >= 5 && !state.badges.includes('Persistent')) {
    state.badges.push('Persistent');
    earnedBadges.push({ name: 'Persistent', icon: '💪', desc: '5+ Attempts on One Challenge' });
  }
  // 5. Marathoner: Total 50+ history entries
  if (state.history.length >= 49 && !state.badges.includes('Marathoner')) {
    state.badges.push('Marathoner');
    earnedBadges.push({ name: 'Marathoner', icon: '🏃', desc: '50+ Total Submissions' });
  }

  state.history.unshift(historyEntry);
  state.activeAttempts[state.activeChallenge.id] = isPerfect ? 0 : attemptCounter;
  state.lastDiffs = diffs;
  saveData();

  // Store diffs for solution page
  setSessionParam('lastDiffs', diffs);

  showResultModal(finalPercentage, isPerfect, earnedBadges);
}

function retryPractice() {
  _starterAnimAborted = true; // Kill any running typing animation
  if (_starterAnimator) _starterAnimator.abort();
  closeResultModal();
  const starterCode = state.activeVariant ? (state.activeVariant.starterCode || '') : '';
  state.userCode = starterCode;
  document.getElementById('editor-textarea').value = starterCode;
  document.getElementById('editor-code').innerHTML = syntaxHighlight(starterCode) + '<br/>';
  state.sessionData.startTime = Date.now();
  state.sessionData.attemptsThisSession++;

  updateTimerDisplay();
  activeTimerInterval = setInterval(updateTimerDisplay, 1000);

  document.getElementById('editor-textarea').focus();
}

function goToSolution() {
  setSessionParam('solutionBack', 'practice');
  setSessionParam('lastDiffs', state.lastDiffs);
  window.location.href = 'solution.html';
}
