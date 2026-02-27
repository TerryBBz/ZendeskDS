import Sortable from 'sortablejs';
import { EditorView, basicSetup } from 'codemirror';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import {
  getComponents, saveComponent, deleteComponent,
  exportComponentsJSON, importComponentsJSON,
  getTrash, restoreFromTrash, removeFromTrash, emptyTrash,
  toggleFavorite, sortComponents, getComponent,
} from './storage.js';
import { categoryBadge, getFolders, addFolder, renameFolder, deleteFolder, defaultFolders, loadFolders } from './categories.js';
import { initStyleToolbar } from './style-toolbar.js';

let editorView = null;
let currentComponentId = null;
let previewUpdating = false;
let selectMode = false;
let selectedIds = new Set();
let hasUnsavedChanges = false;
let autosaveTimer = null;
const AUTOSAVE_DELAY = 1500; // 1.5s après la dernière modif

function generateId() {
  return 'comp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
}

// Track collapsed folders
const collapsedFolders = new Set();

async function renderComponentList(filter = '') {
  const list = document.getElementById('component-list');
  const sortBy = document.getElementById('builder-sort')?.value || 'name';
  const components = await getComponents();
  const filtered = filter
    ? components.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        (c.category || '').toLowerCase().includes(filter.toLowerCase())
      )
    : components;
  const sorted = sortComponents(filtered, sortBy);
  list.innerHTML = '';

  if (sorted.length === 0 && !filter) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">Aucun composant</p>`;
    return;
  }

  // Show search results flat (no folders)
  if (filter) {
    sorted.forEach(comp => list.appendChild(createComponentEl(comp, filter)));
    if (sorted.length === 0) {
      list.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">Aucun résultat</p>`;
    }
    return;
  }

  const folders = getFolders();

  // Group components by folderId
  const groups = {};
  const noFolder = [];
  for (const comp of sorted) {
    if (comp.folderId && folders[comp.folderId]) {
      if (!groups[comp.folderId]) groups[comp.folderId] = [];
      groups[comp.folderId].push(comp);
    } else {
      noFolder.push(comp);
    }
  }

  // Render each folder
  for (const [key, folder] of Object.entries(folders)) {
    const comps = groups[key] || [];
    const isCollapsed = collapsedFolders.has(key);

    const section = document.createElement('div');
    section.className = 'folder-section';
    section.dataset.folderId = key;

    const header = document.createElement('div');
    header.className = 'folder-header';
    header.innerHTML = `
      <span class="folder-toggle">${isCollapsed ? '▶' : '▼'}</span>
      <span class="folder-icon" style="color:${folder.color}">${folder.icon}</span>
      <span class="folder-label">${escapeHtml(folder.label)}</span>
      <span class="folder-count">${comps.length}</span>
      <div class="folder-actions">
        <button class="folder-rename-btn" title="Renommer">✏️</button>
        <button class="folder-delete-btn" title="Supprimer le dossier">✕</button>
      </div>
    `;

    header.addEventListener('click', (e) => {
      if (e.target.closest('.folder-actions')) return;
      if (isCollapsed) collapsedFolders.delete(key);
      else collapsedFolders.add(key);
      renderComponentList(filter);
    });

    header.querySelector('.folder-rename-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const newName = prompt('Nouveau nom du dossier :', folder.label);
      if (newName && newName.trim()) {
        await renameFolder(key, newName.trim());
        renderComponentList(filter);
      }
    });

    header.querySelector('.folder-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (comps.length > 0) {
        const choice = confirm(
          `Supprimer le dossier "${folder.label}" ?\n\n` +
          `Il contient ${comps.length} composant(s).\n\n` +
          `OK = Supprimer le dossier ET les composants\n` +
          `Annuler = Ne rien faire`
        );
        if (!choice) {
          // Propose de garder les composants
          const keep = confirm(`Voulez-vous retirer les composants du dossier sans les supprimer ?`);
          if (keep) {
            for (const comp of comps) {
              await saveComponent({ ...comp, folderId: null });
            }
            await deleteFolder(key);
            renderComponentList(filter);
            window.showToast('📁 Dossier supprimé, composants conservés');
          }
          return;
        }
        // Delete folder AND components
        for (const comp of comps) {
          await deleteComponent(comp.id);
        }
      }
      await deleteFolder(key);
      renderComponentList(filter);
      window.showToast('🗑️ Dossier supprimé');
    });

    section.appendChild(header);

    const compContainer = document.createElement('div');
    compContainer.className = 'folder-components';
    compContainer.dataset.folderId = key;
    if (!isCollapsed) {
      comps.forEach(comp => compContainer.appendChild(createComponentEl(comp, filter)));
    }
    section.appendChild(compContainer);

    // Enable drop into folder
    new Sortable(compContainer, {
      group: 'components',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onAdd: async (evt) => {
        const compId = evt.item.dataset.componentId;
        if (compId) {
          const comp = await getComponent(compId);
          if (comp) await saveComponent({ ...comp, folderId: key });
          renderComponentList(filter);
        }
      }
    });

    list.appendChild(section);
  }

  // Render components without folder
  if (noFolder.length > 0) {
    const section = document.createElement('div');
    section.className = 'folder-section';

    const header = document.createElement('div');
    header.className = 'folder-header';
    const isCollapsed = collapsedFolders.has('__none__');
    header.innerHTML = `
      <span class="folder-toggle">${isCollapsed ? '▶' : '▼'}</span>
      <span class="folder-icon" style="color:#b2bec3">📂</span>
      <span class="folder-label">Sans dossier</span>
      <span class="folder-count">${noFolder.length}</span>
    `;
    header.addEventListener('click', () => {
      if (isCollapsed) collapsedFolders.delete('__none__');
      else collapsedFolders.add('__none__');
      renderComponentList(filter);
    });
    section.appendChild(header);

    const compContainer = document.createElement('div');
    compContainer.className = 'folder-components';
    compContainer.dataset.folderId = '__none__';
    if (!isCollapsed) {
      noFolder.forEach(comp => compContainer.appendChild(createComponentEl(comp, filter)));
    }
    section.appendChild(compContainer);

    new Sortable(compContainer, {
      group: 'components',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onAdd: async (evt) => {
        const compId = evt.item.dataset.componentId;
        if (compId) {
          const comp = await getComponent(compId);
          if (comp) await saveComponent({ ...comp, folderId: null });
          renderComponentList(filter);
        }
      }
    });

    list.appendChild(section);
  }
}

