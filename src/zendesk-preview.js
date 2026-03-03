// src/zendesk-preview.js

const SCOPE = '.zd-context';
const STYLE_ID = 'zd-scoped-style';
const STORAGE_KEY = 'zd-preview-mode';

let scopedCSS = null;

/**
 * Charge et scope le CSS Zendesk (une seule fois, mis en cache).
 */
async function loadCSS() {
  if (scopedCSS !== null) return scopedCSS;
  const res = await fetch('/zendesk-style.css');
  const raw = await res.text();
  scopedCSS = scopeCSS(raw, SCOPE);
  return scopedCSS;
}

/**
 * Scope tous les sélecteurs CSS avec le préfixe donné.
 * - @font-face, @keyframes, @charset : conservés globalement (pas de préfixe)
 * - @media / @supports : sélecteurs internes préfixés récursivement
 * - body → SCOPE
 * - :root → conservé tel quel
 * - autres sélecteurs → préfixés avec SCOPE
 */
function scopeCSS(css, scope) {
  let result = '';
  let i = 0;
  const len = css.length;

  while (i < len) {
    // Trouver le prochain {
    let j = i;
    while (j < len && css[j] !== '{') j++;
    if (j >= len) { result += css.slice(i); break; }

    const selector = css.slice(i, j).trim();

    // Blocs globaux (pas de scoping)
    if (/^@font-face/i.test(selector) || /^@keyframes/i.test(selector) || /^@charset/i.test(selector)) {
      const end = findClosing(css, j);
      result += css.slice(i, end) + '\n';
      i = end;
      continue;
    }

    // @media / @supports : scoper les sélecteurs internes récursivement
    if (/^@media|^@supports/i.test(selector)) {
      const end = findClosing(css, j);
      const inner = css.slice(j + 1, end - 1);
      const scopedInner = scopeCSS(inner, scope);
      result += selector + ' {\n' + scopedInner + '\n}\n';
      i = end;
      continue;
    }

    // Sélecteur normal
    const end = findClosing(css, j);
    const declarations = css.slice(j, end); // inclut { ... }
    const scopedSelector = selector
      .split(',')
      .map(s => {
        s = s.trim();
        if (!s) return '';
        if (s === 'body') return scope;
        if (/^:root\b/.test(s)) return s;
        if (s.startsWith('@')) return s;
        return `${scope} ${s}`;
      })
      .filter(Boolean)
      .join(',\n');
    result += scopedSelector + ' ' + declarations + '\n';
    i = end;
  }

  return result;
}

/**
 * Trouve la position après le } fermant correspondant au { à l'index `openIdx`.
 */
function findClosing(css, openIdx) {
  let depth = 0;
  let i = openIdx;
  while (i < css.length) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') { depth--; if (depth === 0) return i + 1; }
    i++;
  }
  return css.length;
}

/**
 * Active la vue Zendesk sur un élément preview.
 */
export async function enableZendeskPreview(previewEl) {
  if (!document.getElementById(STYLE_ID)) {
    const css = await loadCSS();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }
  previewEl.classList.add('zd-context');
  localStorage.setItem(STORAGE_KEY, 'true');
}

/**
 * Désactive la vue Zendesk sur un élément preview.
 */
export function disableZendeskPreview(previewEl) {
  previewEl.classList.remove('zd-context');
  const stillActive = document.querySelectorAll('.zd-context').length;
  if (stillActive === 0) {
    document.getElementById(STYLE_ID)?.remove();
  }
  localStorage.setItem(STORAGE_KEY, 'false');
}

/**
 * Retourne true si le mode Zendesk était activé lors de la dernière session.
 */
export function isZendeskPreviewEnabled() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}
