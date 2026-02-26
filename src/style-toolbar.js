/**
 * Floating style toolbar — appears when clicking an element in any preview.
 * Lets users visually change colors, typography and spacing.
 * All changes are written as inline styles directly on the element.
 */

let toolbar = null;
let currentTarget = null;
let onChange = null; // callback to notify parent that HTML changed

// Undo history: stack of { element, property, oldValue }
const undoStack = [];
const MAX_UNDO = 50;

function create() {
  toolbar = document.createElement('div');
  toolbar.id = 'style-toolbar';
  toolbar.className = 'style-toolbar hidden';
  toolbar.innerHTML = `
    <div class="st-section">
      <label>🎨 Couleurs</label>
      <div class="st-row">
        <div class="st-field">
          <span class="st-label">Fond</span>
          <input type="color" data-prop="backgroundColor" />
        </div>
        <div class="st-field">
          <span class="st-label">Texte</span>
          <input type="color" data-prop="color" />
        </div>
        <div class="st-field">
          <span class="st-label">Bordure</span>
          <input type="color" data-prop="borderColor" />
        </div>
      </div>
    </div>
    <div class="st-section">
      <label>🔤 Typographie</label>
      <div class="st-row">
        <div class="st-field">
          <span class="st-label">Taille</span>
          <input type="number" data-prop="fontSize" min="8" max="72" step="1" class="st-number" /> <span class="st-unit">px</span>
        </div>
        <div class="st-field st-toggles">
          <button data-prop="fontWeight" data-on="bold" data-off="normal" class="st-toggle" title="Gras"><b>B</b></button>
          <button data-prop="fontStyle" data-on="italic" data-off="normal" class="st-toggle" title="Italique"><i>I</i></button>
          <button data-prop="textDecoration" data-on="underline" data-off="none" class="st-toggle" title="Souligné"><u>U</u></button>
        </div>
      </div>
      <div class="st-row">
        <div class="st-field st-toggles">
          <span class="st-label">Alignement</span>
          <button data-align="left" class="st-align" title="Gauche">⬅</button>
          <button data-align="center" class="st-align" title="Centré">⬛</button>
          <button data-align="right" class="st-align" title="Droite">➡</button>
          <button data-align="justify" class="st-align" title="Justifié">☰</button>
        </div>
      </div>
    </div>
    <div class="st-section">
      <label>😀 Emoji</label>
      <div class="st-row">
        <button class="st-emoji-toggle" title="Insérer un emoji">😀 Insérer</button>
      </div>
      <div class="st-emoji-picker hidden">
        <input type="text" class="st-emoji-search" placeholder="🔍 Rechercher..." />
        <div class="st-emoji-grid"></div>
      </div>
    </div>
    <div class="st-section">
      <label>📐 Espacement</label>
      <div class="st-row">
        <div class="st-field">
          <span class="st-label">Padding</span>
          <input type="range" data-prop="padding" min="0" max="64" step="2" class="st-range" />
          <span class="st-range-val">0px</span>
        </div>
        <div class="st-field">
          <span class="st-label">Margin</span>
          <input type="range" data-prop="margin" min="0" max="64" step="2" class="st-range" />
          <span class="st-range-val">0px</span>
        </div>
      </div>
    </div>
    <div class="st-section">
      <label>📏 Bordure</label>
      <div class="st-row">
        <div class="st-field">
          <span class="st-label">Épaisseur</span>
          <input type="range" data-prop="borderWidth" min="0" max="10" step="1" class="st-range" />
          <span class="st-range-val">0px</span>
        </div>
        <div class="st-field">
          <span class="st-label">Rayon</span>
          <input type="range" data-prop="borderRadius" min="0" max="32" step="2" class="st-range" />
          <span class="st-range-val">0px</span>
        </div>
      </div>
    </div>
    <button class="st-close" title="Fermer">✕</button>
  `;
  document.body.appendChild(toolbar);

  // Color inputs
  toolbar.querySelectorAll('input[type="color"]').forEach(input => {
    // Record old value on mousedown (before the picker opens)
    input.addEventListener('focus', () => {
      if (!currentTarget) return;
      input._oldVal = currentTarget.style[input.dataset.prop] || '';
    });
    input.addEventListener('input', () => {
      if (!currentTarget) return;
      currentTarget.style[input.dataset.prop] = input.value;
      if (input.dataset.prop === 'borderColor' && !currentTarget.style.borderStyle) {
        currentTarget.style.borderStyle = 'solid';
        if (!parseInt(currentTarget.style.borderWidth)) {
          currentTarget.style.borderWidth = '1px';
          syncRangeDisplay(toolbar.querySelector('[data-prop="borderWidth"]'));
        }
      }
      notifyChange();
    });
    input.addEventListener('change', () => {
      if (!currentTarget || input._oldVal === undefined) return;
      recordUndo(currentTarget, input.dataset.prop, input._oldVal);
      input._oldVal = undefined;
    });
  });

  // Font size
  const fontSizeInput = toolbar.querySelector('input[data-prop="fontSize"]');
  fontSizeInput.addEventListener('focus', () => {
    if (currentTarget) fontSizeInput._oldVal = currentTarget.style.fontSize || '';
  });
  fontSizeInput.addEventListener('input', (e) => {
    if (!currentTarget) return;
    currentTarget.style.fontSize = e.target.value + 'px';
    notifyChange();
  });
  fontSizeInput.addEventListener('change', () => {
    if (currentTarget && fontSizeInput._oldVal !== undefined) {
      recordUndo(currentTarget, 'fontSize', fontSizeInput._oldVal);
      fontSizeInput._oldVal = undefined;
    }
  });

  // Toggle buttons (bold, italic, underline)
  toolbar.querySelectorAll('.st-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentTarget) return;
      const prop = btn.dataset.prop;
      const oldVal = currentTarget.style[prop] || '';
      const isOn = oldVal === btn.dataset.on;
      currentTarget.style[prop] = isOn ? btn.dataset.off : btn.dataset.on;
      btn.classList.toggle('active', !isOn);
      recordUndo(currentTarget, prop, oldVal);
      notifyChange();
    });
  });

  // Alignment buttons
  toolbar.querySelectorAll('.st-align').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentTarget) return;
      const oldVal = currentTarget.style.textAlign || '';
      currentTarget.style.textAlign = btn.dataset.align;
      toolbar.querySelectorAll('.st-align').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      recordUndo(currentTarget, 'textAlign', oldVal);
      notifyChange();
    });
  });

  // Range sliders (padding, margin, borderWidth, borderRadius)
  toolbar.querySelectorAll('.st-range').forEach(input => {
    input.addEventListener('mousedown', () => {
      if (currentTarget) input._oldVal = currentTarget.style[input.dataset.prop] || '';
    });
    input.addEventListener('input', () => {
      if (!currentTarget) return;
      const val = input.value + 'px';
      currentTarget.style[input.dataset.prop] = val;
      input.nextElementSibling.textContent = val;
      if (input.dataset.prop === 'borderWidth' && parseInt(input.value) > 0) {
        if (!currentTarget.style.borderStyle) currentTarget.style.borderStyle = 'solid';
        if (!currentTarget.style.borderColor) currentTarget.style.borderColor = '#000000';
      }
      notifyChange();
    });
    input.addEventListener('change', () => {
      if (currentTarget && input._oldVal !== undefined) {
        recordUndo(currentTarget, input.dataset.prop, input._oldVal);
        input._oldVal = undefined;
      }
    });
  });

  // Emoji picker
  const EMOJIS = [
    '😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😋','😎','🤩','🥳',
    '😏','😒','😞','😔','😟','😕','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤯',
    '👍','👎','👏','🙌','🤝','👋','✋','🖐','👆','👇','👉','👈','✌','🤞','🤟','💪',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❣️','💕','💖','💗','💘','💝',
    '⭐','🌟','✨','⚡','🔥','💥','🎉','🎊','🏆','🥇','🎯','🚀','💡','📌','📎',
    '✅','❌','⚠️','❓','❗','💬','💭','🔔','📢','📣',
    'ℹ️','➡️','⬅️','⬆️','⬇️','↩️','🔄','🔗','📋','📝','📁','📂','🗑️','🔧','⚙️',
    '👤','👥','👨‍💻','👩‍💻','🧑‍💼','📧','📞','🌐','🏠','🔒','🔓','🛡️'
  ];

  const emojiToggle = toolbar.querySelector('.st-emoji-toggle');
  const emojiPicker = toolbar.querySelector('.st-emoji-picker');
  const emojiGrid = toolbar.querySelector('.st-emoji-grid');
  const emojiSearch = toolbar.querySelector('.st-emoji-search');

  function renderEmojis(filter = '') {
    const filtered = filter
      ? EMOJIS.filter(e => e.includes(filter))
      : EMOJIS;
    emojiGrid.innerHTML = filtered.map(e => `<button class="st-emoji-btn">${e}</button>`).join('');
    emojiGrid.querySelectorAll('.st-emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!currentTarget) return;
        // Insert emoji into the selected element
        const sel = window.getSelection();
        if (sel.rangeCount && currentTarget.contains(sel.anchorNode)) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(btn.textContent));
          range.collapse(false);
        } else {
          currentTarget.textContent += btn.textContent;
        }
        notifyChange();
      });
    });
  }

  renderEmojis();

  emojiToggle.addEventListener('click', () => {
    emojiPicker.classList.toggle('hidden');
    if (!emojiPicker.classList.contains('hidden')) emojiSearch.focus();
  });

  emojiSearch.addEventListener('input', (e) => {
    renderEmojis(e.target.value);
  });

  // Close
  toolbar.querySelector('.st-close').addEventListener('click', hide);
}

