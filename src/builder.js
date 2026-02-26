import { EditorView, basicSetup } from 'codemirror';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import {
  getComponents, saveComponent, deleteComponent,
  exportComponentsJSON, exportSingleComponentJSON, importComponentsJSON,
  getTrash, restoreFromTrash, removeFromTrash, emptyTrash,
  toggleFavorite, sortComponents, getComponent,
  exportWithDialog, importWithDialog
} from './storage.js';
import { categoryBadge } from './categories.js';
import { initStyleToolbar } from './style-toolbar.js';

let editorView = null;
let currentComponentId = null;
let previewUpdating = false; // prevent feedback loop between editor and preview

function generateId() {
  return 'comp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
}

async function renderComponentList(filter = '') {
  const list = document.getElementById('component-list');
  const sortBy = document.getElementById('builder-sort')?.value || 'name';
  const components = await getComponents();
  const filtered = filter
    ? components.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.category.toLowerCase().includes(filter.toLowerCase())
      )
    : components;
  const sorted = sortComponents(filtered, sortBy);
  list.innerHTML = '';

  if (sorted.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">${filter ? 'Aucun résultat' : 'Aucun composant'}</p>`;
    return;
  }

  sorted.forEach(comp => {
    const isFav = comp.favorite;
    const el = document.createElement('div');
    el.className = 'component-item' + (comp.id === currentComponentId ? ' selected' : '');
    el.innerHTML = `
      <div class="component-item-row">
        <button class="fav-btn ${isFav ? 'active' : ''}" title="Favori">${isFav ? '★' : '☆'}</button>
        <div class="component-item-info">
          <div class="name">${escapeHtml(comp.name)}</div>
          <div class="category">${categoryBadge(comp.category)}</div>
        </div>
      </div>
    `;
    el.querySelector('.fav-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFavorite(comp.id);
      renderComponentList(filter);
    });
    el.addEventListener('click', () => selectComponent(comp.id));
    list.appendChild(el);
  });
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

function createEditor() {
  const container = document.getElementById('codemirror-container');

  const updateListener = EditorView.updateListener.of(update => {
    if (update.docChanged && !previewUpdating) {
      updatePreview(update.state.doc.toString());
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

async function saveCurrentComponent() {
  if (!currentComponentId || !editorView) return;
  const comp = {
    id: currentComponentId,
    name: document.getElementById('component-name').value || 'Sans nom',
    category: document.getElementById('component-category').value,
    html: editorView.state.doc.toString()
  };
  await saveComponent(comp);
  await renderComponentList();
  window.showToast('✅ Composant sauvegardé');
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

async function handleExportSelection() {
  if (!currentComponentId) {
    window.showToast('⚠️ Sélectionnez un composant d\'abord');
    return;
  }
  const json = await exportSingleComponentJSON(currentComponentId);
  if (!json) return;
  const comp = await getComponent(currentComponentId);
  const name = (comp?.name || 'composant').replace(/\s+/g, '-').toLowerCase();
  downloadJSON(json, `${name}.json`);
  window.showToast('📤 Composant exporté');
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
  document.getElementById('export-selection-btn').addEventListener('click', handleExportSelection);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', handleImport);
  document.getElementById('trash-btn').addEventListener('click', openTrash);

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

  // Style toolbar on builder preview
  initStyleToolbar('#component-preview', () => {
    syncEditorFromPreview();
  });
}
