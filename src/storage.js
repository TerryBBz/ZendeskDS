import { isAuthenticated } from './auth.js';
import { api } from './api.js';

// --- API publique ---

export async function getComponents() {
  if (!isAuthenticated()) return [];
  try { return await api.getComponents(); }
  catch (e) { console.error('getComponents error:', e); return []; }
}

export async function saveComponents(_components) {
  // No-op in cloud mode — individual saves via saveComponent
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
  if (!isAuthenticated()) return;
  try {
    const existing = await getComponent(component.id);
    if (existing) {
      await api.updateComponent(component.id, { ...component, updatedAt: existing.updatedAt });
    } else {
      await api.createComponent(component);
    }
  } catch (e) {
    console.error('saveComponent error:', e);
    throw e;
  }
}

export async function toggleFavorite(id) {
  const comp = await getComponent(id);
  if (comp) {
    comp.favorite = !comp.favorite;
    await api.updateComponent(id, comp);
  }
  return comp?.favorite;
}

export async function deleteComponent(id) {
  if (!isAuthenticated()) return;
  try { await api.deleteComponent(id); }
  catch (e) { console.error('deleteComponent error:', e); }
}

export async function getTrash() {
  if (!isAuthenticated()) return [];
  try { return await api.getTrash(); }
  catch (e) { console.error('getTrash error:', e); return []; }
}

export async function restoreFromTrash(id) {
  if (!isAuthenticated()) return null;
  try {
    await api.restoreFromTrash(id);
    return { id };
  } catch (e) { console.error('restoreFromTrash error:', e); return null; }
}

export async function removeFromTrash(id) {
  if (!isAuthenticated()) return;
  try { await api.removeFromTrash(id); }
  catch (e) { console.error('removeFromTrash error:', e); }
}

export async function emptyTrash() {
  if (!isAuthenticated()) return;
  try { await api.emptyTrash(); }
  catch (e) { console.error('emptyTrash error:', e); }
}

export async function getTemplates() {
  if (!isAuthenticated()) return [];
  try { return await api.getTemplates(); }
  catch (e) { console.error('getTemplates error:', e); return []; }
}

export async function saveTemplate(template) {
  if (!isAuthenticated()) return;
  try {
    const existing = (await getTemplates()).find(t => t.id === template.id);
    if (existing) {
      await api.updateTemplate(template.id, template);
    } else {
      await api.createTemplate(template);
    }
  } catch (e) { console.error('saveTemplate error:', e); }
}

export async function deleteTemplate(id) {
  if (!isAuthenticated()) return;
  try { await api.deleteTemplate(id); }
  catch (e) { console.error('deleteTemplate error:', e); }
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
  let added = 0;
  for (const comp of imported) {
    if (!comp.id || !comp.name || !comp.html) continue;
    await saveComponent(comp);
    added++;
  }
  return added;
}

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