function createComponentEl(comp, filter = '') {
  const isFav = comp.favorite;
  const el = document.createElement('div');
  el.className = 'component-item' + (comp.id === currentComponentId ? ' selected' : '');
  el.dataset.componentId = comp.id;
  el.innerHTML = `
    <div class="component-item-row">
      ${selectMode ? `<input type="checkbox" class="select-cb" ${selectedIds.has(comp.id) ? 'checked' : ''} />` : ''}
      <button class="fav-btn ${isFav ? 'active' : ''}" title="Favori">${isFav ? '★' : '☆'}</button>
      <div class="component-item-info">
        <div class="name">${escapeHtml(comp.name)}</div>
      </div>
      ${!selectMode ? '<button class="delete-item-btn" title="Supprimer">🗑️</button>' : ''}
    </div>
  `;
  if (selectMode) {
    const cb = el.querySelector('.select-cb');
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', (e) => {
      if (e.target.checked) selectedIds.add(comp.id);
      else selectedIds.delete(comp.id);
    });
    el.addEventListener('click', () => {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });
  } else {
    el.querySelector('.fav-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFavorite(comp.id);
      renderComponentList(filter);
    });
    el.querySelector('.delete-item-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Supprimer "${comp.name}" ?`)) return;
      await deleteComponent(comp.id);
      if (currentComponentId === comp.id) {
        currentComponentId = null;
        document.getElementById('editor-placeholder').classList.remove('hidden');
        document.getElementById('editor-area').classList.add('hidden');
      }
      await renderComponentList(filter);
      window.showToast('🗑️ Composant mis à la corbeille');
    });
    el.addEventListener('click', () => selectComponent(comp.id));
  }
  return el;
}

const categoryTypes = {
  header:  { label: 'En-tête',       icon: '📌' },
  content: { label: 'Contenu',       icon: '📝' },
  callout: { label: 'Callout',       icon: '💡' },
  list:    { label: 'Liste',         icon: '📋' },
  footer:  { label: 'Pied de page',  icon: '📎' },
  other:   { label: 'Autre',         icon: '🔧' },
};

