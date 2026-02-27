import { isAuthenticated } from './auth.js';
import { api } from './api.js';

export const defaultFolders = {
  header:  { label: 'En-tête',       icon: '📌', color: '#0984e3' },
  content: { label: 'Contenu',       icon: '📝', color: '#6c5ce7' },
  callout: { label: 'Callout',       icon: '💡', color: '#fdcb6e' },
  list:    { label: 'Liste',         icon: '📋', color: '#00cec9' },
  footer:  { label: 'Pied de page',  icon: '📎', color: '#636e72' },
  other:   { label: 'Autre',         icon: '🔧', color: '#b2bec3' },
};

const folderColors = ['#e17055','#00b894','#0984e3','#6c5ce7','#fdcb6e','#e84393','#00cec9','#636e72'];
let colorIdx = 0;

// Cache local des dossiers (chargé depuis l'API)
let foldersCache = null;

export async function loadFolders() {
  if (!isAuthenticated()) { foldersCache = { ...defaultFolders }; return; }
  try {
    foldersCache = await api.getFolders();
    if (!foldersCache || Object.keys(foldersCache).length === 0) {
      foldersCache = { ...defaultFolders };
    }
  } catch {
    foldersCache = { ...defaultFolders };
  }
}

export function getFolders() {
  return foldersCache || { ...defaultFolders };
}

export async function saveFolders(folders) {
  foldersCache = folders;
  if (isAuthenticated()) {
    try { await api.saveFolders(folders); } catch (e) { console.error('saveFolders error:', e); }
  }
}

export async function addFolder(key, label) {
  const folders = getFolders();
  if (folders[key]) return false;
  folders[key] = { label, icon: '📁', color: folderColors[colorIdx++ % folderColors.length] };
  await saveFolders(folders);
  return true;
}

export async function renameFolder(key, newLabel) {
  const folders = getFolders();
  if (!folders[key]) return false;
  folders[key].label = newLabel;
  await saveFolders(folders);
  return true;
}

export async function deleteFolder(key) {
  const folders = getFolders();
  if (!folders[key]) return false;
  delete folders[key];
  await saveFolders(folders);
  return true;
}

export function categoryBadge(categoryKey) {
  const folders = getFolders();
  const cat = folders[categoryKey] || defaultFolders.other;
  return `<span class="category-badge" style="--cat-color: ${cat.color}">${cat.icon} ${cat.label}</span>`;
}
