const STORAGE_KEY = 'ztb-components';
const TEMPLATES_KEY = 'ztb-templates';
const TRASH_KEY = 'ztb-trash';

export function getComponents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

export function saveComponents(components) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(components));
}

export function getComponent(id) {
  return getComponents().find(c => c.id === id);
}

export function sortComponents(components, sortBy = 'name') {
  const sorted = [...components];
  sorted.sort((a, b) => {
    // Favorites always first
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

export function saveComponent(component) {
  const components = getComponents();
  const idx = components.findIndex(c => c.id === component.id);
  if (idx >= 0) {
    components[idx] = { ...component, updatedAt: Date.now() };
  } else {
    components.push({ ...component, favorite: false, createdAt: Date.now(), updatedAt: Date.now() });
  }
  saveComponents(components);
}

export function toggleFavorite(id) {
  const components = getComponents();
  const comp = components.find(c => c.id === id);
  if (comp) {
    comp.favorite = !comp.favorite;
    saveComponents(components);
  }
  return comp?.favorite;
}

export function deleteComponent(id) {
  const components = getComponents();
  const comp = components.find(c => c.id === id);
  if (comp) {
    // Move to trash
    const trash = getTrash();
    trash.unshift({ ...comp, deletedAt: Date.now() });
    localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
  }
  saveComponents(components.filter(c => c.id !== id));
}

export function getTrash() {
  try {
    return JSON.parse(localStorage.getItem(TRASH_KEY)) || [];
  } catch { return []; }
}

export function restoreFromTrash(id) {
  const trash = getTrash();
  const comp = trash.find(c => c.id === id);
  if (!comp) return null;
  const { deletedAt, ...restored } = comp;
  saveComponent(restored);
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash.filter(c => c.id !== id)));
  return restored;
}

export function removeFromTrash(id) {
  const trash = getTrash().filter(c => c.id !== id);
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
}

export function emptyTrash() {
  localStorage.setItem(TRASH_KEY, JSON.stringify([]));
}

export function getTemplates() {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || [];
  } catch { return []; }
}

export function saveTemplate(template) {
  const templates = getTemplates();
  const idx = templates.findIndex(t => t.id === template.id);
  if (idx >= 0) {
    templates[idx] = { ...template, updatedAt: Date.now() };
  } else {
    templates.push({ ...template, createdAt: Date.now(), updatedAt: Date.now() });
  }
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function deleteTemplate(id) {
  const templates = getTemplates().filter(t => t.id !== id);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function exportComponentsJSON() {
  return JSON.stringify(getComponents(), null, 2);
}

export function exportSingleComponentJSON(id) {
  const comp = getComponents().find(c => c.id === id);
  if (!comp) return null;
  return JSON.stringify([comp], null, 2);
}

export function importComponentsJSON(json) {
  const imported = JSON.parse(json);
  if (!Array.isArray(imported)) throw new Error('Format invalide');
  const existing = getComponents();
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
  saveComponents(existing);
  return added;
}
