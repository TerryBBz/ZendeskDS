import { getToken, clearToken } from './auth.js';

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Session expirée');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Components
  getComponents: () => apiFetch('/api/components'),
  createComponent: (comp) => apiFetch('/api/components', { method: 'POST', body: JSON.stringify(comp) }),
  updateComponent: (id, comp) => apiFetch(`/api/components/${id}`, { method: 'PUT', body: JSON.stringify(comp) }),
  deleteComponent: (id) => apiFetch(`/api/components/${id}`, { method: 'DELETE' }),

  // Templates
  getTemplates: () => apiFetch('/api/templates'),
  createTemplate: (tpl) => apiFetch('/api/templates', { method: 'POST', body: JSON.stringify(tpl) }),
  updateTemplate: (id, tpl) => apiFetch(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(tpl) }),
  deleteTemplate: (id) => apiFetch(`/api/templates/${id}`, { method: 'DELETE' }),

  // Trash
  getTrash: () => apiFetch('/api/trash'),
  restoreFromTrash: (id) => apiFetch(`/api/trash/${id}`, { method: 'POST' }),
  removeFromTrash: (id) => apiFetch(`/api/trash/${id}`, { method: 'DELETE' }),
  emptyTrash: () => apiFetch('/api/trash', { method: 'DELETE' }),

  // Folders
  getFolders: () => apiFetch('/api/folders'),
  saveFolders: (folders) => apiFetch('/api/folders', { method: 'PUT', body: JSON.stringify(folders) }),
};
