const STORAGE_KEY = 'ztb-components';
const TEMPLATES_KEY = 'ztb-templates';
const TRASH_KEY = 'ztb-trash';

// --- File System Access API ---
// Quand un dossier est sélectionné, on lit/écrit directement dedans.
// Sinon, fallback localStorage.

let dirHandle = null; // FileSystemDirectoryHandle

export function hasFolderAccess() {
  return dirHandle !== null;
}

export async function requestFolder() {
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    // Sauvegarder le handle pour les sessions futures (IndexedDB)
    await saveDirHandle(dirHandle);
    return true;
  } catch {
    return false;
  }
}

// Persister le handle dans IndexedDB pour ne pas redemander à chaque visite
function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('zds-handles', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandle(handle) {
  const db = await openHandleDB();
  const tx = db.transaction('handles', 'readwrite');
  tx.objectStore('handles').put(handle, 'dataDir');
  return new Promise((resolve) => { tx.oncomplete = resolve; });
}

async function loadDirHandle() {
  try {
    const db = await openHandleDB();
    const tx = db.transaction('handles', 'readonly');
    const req = tx.objectStore('handles').get('dataDir');
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

// Tente de restaurer l'accès au dossier (au démarrage)
export async function restoreFolderAccess() {
  const handle = await loadDirHandle();
  if (!handle) return false;
  // Vérifier que la permission est toujours active
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') {
    dirHandle = handle;
    return true;
  }
  // Demander la permission (nécessite un geste utilisateur)
  const req = await handle.requestPermission({ mode: 'readwrite' });
  if (req === 'granted') {
    dirHandle = handle;
    return true;
  }
  return false;
}

async function readJsonFile(filename, fallback = []) {
  if (!dirHandle) return fallback;
  try {
    const fileHandle = await dirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const content = await file.text();
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : (data?.items || fallback);
  } catch (e) {
    if (e.name === 'NotFoundError') return fallback;
    console.error('readJsonFile error:', e);
    return fallback;
  }
}

async function writeJsonFile(filename, items) {
  if (!dirHandle) return;
  try {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(items, null, 2));
    await writable.close();
  } catch (e) {
    console.error('writeJsonFile error:', e);
  }
}

// --- API publique ---

export async function getComponents() {
  if (dirHandle) return readJsonFile('components.json', []);
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

export async function saveComponents(components) {
  if (dirHandle) return writeJsonFile('components.json', components);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(components));
}

export async function getComponent(id) {
  const components = await getComponents();
  return components.find(c => c.id === id);
}

export function sortComponents(components, sortBy = 'name') {
  const sorted = [...components];
  sorted.sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    switch (sortBy) {
      case 'name': return (a.name || '').localeCompare(b.name || '');
      case 'date': return (b.updatedAt || 0) - (a.updatedAt || 0);
      case 'category': return (a.category || '').localeCompare(b.category || '');
      default: return 0;
    }
  });
  return sorted;
}

export async function saveComponent(component) {
  const components = await getComponents();
  const idx = components.findIndex(c => c.id === component.id);
  if (idx >= 0) {
    components[idx] = { ...component, updatedAt: Date.now() };
  } else {
    components.push({ ...component, favorite: false, createdAt: Date.now(), updatedAt: Date.now() });
  }
  await saveComponents(components);
}

export async function toggleFavorite(id) {
  const components = await getComponents();
  const comp = components.find(c => c.id === id);
  if (comp) {
    comp.favorite = !comp.favorite;
    await saveComponents(components);
  }
  return comp?.favorite;
}

export async function deleteComponent(id) {
  const components = await getComponents();
  const comp = components.find(c => c.id === id);
  if (comp) {
    const trash = await getTrash();
    trash.unshift({ ...comp, deletedAt: Date.now() });
    await saveTrash(trash);
  }
  await saveComponents(components.filter(c => c.id !== id));
}

export async function getTrash() {
  if (dirHandle) return readJsonFile('trash.json', []);
  try { return JSON.parse(localStorage.getItem(TRASH_KEY)) || []; }
  catch { return []; }
}

async function saveTrash(trash) {
  if (dirHandle) return writeJsonFile('trash.json', trash);
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
}

export async function restoreFromTrash(id) {
  const trash = await getTrash();
  const comp = trash.find(c => c.id === id);
  if (!comp) return null;
  const { deletedAt, ...restored } = comp;
  await saveComponent(restored);
  await saveTrash(trash.filter(c => c.id !== id));
  return restored;
}

export async function removeFromTrash(id) {
  const trash = (await getTrash()).filter(c => c.id !== id);
  await saveTrash(trash);
}

export async function emptyTrash() {
  await saveTrash([]);
}

export async function getTemplates() {
  if (dirHandle) return readJsonFile('templates.json', []);
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || []; }
  catch { return []; }
}

async function saveTemplates(templates) {
  if (dirHandle) return writeJsonFile('templates.json', templates);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export async function saveTemplate(template) {
  const templates = await getTemplates();
  const idx = templates.findIndex(t => t.id === template.id);
  if (idx >= 0) {
    templates[idx] = { ...template, updatedAt: Date.now() };
  } else {
    templates.push({ ...template, createdAt: Date.now(), updatedAt: Date.now() });
  }
  await saveTemplates(templates);
}

export async function deleteTemplate(id) {
  const templates = (await getTemplates()).filter(t => t.id !== id);
  await saveTemplates(templates);
}

export async function exportComponentsJSON() {
  const components = await getComponents();
  return JSON.stringify(components, null, 2);
}

export async function exportSingleComponentJSON(id) {
  const components = await getComponents();
  const comp = components.find(c => c.id === id);
  if (!comp) return null;
  return JSON.stringify([comp], null, 2);
}

export async function importComponentsJSON(json) {
  const imported = JSON.parse(json);
  if (!Array.isArray(imported)) throw new Error('Format invalide');
  const existing = await getComponents();
  const existingIds = new Set(existing.map(c => c.id));
  let added = 0;
  for (const comp of imported) {
    if (!comp.id || !comp.name || !comp.html) continue;
    if (existingIds.has(comp.id)) {
      const idx = existing.findIndex(c => c.id === comp.id);
      existing[idx] = { ...comp, updatedAt: Date.now() };
    } else {
      existing.push({ ...comp, createdAt: Date.now(), updatedAt: Date.now() });
    }
    added++;
  }
  await saveComponents(existing);
  return added;
}

// --- Import/Export natif Tauri (dialogues fichier) ---

export async function exportWithDialog() {
  const json = await exportComponentsJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'zendesk-components.json';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function importWithDialog() {
  return null; // Handled via <input type="file"> in builder.js
}


