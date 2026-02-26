const STORAGE_KEY = 'ztb-components';
const TEMPLATES_KEY = 'ztb-templates';
const TRASH_KEY = 'ztb-trash';
const DATA_VERSION = 1;
const DATA_FOLDER = 'ZendeskDS';

// --- Détection Tauri ---
const isTauri = () => typeof window !== 'undefined' && window.__TAURI_INTERNALS__;

let tauriFs = null;
let tauriPath = null;

async function loadTauriModules() {
  if (tauriFs) return;
  tauriFs = await import('@tauri-apps/plugin-fs');
  tauriPath = await import('@tauri-apps/api/path');
}

async function getDataDir() {
  await loadTauriModules();
  const docDir = await tauriPath.documentDir();
  return `${docDir}${DATA_FOLDER}`;
}

async function ensureDataDir() {
  await loadTauriModules();
  const dir = await getDataDir();
  const exists = await tauriFs.exists(dir);
  if (!exists) {
    await tauriFs.mkdir(dir, { recursive: true });
  }
  return dir;
}

async function readJsonFile(filename, fallback = []) {
  try {
    await loadTauriModules();
    const dir = await ensureDataDir();
    const path = `${dir}/${filename}`;
    const fileExists = await tauriFs.exists(path);
    if (!fileExists) return fallback;
    const content = await tauriFs.readTextFile(path);
    const data = JSON.parse(content);
    if (data && data._version !== undefined) {
      return data.items || fallback;
    }
    return data || fallback;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filename, items) {
  await loadTauriModules();
  const dir = await ensureDataDir();
  const path = `${dir}/${filename}`;
  const data = { _version: DATA_VERSION, items };
  await tauriFs.writeTextFile(path, JSON.stringify(data, null, 2));
}

// --- API publique (async pour Tauri, sync fallback pour navigateur) ---

export async function getComponents() {
  if (isTauri()) return readJsonFile('components.json', []);
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

export async function saveComponents(components) {
  if (isTauri()) return writeJsonFile('components.json', components);
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
  if (isTauri()) return readJsonFile('trash.json', []);
  try { return JSON.parse(localStorage.getItem(TRASH_KEY)) || []; }
  catch { return []; }
}

async function saveTrash(trash) {
  if (isTauri()) return writeJsonFile('trash.json', trash);
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
  if (isTauri()) return readJsonFile('templates.json', []);
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || []; }
  catch { return []; }
}

async function saveTemplates(templates) {
  if (isTauri()) return writeJsonFile('templates.json', templates);
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
  if (!isTauri()) {
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
  const { save } = await import('@tauri-apps/plugin-dialog');
  const path = await save({
    defaultPath: 'zendesk-components.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (!path) return false;
  await loadTauriModules();
  const json = await exportComponentsJSON();
  await tauriFs.writeTextFile(path, json);
  return true;
}

export async function importWithDialog() {
  if (!isTauri()) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const path = await open({
    filters: [{ name: 'JSON', extensions: ['json'] }],
    multiple: false
  });
  if (!path) return null;
  await loadTauriModules();
  const content = await tauriFs.readTextFile(path);
  return importComponentsJSON(content);
}