function refreshCategoryDropdown() {
  const select = document.getElementById('component-category');
  const current = select.value;
  select.innerHTML = '';
  for (const [key, cat] of Object.entries(categoryTypes)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${cat.icon} ${cat.label}`;
    select.appendChild(opt);
  }
  select.value = current || 'other';
}

async function selectComponent(id) {
  currentComponentId = id;
  const comp = await getComponent(id);
  if (!comp) return;

  document.getElementById('editor-placeholder').classList.add('hidden');
  document.getElementById('editor-area').classList.remove('hidden');
  document.getElementById('component-name').value = comp.name;
  document.getElementById('component-category').value = comp.category;

  if (editorView) {
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: comp.html }
    });
  }

  updatePreview(comp.html);
  renderComponentList();
}

function updatePreview(htmlContent) {
  const preview = document.getElementById('component-preview');
  // Only update if not currently editing the preview (avoid cursor jump)
  if (!previewUpdating) {
    preview.innerHTML = htmlContent;
  }
}

function syncEditorFromPreview() {
  if (!editorView) return;
  const preview = document.getElementById('component-preview');
  const newHtml = preview.innerHTML;
  previewUpdating = true;
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: newHtml }
  });
  previewUpdating = false;
}

function scheduleAutosave() {
  if (!currentComponentId) return;
  hasUnsavedChanges = true;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveCurrentComponent(true);
  }, AUTOSAVE_DELAY);
}

function createEditor() {
  const container = document.getElementById('codemirror-container');

  const updateListener = EditorView.updateListener.of(update => {
    if (update.docChanged && !previewUpdating) {
      updatePreview(update.state.doc.toString());
      scheduleAutosave();
    }
  });

  editorView = new EditorView({
    state: EditorState.create({
      doc: '',
      extensions: [basicSetup, html(), oneDark, updateListener]
    }),
    parent: container
  });
}

async function newComponent() {
  const id = generateId();
  const comp = {
    id,
    name: 'Nouveau composant',
    category: 'content',
    html: '<div style="padding: 16px; background: #f9f9f9; border-radius: 8px;">\n  <p>Votre contenu ici</p>\n</div>'
  };
  await saveComponent(comp);
  await renderComponentList();
  await selectComponent(id);
  document.getElementById('component-name').select();
}

async function saveCurrentComponent(auto = false) {
  if (!currentComponentId || !editorView) return;
  const existing = await getComponent(currentComponentId);
  const comp = {
    id: currentComponentId,
    name: document.getElementById('component-name').value || 'Sans nom',
    category: document.getElementById('component-category').value,
    html: editorView.state.doc.toString(),
    folderId: existing?.folderId || null
  };
  await saveComponent(comp);
  hasUnsavedChanges = false;
  await renderComponentList();
  if (!auto) window.showToast('✅ Composant sauvegardé');
}

async function deleteCurrentComponent() {
  if (!currentComponentId) return;
  await deleteComponent(currentComponentId);
  currentComponentId = null;
  document.getElementById('editor-placeholder').classList.remove('hidden');
  document.getElementById('editor-area').classList.add('hidden');
  await renderComponentList();
  window.showToast('🗑️ Composant mis à la corbeille');
}

function downloadJSON(json, filename) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleExportAll() {
  const json = await exportComponentsJSON();
  downloadJSON(json, 'zendesk-components.json');
  window.showToast('📤 Tous les composants exportés');
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const count = await importComponentsJSON(reader.result);
      await renderComponentList();
      window.showToast(`📥 ${count} composant(s) importé(s)`);
    } catch (err) {
      window.showToast('❌ Erreur d\'import: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function openTrash() {
  const modal = document.getElementById('trash-modal');
  renderTrashList();
  modal.classList.remove('hidden');
}

async function renderTrashList() {
  const list = document.getElementById('trash-list');
  const trash = await getTrash();
  list.innerHTML = '';

  if (trash.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);">La corbeille est vide 🎉</p>';
    return;
  }

  trash.forEach(comp => {
    const date = new Date(comp.deletedAt).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    const el = document.createElement('div');
    el.className = 'trash-item';
    el.innerHTML = `
      <div class="trash-info">
        <div class="trash-name">${escapeHtml(comp.name)}</div>
        <div class="trash-date">Supprimé le ${date}</div>
      </div>
      <div class="trash-actions">
        <button class="btn btn-primary btn-sm restore-btn">↩️ Restaurer</button>
        <button class="btn btn-danger btn-sm permadelete-btn">✕</button>
      </div>
    `;
    el.querySelector('.restore-btn').addEventListener('click', async () => {
      await restoreFromTrash(comp.id);
      await renderTrashList();
      await renderComponentList();
      window.showToast('↩️ Composant restauré');
    });
    el.querySelector('.permadelete-btn').addEventListener('click', async () => {
      if (!confirm('Supprimer définitivement ?')) return;
      await removeFromTrash(comp.id);
      await renderTrashList();
    });
    list.appendChild(el);
  });
}

export async function initBuilder() {
  createEditor();
  refreshCategoryDropdown();
  await renderComponentList();

  // Make preview editable — sync changes back to CodeMirror
  const preview = document.getElementById('component-preview');
  preview.setAttribute('contenteditable', 'true');
  preview.addEventListener('input', () => {
    syncEditorFromPreview();
  });

  // Search in builder
  document.getElementById('builder-search').addEventListener('input', (e) => {
    renderComponentList(e.target.value);
  });

  document.getElementById('new-component-btn').addEventListener('click', newComponent);
  document.getElementById('save-component-btn').addEventListener('click', saveCurrentComponent);
  document.getElementById('copy-component-html-btn').addEventListener('click', () => {
    if (!editorView) return;
    const html = editorView.state.doc.toString();
    if (!html.trim()) { window.showToast('⚠️ Le composant est vide'); return; }
    navigator.clipboard.writeText(html).then(() => {
      window.showToast('📋 HTML copié !');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = html; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      window.showToast('📋 HTML copié !');
    });
  });
  document.getElementById('delete-component-btn').addEventListener('click', deleteCurrentComponent);
  document.getElementById('export-btn').addEventListener('click', handleExportAll);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', handleImport);
  document.getElementById('trash-btn').addEventListener('click', openTrash);

  // New folder
  document.getElementById('new-folder-btn').addEventListener('click', async () => {
    const name = prompt('Nom du nouveau dossier :');
    if (!name || !name.trim()) return;
    const key = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!key) { window.showToast('❌ Nom invalide'); return; }
    if (!await addFolder(key, name.trim())) { window.showToast('⚠️ Ce dossier existe déjà'); return; }
    renderComponentList();
    window.showToast(`📁 Dossier "${name.trim()}" créé`);
  });

  // Select mode
  document.getElementById('select-mode-btn').addEventListener('click', () => {
    selectMode = true;
    selectedIds.clear();
    document.getElementById('bulk-actions').classList.remove('hidden');
    document.getElementById('select-mode-btn').classList.add('hidden');
    renderComponentList(document.getElementById('builder-search').value);
  });
  document.getElementById('bulk-cancel-btn').addEventListener('click', () => {
    selectMode = false;
    selectedIds.clear();
    document.getElementById('bulk-actions').classList.add('hidden');
    document.getElementById('select-mode-btn').classList.remove('hidden');
    renderComponentList(document.getElementById('builder-search').value);
  });
  document.getElementById('bulk-delete-btn').addEventListener('click', async () => {
    if (selectedIds.size === 0) { window.showToast('⚠️ Aucun composant sélectionné'); return; }
    if (!confirm(`Supprimer ${selectedIds.size} composant(s) ?`)) return;
    for (const id of selectedIds) {
      await deleteComponent(id);
      if (currentComponentId === id) {
        currentComponentId = null;
        document.getElementById('editor-placeholder').classList.remove('hidden');
        document.getElementById('editor-area').classList.add('hidden');
      }
    }
    selectedIds.clear();
    selectMode = false;
    document.getElementById('bulk-actions').classList.add('hidden');
    document.getElementById('select-mode-btn').classList.remove('hidden');
    await renderComponentList();
    window.showToast('🗑️ Composants supprimés');
  });
  document.getElementById('bulk-export-btn').addEventListener('click', async () => {
    if (selectedIds.size === 0) { window.showToast('⚠️ Aucun composant sélectionné'); return; }
    const components = await getComponents();
    const selected = components.filter(c => selectedIds.has(c.id));
    const json = JSON.stringify(selected, null, 2);
    downloadJSON(json, `zendesk-${selectedIds.size}-composants.json`);
    window.showToast(`📤 ${selectedIds.size} composant(s) exporté(s)`);
  });

  // Sort dropdown
  document.getElementById('builder-sort').addEventListener('change', () => {
    renderComponentList(document.getElementById('builder-search').value);
  });
  document.getElementById('trash-modal-close').addEventListener('click', () => {
    document.getElementById('trash-modal').classList.add('hidden');
  });
  document.getElementById('empty-trash-btn').addEventListener('click', async () => {
    if (!confirm('Vider la corbeille définitivement ?')) return;
    await emptyTrash();
    await renderTrashList();
    window.showToast('🗑️ Corbeille vidée');
  });

  // Ctrl+S to save
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (currentComponentId) saveCurrentComponent();
    }
  });

  // Autosave on name/category change
  document.getElementById('component-name').addEventListener('input', scheduleAutosave);
  document.getElementById('component-category').addEventListener('change', scheduleAutosave);

  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
    }
  });

  // Style toolbar on builder preview
  initStyleToolbar('#component-preview', () => {
    syncEditorFromPreview();
  });

  // Refresh data when storage source changes (e.g. folder connected)
  window.addEventListener('storage-changed', () => renderComponentList());
}
