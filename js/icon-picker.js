const ICON_OPTIONS = [
  { value: 'folder', label: 'Folder' },
  { value: 'book', label: 'Book' },
  { value: 'book-open', label: 'Book Open' },
  { value: 'calculator', label: 'Calculator' },
  { value: 'flask-conical', label: 'Science Flask' },
  { value: 'globe', label: 'Globe' },
  { value: 'languages', label: 'Languages' },
  { value: 'pen-tool', label: 'Pen Tool' },
  { value: 'graduation-cap', label: 'Graduation Cap' },
  { value: 'test-tube', label: 'Test Tube' },
  { value: 'microscope', label: 'Microscope' },
  { value: 'brain', label: 'Brain' },
  { value: 'sigma', label: 'Sigma / Math' },
  { value: 'library', label: 'Library' },
  { value: 'file-text', label: 'Document' },
  { value: 'code', label: 'Code' },
  { value: 'star', label: 'Star' },
  { value: 'box', label: 'Box' },
  { value: 'database', label: 'Database' },
  { value: 'cpu', label: 'CPU' }
];

let iconPickerResolve = null;

function openIconPicker(currentIcon) {
  return new Promise((resolve) => {
    iconPickerResolve = resolve;
    
    // Inject modal if not exists
    let modal = document.getElementById('icon-picker-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'icon-picker-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; text-align: left; overflow: visible;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h2 class="modal-title" style="margin: 0; font-size: 1.25rem;">Select Folder Icon</h2>
            <button onclick="closeIconPicker()" style="background: none; border: none; color: var(--text-tertiary); cursor: pointer; display: flex;">
              <i data-lucide="x" style="width: 20px; height: 20px;"></i>
            </button>
          </div>
          
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase;">Icon (Lucide)</div>
          <div class="custom-dropdown" id="icon-picker-dropdown" tabindex="0" style="position: relative; width: 100%; user-select: none;">
            <div class="custom-dropdown-selected" style="display: flex; align-items: center; justify-content: space-between; padding: 0.875rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: border-color var(--transition-fast);">
              <div style="display: flex; align-items: center; gap: 0.75rem;" id="icon-picker-selected-content">
                <!-- Content injected via JS -->
              </div>
              <i data-lucide="chevron-down" style="width: 16px; height: 16px; color: var(--text-tertiary);"></i>
            </div>
            
            <div class="custom-dropdown-options hidden" style="position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--bg-elevated); border: 1px solid var(--color-primary); border-radius: var(--radius-md); box-shadow: var(--shadow-xl); max-height: 280px; overflow-y: auto; z-index: 100;">
              ${ICON_OPTIONS.map(opt => `
                <div class="custom-dropdown-option" data-value="${opt.value}" onclick="selectIconOption('${opt.value}')" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; cursor: pointer; transition: all 0.1s ease;">
                  <i data-lucide="${opt.value}" style="width: 18px; height: 18px; color: var(--text-tertiary);" class="opt-icon"></i>
                  <span style="font-weight: 500; font-size: 0.95rem;">${opt.label}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="modal-actions" style="margin-top: 2rem; justify-content: flex-end;">
            <button onclick="closeIconPicker()" class="btn btn-secondary" style="padding: 0.625rem 1rem;">Cancel</button>
            <button onclick="confirmIconPicker()" class="btn btn-primary" style="padding: 0.625rem 1rem;">Save Icon</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Event listener for dropdown toggle
      const dropdownSelected = modal.querySelector('.custom-dropdown-selected');
      const dropdownOptions = modal.querySelector('.custom-dropdown-options');
      
      dropdownSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownOptions.classList.toggle('hidden');
        if (!dropdownOptions.classList.contains('hidden')) {
          dropdownSelected.style.borderColor = 'var(--color-primary)';
          dropdownSelected.style.boxShadow = '0 0 0 2px var(--color-primary-subtle)';
        } else {
          dropdownSelected.style.borderColor = 'var(--border-color)';
          dropdownSelected.style.boxShadow = 'none';
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!modal.querySelector('.custom-dropdown').contains(e.target)) {
          dropdownOptions.classList.add('hidden');
          dropdownSelected.style.borderColor = 'var(--border-color)';
          dropdownSelected.style.boxShadow = 'none';
        }
      });
      
      // Add dynamic styles for options
      const style = document.createElement('style');
      style.innerHTML = `
        .custom-dropdown-option:hover {
          background: var(--color-primary) !important;
          color: white !important;
        }
        .custom-dropdown-option:hover .opt-icon {
          color: white !important;
        }
        .custom-dropdown-options::-webkit-scrollbar {
          width: 6px;
        }
        .custom-dropdown-options::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 4px;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Reset dropdown state
    const dropdownSelected = modal.querySelector('.custom-dropdown-selected');
    const dropdownOptions = modal.querySelector('.custom-dropdown-options');
    dropdownOptions.classList.add('hidden');
    dropdownSelected.style.borderColor = 'var(--border-color)';
    dropdownSelected.style.boxShadow = 'none';

    // Set initial state
    const safeIcon = ICON_OPTIONS.find(o => o.value === currentIcon) ? currentIcon : 'folder';
    updateIconPickerSelected(safeIcon);
    modal.dataset.currentSelection = safeIcon;
    
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });
}

function selectIconOption(val) {
  const modal = document.getElementById('icon-picker-modal');
  if (modal) {
    modal.dataset.currentSelection = val;
    updateIconPickerSelected(val);
    const dropdownOptions = modal.querySelector('.custom-dropdown-options');
    const dropdownSelected = modal.querySelector('.custom-dropdown-selected');
    dropdownOptions.classList.add('hidden');
    dropdownSelected.style.borderColor = 'var(--border-color)';
    dropdownSelected.style.boxShadow = 'none';
  }
}

function updateIconPickerSelected(val) {
  const opt = ICON_OPTIONS.find(o => o.value === val) || { value: 'folder', label: 'Folder' };
  const container = document.getElementById('icon-picker-selected-content');
  if (container) {
    container.innerHTML = `
      <i data-lucide="${opt.value}" style="width: 20px; height: 20px; color: var(--color-primary);"></i>
      <span style="font-weight: 600; font-size: 1rem;">${opt.label}</span>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function closeIconPicker() {
  const modal = document.getElementById('icon-picker-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  if (iconPickerResolve) {
    iconPickerResolve(null);
    iconPickerResolve = null;
  }
}

function confirmIconPicker() {
  const modal = document.getElementById('icon-picker-modal');
  let selected = null;
  if (modal) {
    selected = modal.dataset.currentSelection;
    modal.classList.add('hidden');
  }
  if (iconPickerResolve) {
    iconPickerResolve(selected);
    iconPickerResolve = null;
  }
}

// Reusable function to render an icon dropdown inside any container
function renderIconDropdown(containerId, currentIcon, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const safeIcon = ICON_OPTIONS.find(o => o.value === currentIcon) ? currentIcon : 'folder';
  const opt = ICON_OPTIONS.find(o => o.value === safeIcon) || { value: 'folder', label: 'Folder' };

  container.innerHTML = `
    <div class="custom-dropdown" tabindex="0" style="position: relative; width: 100%; user-select: none;">
      <div class="custom-dropdown-selected" style="display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 0.75rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); cursor: pointer; transition: border-color var(--transition-fast);">
        <div style="display: flex; align-items: center; gap: 0.5rem;" class="selected-content">
          <i data-lucide="${opt.value}" style="width: 16px; height: 16px; color: var(--color-primary);"></i>
          <span style="font-weight: 500; font-size: 0.875rem;">${opt.label}</span>
        </div>
        <i data-lucide="chevron-down" style="width: 14px; height: 14px; color: var(--text-tertiary);"></i>
      </div>
      
      <div class="custom-dropdown-options hidden" style="position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--bg-elevated); border: 1px solid var(--color-primary); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); max-height: 220px; overflow-y: auto; z-index: 100;">
        ${ICON_OPTIONS.map(o => `
          <div class="custom-dropdown-option" data-value="${o.value}" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; cursor: pointer; transition: all 0.1s ease;">
            <i data-lucide="${o.value}" style="width: 16px; height: 16px; color: var(--text-tertiary);" class="opt-icon"></i>
            <span style="font-weight: 500; font-size: 0.875rem;">${o.label}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();

  const dropdownSelected = container.querySelector('.custom-dropdown-selected');
  const dropdownOptions = container.querySelector('.custom-dropdown-options');

  // Toggle open/close
  dropdownSelected.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownOptions.classList.toggle('hidden');
    if (!dropdownOptions.classList.contains('hidden')) {
      dropdownSelected.style.borderColor = 'var(--color-primary)';
    } else {
      dropdownSelected.style.borderColor = 'var(--border-color)';
    }
  });

  // Handle option click
  const options = container.querySelectorAll('.custom-dropdown-option');
  options.forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = option.dataset.value;
      const selectedOpt = ICON_OPTIONS.find(o => o.value === val);
      
      // Update UI
      container.querySelector('.selected-content').innerHTML = `
        <i data-lucide="${selectedOpt.value}" style="width: 16px; height: 16px; color: var(--color-primary);"></i>
        <span style="font-weight: 500; font-size: 0.875rem;">${selectedOpt.label}</span>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      
      // Close dropdown
      dropdownOptions.classList.add('hidden');
      dropdownSelected.style.borderColor = 'var(--border-color)';

      // Trigger callback
      if (onChange) onChange(val);
    });
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdownOptions.classList.add('hidden');
      dropdownSelected.style.borderColor = 'var(--border-color)';
    }
  });
}