function notifyChange() {
  if (onChange) onChange();
}

function recordUndo(element, property, oldValue) {
  undoStack.push({ element, property, oldValue });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

function undo() {
  const entry = undoStack.pop();
  if (!entry) return;
  entry.element.style[entry.property] = entry.oldValue;
  // If the undone element is currently selected, refresh the toolbar readings
  if (entry.element === currentTarget) {
    readCurrentStyles(currentTarget);
  }
  notifyChange();
  window.showToast('↩️ Annulé');
}

function syncRangeDisplay(input) {
  if (!input || !currentTarget) return;
  const val = parseInt(currentTarget.style[input.dataset.prop]) || 0;
  input.value = val;
  if (input.nextElementSibling) input.nextElementSibling.textContent = val + 'px';
}

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';
  if (rgb.startsWith('#')) return rgb;
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return '#000000';
  return '#' + match.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
}

function parsePx(val) {
  return parseInt(val) || 0;
}

function readCurrentStyles(el) {
  const computed = window.getComputedStyle(el);

  // Colors
  toolbar.querySelector('[data-prop="backgroundColor"]').value = rgbToHex(computed.backgroundColor);
  toolbar.querySelector('[data-prop="color"]').value = rgbToHex(computed.color);
  toolbar.querySelector('[data-prop="borderColor"]').value = rgbToHex(computed.borderColor || computed.borderTopColor);

  // Font size
  toolbar.querySelector('[data-prop="fontSize"]').value = parsePx(computed.fontSize);

  // Toggles
  toolbar.querySelectorAll('.st-toggle').forEach(btn => {
    const val = computed[btn.dataset.prop];
    btn.classList.toggle('active', val === btn.dataset.on);
  });

  // Alignment
  const align = computed.textAlign || 'left';
  toolbar.querySelectorAll('.st-align').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.align === align);
  });

  // Ranges
  toolbar.querySelectorAll('.st-range').forEach(input => {
    const val = parsePx(computed[input.dataset.prop]);
    input.value = val;
    input.nextElementSibling.textContent = val + 'px';
  });
}

