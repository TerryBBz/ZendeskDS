const FOLDERS_KEY = 'ztb-folders';

export const defaultFolders = {
  header:  { label: 'En-tête',       icon: '📌', color: '#0984e3' },
  content: { label: 'Contenu',       icon: '📝', color: '#6c5ce7' },
  callout: { label: 'Callout',       icon: '💡', color: '#fdcb6e' },
  list:    { label: 'Liste',         icon: '📋', color: '#00cec9' },
  footer:  { label: 'Pied de page',  icon: '📎', color: '#636e72' },
  other:   { label: 'Autre',         icon: '🔧', color: '#b2bec3' },
};

// Couleurs assignées aux nouveaux dossiers
const folderColors = ['#e17055','#00b894','#0984e3','#6c5ce7','#fdcb6e','#e84393','#00cec9','#636e72'];
let colorIdx = 0;

export function getFolders() {
  try {
    const saved = localStorage.getItem(FOLDERS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { ...defaultFolders };
}

export function saveFolders(folders) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

export function addFolder(key, label) {
  const folders = getFolders();
  if (folders[key]) return false;
  folders[key] = { label, icon: '📁', color: folderColors[colorIdx++ % folderColors.length] };
  saveFolders(folders);
  return true;
}

export function renameFolder(key, newLabel) {
  const folders = getFolders();
  if (!folders[key]) return false;
  folders[key].label = newLabel;
  saveFolders(folders);
  return true;
}

export function deleteFolder(key) {
  const folders = getFolders();
  if (!folders[key] || key === 'other') return false;
  delete folders[key];
  saveFolders(folders);
  return true;
}

export function categoryBadge(categoryKey) {
  const folders = getFolders();
  const cat = folders[categoryKey] || defaultFolders.other;
  return `<span class="category-badge" style="--cat-color: ${cat.color}">${cat.icon} ${cat.label}</span>`;
}
