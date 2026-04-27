/* ============================================================
   TEXT-EFFECTS.JS — MiSide-Inspired Text Animation Engine
   ============================================================
   Features:
   - Progressive blur-to-sharp character reveal
   - Variable typewriter speed with punctuation pauses
   - Glow & chromatic aberration options
   - Blinking cursor
   - Chainable sequences
   ============================================================ */

class TextAnimator {
  constructor(element, options = {}) {
    this.el = typeof element === 'string' ? document.getElementById(element) : element;
    this.baseSpeed   = options.speed   || 45;
    this.useBlur     = options.blur    !== false;
    this.useGlow     = options.glow    || false;
    this.chromatic   = options.chromatic || false;
    this.showCursor  = options.cursor  !== false;
    this.onComplete  = options.onComplete || null;
    this._cursor     = null;
    this._aborted    = false;
    this._forceComplete = false;
  }

  /* --- Public API --- */

  async type(text) {
    if (!this.el) return;
    this._aborted = false;
    this._forceComplete = false;
    this.el.innerHTML = '';

    if (this.chromatic) this.el.classList.add('miside-chromatic');
    this._addCursor();

    for (let i = 0; i < text.length; i++) {
      if (this._aborted) break;

      const ch = text[i];
      const span = document.createElement('span');
      span.className = 'miside-char';
      if (this.useGlow) span.classList.add('glow');
      if (ch === ' ') { span.classList.add('space'); span.textContent = ' '; }
      else span.textContent = ch;

      // Insert before cursor
      if (this._cursor) this.el.insertBefore(span, this._cursor);
      else this.el.appendChild(span);

      if (!this._forceComplete) {
        await this._wait(this._charDelay(ch));
      }
    }

    if (this.onComplete) this.onComplete();
    return this;
  }

  async typeLines(lines, lineDelay = 600) {
    this._forceComplete = false;
    for (let i = 0; i < lines.length; i++) {
      if (this._aborted) break;
      if (i > 0) {
        this.el.insertBefore(document.createElement('br'), this._cursor);
        if (!this._forceComplete) await this._wait(lineDelay);
      }
      // Type this line character by character
      for (let j = 0; j < lines[i].length; j++) {
        if (this._aborted) break;
        const ch = lines[i][j];
        const span = document.createElement('span');
        span.className = 'miside-char';
        if (this.useGlow) span.classList.add('glow');
        if (ch === ' ') { span.classList.add('space'); span.textContent = ' '; }
        else span.textContent = ch;
        if (this._cursor) this.el.insertBefore(span, this._cursor);
        else this.el.appendChild(span);
        if (!this._forceComplete) {
          await this._wait(this._charDelay(ch));
        }
      }
    }
    if (this.onComplete) this.onComplete();
    return this;
  }

  /* Instantly set text (no animation) */
  set(text) {
    if (!this.el) return;
    this._aborted = true;
    this.el.textContent = text;
    return this;
  }

  complete() {
    this._forceComplete = true;
  }

  abort() {
    this._aborted = true;
  }

  removeCursor() {
    if (this._cursor && this._cursor.parentNode) {
      this._cursor.parentNode.removeChild(this._cursor);
      this._cursor = null;
    }
  }

  /* --- Internals --- */

  _addCursor() {
    if (!this.showCursor) return;
    this._cursor = document.createElement('span');
    this._cursor.className = 'miside-cursor';
    this.el.appendChild(this._cursor);
  }

  _charDelay(ch) {
    if ('.!?'.includes(ch))  return this.baseSpeed * 7;
    if (',;:'.includes(ch))  return this.baseSpeed * 3.5;
    if ('-—'.includes(ch))   return this.baseSpeed * 2;
    return this.baseSpeed + (Math.random() * 25);
  }

  _wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

/* ============================================================
   SyntaxTextAnimator — DOM-Safe Syntax-Preserving Animation
   Pre-renders syntax highlighting, then reveals characters
   one-by-one via CSS without destroying <span> tags.
   ============================================================ */

class SyntaxTextAnimator {
  constructor(options = {}) {
    this.baseSpeed   = options.speed   || 18;
    this._aborted    = false;
    this.onComplete  = options.onComplete || null;
  }

  /**
   * Animate code into the editor by revealing characters one at a time.
   * @param {string} code        — raw code string
   * @param {HTMLElement} preCode — the <code> element for syntax display
   * @param {HTMLTextAreaElement} textarea — the backing textarea
   * @param {Function} highlighter — the syntaxHighlight function
   */
  async animate(code, preCode, textarea, highlighter) {
    this._aborted = false;

    // 1. Pre-render the full syntax-highlighted HTML
    const fullHTML = highlighter(code);
    preCode.innerHTML = fullHTML + '<br/>';

    // 2. Walk all TextNodes and wrap each character in a <span>
    const charSpans = [];
    const walker = document.createTreeWalker(preCode, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent;
      if (text.length === 0) continue;

      const fragment = document.createDocumentFragment();
      for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        span.textContent = text[i];
        span.className = 'miside-char-hidden';
        fragment.appendChild(span);
        charSpans.push(span);
      }
      textNode.parentNode.replaceChild(fragment, textNode);
    }

    // 3. Reveal characters one at a time, syncing textarea
    let typed = '';
    for (let i = 0; i < charSpans.length; i++) {
      if (this._aborted) return;

      const span = charSpans[i];
      span.classList.remove('miside-char-hidden');
      span.classList.add('miside-char-reveal');

      // Sync the corresponding raw code character to textarea
      if (i < code.length) {
        typed += code[i];
        textarea.value = typed;
      }

      const ch = span.textContent;
      await this._wait(this._charDelay(ch));
    }

    if (this._aborted) return;

    // 4. Final sync — ensure textarea and display match perfectly
    textarea.value = code;
    preCode.innerHTML = highlighter(code) + '<br/>';

    if (this.onComplete) this.onComplete();
  }

  abort() {
    this._aborted = true;
  }

  _charDelay(ch) {
    if ('.;'.includes(ch))          return 120;
    if (','.includes(ch))           return 70;
    if ('{}'.includes(ch))          return 60;
    if (ch === '\n')                return 45;
    return this.baseSpeed + (Math.random() * 12);
  }

  _wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

/* ============================================================
   Static helper: animate a counter from 0 to target
   ============================================================ */
function animateCounter(el, target, duration = 1200) {
  const start = performance.now();
  const isFloat = String(target).includes('.');

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(ease * target);
    el.textContent = isFloat ? (ease * target).toFixed(1) : current;
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = target + (el.dataset.suffix || '');
  }

  requestAnimationFrame(tick);
}
