/* ============================================================
   EDITOR.JS — Custom Code Editor (Instant Visuals & Multi-field)
   ============================================================ */

const editorListeners = new WeakMap();
let syntaxDebounceTimer;

// ADDED: stateField parameter (defaults to 'code')
function setupSpecificEditor(textareaId, preId, codeId, isPracticeMode, stateField = 'code') {
  const textarea = document.getElementById(textareaId);
  const preCode = document.getElementById(codeId);
  const preContainer = document.getElementById(preId);

  if (!textarea || !preCode) return;

  if (editorListeners.has(textarea)) {
    const oldHandlers = editorListeners.get(textarea);
    textarea.removeEventListener('scroll', oldHandlers.scroll);
    textarea.removeEventListener('input', oldHandlers.input);
    textarea.removeEventListener('keydown', oldHandlers.keydown);
  }

  const handlers = {
    scroll: () => {
      preContainer.scrollTop = textarea.scrollTop;
      preContainer.scrollLeft = textarea.scrollLeft;
    },
    input: (e) => {
      const newVal = e.target.value;
      if (isPracticeMode) {
        if (typeof state !== 'undefined') state.userCode = newVal;
      } else if (typeof adminState !== 'undefined' && adminState?.variants && typeof adminState.activeVariantIndex !== 'undefined') {
        // Updates either 'code' or 'starterCode' dynamically
        adminState.variants[adminState.activeVariantIndex][stateField] = newVal;
      }
      preCode.innerHTML = syntaxHighlight(newVal) + '<br/>';
    },
    keydown: (e) => {
      const { value, selectionStart, selectionEnd } = e.target;
      const bracketPairs = { '{': '}', '(': ')', '[': ']' };

      if (e.key === 'Tab') {
        e.preventDefault();
        updateVal(value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd), selectionStart + 2, textarea, preCode, isPracticeMode, stateField);
      } else if (bracketPairs[e.key]) {
        e.preventDefault();
        updateVal(value.substring(0, selectionStart) + e.key + bracketPairs[e.key] + value.substring(selectionEnd), selectionStart + 1, textarea, preCode, isPracticeMode, stateField);
      } else if (e.key === '"' || e.key === "'" || e.key === '`') {
        e.preventDefault();
        const textBefore = value.substring(0, selectionStart);
        const textAfter = value.substring(selectionEnd);
        const selected = value.substring(selectionStart, selectionEnd);
        const newCursorPos = selected.length === 0 ? selectionStart + 1 : selectionStart + 1 + selected.length;
        updateVal(textBefore + e.key + selected + e.key + textAfter, newCursorPos, textarea, preCode, isPracticeMode, stateField);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const textBefore = value.substring(0, selectionStart);
        const textAfter = value.substring(selectionEnd);
        const linesBeforeCursor = textBefore.split('\n');
        const currentLine = linesBeforeCursor[linesBeforeCursor.length - 1];
        const indentMatch = currentLine.match(/^\s*/);
        let indent = indentMatch ? indentMatch[0] : '';

        if ((textBefore.endsWith('{') && textAfter.startsWith('}')) || (textBefore.endsWith('[') && textAfter.startsWith(']'))) {
          const innerIndent = indent + '  ';
          updateVal(textBefore + '\n' + innerIndent + '\n' + indent + textAfter, selectionStart + 1 + innerIndent.length, textarea, preCode, isPracticeMode, stateField);
          return;
        }

        if (currentLine.trim().endsWith('{') || currentLine.trim().endsWith('[')) indent += '  ';
        updateVal(textBefore + '\n' + indent + textAfter, selectionStart + 1 + indent.length, textarea, preCode, isPracticeMode, stateField);
      } else if (e.key === '}' || e.key === ']') {
        const linesBeforeCursor = value.substring(0, selectionStart).split('\n');
        const currentLine = linesBeforeCursor[linesBeforeCursor.length - 1];

        if (currentLine.trim() === '' && currentLine.length > 0) {
          e.preventDefault();
          const newIndent = currentLine.length >= 2 ? currentLine.slice(0, -2) : '';
          const textBeforeLine = linesBeforeCursor.slice(0, -1).join('\n') + (linesBeforeCursor.length > 1 ? '\n' : '');
          updateVal(textBeforeLine + newIndent + e.key + value.substring(selectionEnd), textBeforeLine.length + newIndent.length + 1, textarea, preCode, isPracticeMode, stateField);
        }
      }
    }
  };

  textarea.addEventListener('scroll', handlers.scroll);
  textarea.addEventListener('input', handlers.input);
  textarea.addEventListener('keydown', handlers.keydown);
  editorListeners.set(textarea, handlers);
}

function updateVal(newVal, cursorOffset, textarea, preCode, isPracticeMode, stateField) {
  textarea.value = newVal;
  if (isPracticeMode) {
    if (typeof state !== 'undefined') state.userCode = newVal;
  } else if (typeof adminState !== 'undefined' && adminState?.variants && typeof adminState.activeVariantIndex !== 'undefined') {
    adminState.variants[adminState.activeVariantIndex][stateField] = newVal;
  }

  preCode.innerHTML = syntaxHighlight(newVal) + '<br/>';
  textarea.selectionStart = textarea.selectionEnd = cursorOffset;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}