function show(target, changeCallback) {
  if (!toolbar) create();

  // Clear previous selection highlight
  if (currentTarget && currentTarget !== target) {
    currentTarget.classList.remove('st-selected');
  }

  currentTarget = target;
  onChange = changeCallback;

  readCurrentStyles(target);

  // Highlight target
  target.classList.add('st-selected');

  toolbar.classList.remove('hidden');
}

function hide() {
  if (!toolbar) return;
  toolbar.classList.add('hidden');
  if (currentTarget) {
    currentTarget.classList.remove('st-selected');
    currentTarget = null;
  }
  onChange = null;
}

function isToolbarElement(el) {
  return toolbar && toolbar.contains(el);
}

export function initStyleToolbar(previewSelector, changeCallback) {
  const preview = document.querySelector(previewSelector);
  if (!preview) return;

  preview.addEventListener('click', (e) => {
    e.stopPropagation();
    const target = e.target;

    // Don't open toolbar for the preview container itself
    if (target === preview) {
      hide();
      return;
    }

    show(target, changeCallback);
  });
}

// Close on click outside
document.addEventListener('mousedown', (e) => {
  if (!toolbar || toolbar.classList.contains('hidden')) return;
  if (isToolbarElement(e.target)) return;
  if (e.target.closest('.preview-frame') || e.target.closest('.block-preview')) return;
  hide();
});

// Ctrl+Z / Cmd+Z to undo style changes
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    if (undoStack.length > 0) {
      e.preventDefault();
      undo();
    }
  }
});

export { hide as hideStyleToolbar };
