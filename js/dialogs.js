/* ============================================================
   DIALOGS.JS — Modal / Dialog System
   ============================================================ */

function showMessage(title, message, isError = false) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) { alert(title + ': ' + message); return; }
  document.getElementById('dialog-title').innerText = title;
  document.getElementById('dialog-msg').innerText = message;
  document.getElementById('dialog-icon').innerHTML = isError
    ? '<i data-lucide="alert-circle" class="modal-icon-svg" style="color: var(--color-danger);"></i>'
    : '<i data-lucide="info" class="modal-icon-svg" style="color: var(--color-primary);"></i>';
  document.getElementById('dialog-actions').innerHTML = `
    <button onclick="document.getElementById('dialog-modal').classList.add('hidden')" class="btn btn-secondary" style="flex:1;">OK</button>
  `;
  modal.classList.remove('hidden');
  lucide.createIcons();
}

function showConfirm(title, message, onConfirm) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) { if (confirm(title + ': ' + message)) onConfirm(); return; }
  document.getElementById('dialog-title').innerText = title;
  document.getElementById('dialog-msg').innerText = message;
  document.getElementById('dialog-icon').innerHTML = '<i data-lucide="help-circle" class="modal-icon-svg" style="color: var(--color-warning);"></i>';

  const btnContainer = document.getElementById('dialog-actions');
  btnContainer.innerHTML = `
    <button id="dlg-cancel" class="btn btn-secondary" style="flex:1;">Cancel</button>
    <button id="dlg-confirm" class="btn btn-danger" style="flex:1;">Confirm</button>
  `;

  document.getElementById('dlg-cancel').onclick = () => modal.classList.add('hidden');
  document.getElementById('dlg-confirm').onclick = () => {
    modal.classList.add('hidden');
    onConfirm();
  };

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function showUnsavedConfirm(onDiscard, onSave) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) {
    if (confirm('You have unsaved changes. Discard?')) onDiscard();
    return;
  }
  document.getElementById('dialog-title').innerText = 'Unsaved Changes';
  document.getElementById('dialog-msg').innerText = 'You have unsaved modifications. What would you like to do?';
  document.getElementById('dialog-icon').innerHTML = '<i data-lucide="alert-triangle" class="modal-icon-svg" style="color: var(--color-warning);"></i>';

  const btnContainer = document.getElementById('dialog-actions');
  btnContainer.innerHTML = `
    <button id="dlg-cancel" class="btn btn-ghost" style="flex:1;">Cancel</button>
    <button id="dlg-discard" class="btn btn-danger" style="flex:1;">Discard</button>
    <button id="dlg-save" class="btn btn-primary" style="flex:1;">Save Changes</button>
  `;

  document.getElementById('dlg-cancel').onclick = () => modal.classList.add('hidden');
  document.getElementById('dlg-discard').onclick = () => {
    modal.classList.add('hidden');
    onDiscard();
  };
  document.getElementById('dlg-save').onclick = () => {
    modal.classList.add('hidden');
    onSave();
  };

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function showResultModal(score, isPerfect, earnedBadges = []) {
  const modal = document.getElementById('result-modal');
  if (!modal) return;
  const iconContainer = document.getElementById('rm-icon');
  const titleEl = document.getElementById('rm-title');
  const descEl = document.getElementById('rm-desc');
  const actionsEl = document.getElementById('rm-actions');

  // Build badges HTML if any were earned
  let badgesHTML = '';
  if (earnedBadges.length > 0) {
    badgesHTML = `
      <div class="result-badges-container">
        <div class="result-badges-title">🏆 Achievement Unlocked!</div>
        ${earnedBadges.map(b => `
          <div class="result-badge-item">
            <span class="result-badge-icon">${b.icon}</span>
            <div>
              <div class="result-badge-name">${escapeHTML(b.name)}</div>
              <div class="result-badge-desc">${escapeHTML(b.desc)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (isPerfect) {
    iconContainer.innerHTML = '<i data-lucide="check-circle-2" class="modal-icon-svg" style="color: var(--color-success);"></i>';
    titleEl.innerText = 'Perfect Score!';
    descEl.innerHTML = "Logic matched perfectly! (Spacing/Formatting ignored)" + badgesHTML;
    actionsEl.innerHTML = `
      <button onclick="closeResultModal(); goToSolution();" class="btn btn-secondary" style="flex:1;">
        <i data-lucide="file-diff" style="width:18px;height:18px;"></i> View Solution
      </button>
      <button onclick="closeResultModal(); window.location.href='browse.html';" class="btn btn-primary" style="flex:1;">Continue</button>
    `;
  } else {
    iconContainer.innerHTML = '<i data-lucide="alert-circle" class="modal-icon-svg" style="color: var(--color-warning);"></i>';
    titleEl.innerText = score + '% Match';
    descEl.innerHTML = "You're getting there! Review your syntax and logic compared to the solution." + badgesHTML;
    actionsEl.innerHTML = `
      <button onclick="retryPractice()" class="btn btn-secondary" style="flex:1;">
        <i data-lucide="refresh-ccw" style="width:18px;height:18px;"></i> Retry
      </button>
      <button onclick="closeResultModal(); goToSolution();" class="btn btn-primary" style="flex:1;">
        <i data-lucide="file-text" style="width:18px;height:18px;"></i> Check Solution
      </button>
    `;
  }

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeResultModal() {
  const modal = document.getElementById('result-modal');
  if (modal) modal.classList.add('hidden');
}
