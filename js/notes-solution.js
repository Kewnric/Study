/* ============================================================
   NOTES-SOLUTION.JS — MCQ Notebook Results & Review
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
  loadData();
  lucide.createIcons();
  
  const resultId = getSessionParam('activeNotebookResult');
  
  if (!resultId || !state.notebookHistory) {
    window.location.href = 'study.html';
    return;
  }
  
  const record = state.notebookHistory.find(r => r.id === resultId);
  if (!record) {
    window.location.href = 'study.html';
    return;
  }
  
  renderResults(record);
});

function renderResults(record) {
  document.getElementById('ns-notebook-title').textContent = record.notebookTitle || 'Notebook Result';
  document.getElementById('ns-datetime').textContent = `${record.date} at ${record.time}`;
  
  let totalCorrect = 0;
  let totalQs = 0;
  
  const sectionsHtml = record.sections.map((sec, idx) => {
    totalCorrect += sec.correct;
    totalQs += sec.total;
    
    return `
      <div style="margin-bottom: 2rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem;">
          <h2 style="font-size: 1.125rem; font-weight: 700; color: var(--text-primary);">${escapeHTML(sec.label)}</h2>
          <div style="font-weight: 600; color: var(--text-secondary);">Score: ${sec.correct} / ${sec.total}</div>
        </div>
        <div class="ns-questions-grid" style="gap: 0.5rem;">
          ${renderSectionQuestions(sec)}
        </div>
      </div>
    `;
  }).join('');
  
  document.getElementById('ns-total-score').textContent = `${totalCorrect}/${totalQs}`;
  const accuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;
  document.getElementById('ns-accuracy').textContent = `${accuracy}%`;
  
  document.getElementById('ns-sections-review').innerHTML = sectionsHtml;
  lucide.createIcons();
}

function renderSectionQuestions(sec) {
  const qCount = sec.questionsCount || sec.total || 0;
  if (qCount === 0) return '<div class="empty-state">No questions in this section.</div>';
  
  const answers = sec.answers || {};
  const keyMap = sec.keyMap || {};
  
  // Get actual question numbers from answers and keyMap
  const qNums = [...new Set([...Object.keys(answers), ...Object.keys(keyMap)])]
    .map(Number)
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  
  if (qNums.length === 0) return '<div class="empty-state">No questions in this section.</div>';
  
  let html = '';
  qNums.forEach(qNum => {
    const userAns = answers[qNum];
    const correctAns = keyMap[qNum];
    
    let maxCharCode = 68; // 'D'
    if (correctAns) maxCharCode = Math.max(maxCharCode, correctAns.charCodeAt(0));
    if (userAns) maxCharCode = Math.max(maxCharCode, userAns.charCodeAt(0));
    
    const letters = [];
    for (let i = 65; i <= maxCharCode; i++) letters.push(String.fromCharCode(i));
    
    // If letters < 4, default to 4 (A-D)
    while (letters.length < 4) {
      letters.push(String.fromCharCode(65 + letters.length));
    }
    
    html += `
      <div class="ns-question-row card-flat" style="padding: 0.75rem 1rem; border: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
        <span class="ns-q-num" style="font-size: 1rem; width: 40px; text-align: left;">Q${qNum}</span>
        <div class="ns-bubbles">
    `;
    
    letters.forEach(letter => {
      let cls = 'ns-bubble';
      
      if (correctAns) {
        if (letter === correctAns && userAns === correctAns) cls += ' correct';
        else if (letter === userAns && userAns !== correctAns) cls += ' wrong';
        else if (letter === correctAns && userAns !== correctAns) cls += ' expected';
        else if (userAns === letter && !correctAns) cls += ' selected'; // Shouldn't happen
      } else {
        // No answer key for this question
        if (userAns === letter) cls += ' selected';
      }
      
      html += `<div class="${cls}" style="cursor:default;">${letter}</div>`;
    });
    
    html += `
        </div>
      </div>
    `;
  });
  
  return html;
}
