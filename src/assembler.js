import Sortable from 'sortablejs';
import {
  getComponents, getTemplates, saveTemplate, deleteTemplate
} from './storage.js';
import { categoryBadge, getFolders } from './categories.js';
import { initStyleToolbar } from './style-toolbar.js';

let templateBlocks = []; // { componentId, instanceId, customHtml? }
let sidebarSortables = [];
let dropZoneSortable = null;
let componentsCache = [];
const collapsedSidebarFolders = new Set();
let sidebarFoldersInitialized = false;

function generateInstanceId() {
  return 'inst-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function renderSidebar(filter = '') {
  const container = document.getElementById('available-components');
  const components = await getComponents();
  componentsCache = components;
  const filtered = filter
    ? components.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        (c.category || '').toLowerCase().includes(filter.toLowerCase())
      )
    : components;

  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Aucun composant disponible</p>';
    return;
  }

  // Flat list when searching
  if (filter) {
    filtered.forEach(comp => container.appendChild(createSidebarComponent(comp)));
    initSidebarSortable();
    return;
  }

  // Group by folderId
  const folders = getFolders();
  const groups = {};
  const noFolder = [];
  for (const comp of filtered) {
    if (comp.folderId && folders[comp.folderId]) {
      if (!groups[comp.folderId]) groups[comp.folderId] = [];
      groups[comp.folderId].push(comp);
    } else {
      noFolder.push(comp);
    }
  }

  // Collapse all folders by default on first render
  if (!sidebarFoldersInitialized) {
    for (const key of Object.keys(folders)) {
      collapsedSidebarFolders.add(key);
    }
    if (noFolder.length > 0) collapsedSidebarFolders.add('__none__');
    sidebarFoldersInitialized = true;
  }

  // Render each folder
  for (const [key, folder] of Object.entries(folders)) {
    const comps = groups[key] || [];
    if (comps.length === 0) continue;
    container.appendChild(createSidebarFolder(key, folder, comps));
  }

  // Sans dossier
  if (noFolder.length > 0) {
    container.appendChild(createSidebarFolder('__none__', { label: 'Sans dossier', icon: '📂', color: '#b2bec3' }, noFolder));
  }

  initSidebarSortable();
}

function createSidebarFolder(key, folder, comps) {
  const isCollapsed = collapsedSidebarFolders.has(key);
  const section = document.createElement('div');
  section.className = 'sidebar-folder-section';

  const header = document.createElement('div');
  header.className = 'sidebar-folder-header';
  header.innerHTML = `
    <span class="folder-toggle">${isCollapsed ? '▶' : '▼'}</span>
    <span class="folder-icon" style="color:${folder.color}">${folder.icon}</span>
    <span class="folder-label">${escapeHtml(folder.label)}</span>
    <span class="folder-count">${comps.length}</span>
  `;
  header.addEventListener('click', (e) => {
    e.stopPropagation();
    const collapsed = collapsedSidebarFolders.has(key);
    if (collapsed) {
      collapsedSidebarFolders.delete(key);
      const list = document.createElement('div');
      list.className = 'sidebar-folder-components';
      comps.forEach(comp => list.appendChild(createSidebarComponent(comp)));
      section.appendChild(list);
      sidebarSortables.push(new Sortable(list, {
        group: { name: 'shared', pull: 'clone', put: false },
        sort: false, animation: 150, ghostClass: 'sortable-ghost',
        onEnd: () => {}
      }));
    } else {
      collapsedSidebarFolders.add(key);
      const list = section.querySelector('.sidebar-folder-components');
      if (list) list.remove();
    }
    header.querySelector('.folder-toggle').textContent = collapsedSidebarFolders.has(key) ? '▶' : '▼';
  });
  section.appendChild(header);

  if (!isCollapsed) {
    const list = document.createElement('div');
    list.className = 'sidebar-folder-components';
    comps.forEach(comp => list.appendChild(createSidebarComponent(comp)));
    section.appendChild(list);
  }

  return section;
}

function createSidebarComponent(comp) {
  const el = document.createElement('div');
  el.className = 'sidebar-component';
  el.dataset.componentId = comp.id;
  el.innerHTML = `
    <div class="sidebar-component-header">
      <div>
        <div class="name">${escapeHtml(comp.name)}</div>
        <div class="category">${categoryBadge(comp.category)}</div>
      </div>
      <button class="add-component-btn" title="Ajouter au template">+</button>
    </div>
    <div class="mini-preview">${comp.html}</div>
  `;
  el.querySelector('.add-component-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    addComponentToTemplate(comp.id);
  });
  return el;
}

function initSidebarSortable() {
  sidebarSortables.forEach(s => s.destroy());
  sidebarSortables = [];

  // Init Sortable on each folder's component list
  const lists = document.querySelectorAll('.sidebar-folder-components');
  lists.forEach(list => {
    sidebarSortables.push(new Sortable(list, {
      group: { name: 'shared', pull: 'clone', put: false },
      sort: false,
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: () => {}
    }));
  });

  // Also for flat search results (components directly in container)
  const container = document.getElementById('available-components');
  const hasDirectComponents = container.querySelector(':scope > .sidebar-component');
  if (hasDirectComponents) {
    sidebarSortables.push(new Sortable(container, {
      group: { name: 'shared', pull: 'clone', put: false },
      sort: false,
      animation: 150,
      ghostClass: 'sortable-ghost',
      draggable: '.sidebar-component',
      onEnd: () => {}
    }));
  }
}

function addComponentToTemplate(componentId) {
  const instanceId = generateInstanceId();
  templateBlocks.push({ componentId, instanceId, customHtml: null });
  renderDropZone();
  updateTemplatePreview();
  // Flash animation on the new block
  requestAnimationFrame(() => {
    const zone = document.getElementById('drop-zone');
    const newEl = zone.querySelector(`[data-instance-id="${instanceId}"]`);
    if (newEl) {
      newEl.classList.add('drop-flash');
      newEl.addEventListener('animationend', () => newEl.classList.remove('drop-flash'), { once: true });
      newEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
  window.showToast('✅ Composant ajouté');
}

function renderDropZone() {
  const zone = document.getElementById('drop-zone');
  const placeholder = zone.querySelector('.drop-placeholder');

  // Remove all block elements but keep placeholder
  zone.querySelectorAll('.drop-block').forEach(el => el.remove());

  if (templateBlocks.length === 0) {
    if (!placeholder) {
      zone.innerHTML = '<p class="drop-placeholder">Glissez des composants depuis la sidebar</p>';
    } else {
      placeholder.style.display = '';
    }
  } else {
    if (placeholder) placeholder.style.display = 'none';

  templateBlocks.forEach(block => {
      const comp = componentsCache.find(c => c.id === block.componentId);
      const blockHtml = block.customHtml || (comp ? comp.html : '<p style="color:red;">Composant introuvable</p>');
      const isCustomized = !!block.customHtml;
      const el = document.createElement('div');
      el.className = 'drop-block';
      el.dataset.instanceId = block.instanceId;
      el.innerHTML = `
        <div class="block-header">
          <span class="block-name">${comp ? escapeHtml(comp.name) : '⚠️ Composant supprimé'}${isCustomized ? ' <span class="edited-badge">modifié</span>' : ''}</span>
          <div class="block-actions">
            ${isCustomized ? '<button class="reset-btn" title="Réinitialiser">↩️</button>' : ''}
            <button class="duplicate-btn" title="Dupliquer">📋</button>
            <button class="remove-btn" title="Supprimer">✕</button>
          </div>
        </div>
        <div class="block-preview" contenteditable="true">${blockHtml}</div>
      `;

      // Save edits on blur / input
      const preview = el.querySelector('.block-preview');
      preview.addEventListener('input', () => {
        block.customHtml = preview.innerHTML;
        updateTemplatePreview();
      });

      el.querySelector('.remove-btn').addEventListener('click', () => {
        templateBlocks = templateBlocks.filter(b => b.instanceId !== block.instanceId);
        renderDropZone();
        updateTemplatePreview();
      });

      el.querySelector('.duplicate-btn').addEventListener('click', () => {
        const idx = templateBlocks.findIndex(b => b.instanceId === block.instanceId);
        const newBlock = { componentId: block.componentId, instanceId: generateInstanceId(), customHtml: block.customHtml || null };
        templateBlocks.splice(idx + 1, 0, newBlock);
        renderDropZone();
        updateTemplatePreview();
      });

      const resetBtn = el.querySelector('.reset-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          block.customHtml = null;
          renderDropZone();
          updateTemplatePreview();
        });
      }

      zone.appendChild(el);
    });
  }

  initDropZoneSortable();
}

function initDropZoneSortable() {
  const zone = document.getElementById('drop-zone');
  if (dropZoneSortable) dropZoneSortable.destroy();

  dropZoneSortable = new Sortable(zone, {
    group: { name: 'shared', pull: false, put: true },
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    draggable: '.drop-block',
    handle: '.block-header',
    onAdd: (evt) => {
      // A component was dragged from sidebar
      const sidebarEl = evt.item;
      const componentId = sidebarEl.dataset.componentId;

      if (!componentId) {
        sidebarEl.remove();
        return;
      }

      const instanceId = generateInstanceId();
      const newBlock = { componentId, instanceId, customHtml: null };

      const newIndex = evt.newIndex;
      templateBlocks.splice(newIndex, 0, newBlock);

      sidebarEl.remove();
      renderDropZone();
      updateTemplatePreview();

      // Flash animation
      requestAnimationFrame(() => {
        const newEl = zone.querySelector(`[data-instance-id="${instanceId}"]`);
        if (newEl) {
          newEl.classList.add('drop-flash');
          newEl.addEventListener('animationend', () => newEl.classList.remove('drop-flash'), { once: true });
        }
      });
    },
    onSort: (evt) => {
      if (evt.from === evt.to) {
        // Reorder within drop zone
        const blockEls = Array.from(zone.querySelectorAll('.drop-block'));
        const newOrder = blockEls.map(el => el.dataset.instanceId);
        templateBlocks.sort((a, b) => newOrder.indexOf(a.instanceId) - newOrder.indexOf(b.instanceId));
        updateTemplatePreview();
      }
    }
  });
}

function updateTemplatePreview() {
  const preview = document.getElementById('template-preview');
  const htmlParts = templateBlocks.map(block => {
    if (block.customHtml) return block.customHtml;
    const comp = componentsCache.find(c => c.id === block.componentId);
    return comp ? comp.html : '<!-- Composant introuvable -->';
  });
  preview.innerHTML = htmlParts.join('\n');
}

function getTemplateHTML() {
  return templateBlocks.map(block => {
    if (block.customHtml) return block.customHtml;
    const comp = componentsCache.find(c => c.id === block.componentId);
    return comp ? comp.html : '';
  }).filter(Boolean).join('\n\n');
}

function copyHTML() {
  const html = getTemplateHTML();
  if (!html) {
    window.showToast('⚠️ Le template est vide');
    return;
  }
  navigator.clipboard.writeText(html).then(() => {
    window.showToast('📋 HTML copié dans le presse-papier !');
  }).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = html;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    window.showToast('📋 HTML copié !');
  });
}

async function handleSaveTemplate() {
  const name = document.getElementById('template-name').value || 'Sans nom';
  if (templateBlocks.length === 0) {
    window.showToast('⚠️ Le template est vide');
    return;
  }
  const template = {
    id: 'tpl-' + Date.now(),
    name,
    blocks: templateBlocks.map(b => ({ componentId: b.componentId, customHtml: b.customHtml || null }))
  };
  await saveTemplate(template);
  window.showToast('💾 Template sauvegardé');
}

async function handleLoadTemplate() {
  const modal = document.getElementById('load-modal');
  const list = document.getElementById('saved-templates-list');
  const templates = await getTemplates();

  list.innerHTML = '';
  if (templates.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);">Aucun template sauvegardé</p>';
  } else {
    templates.forEach(tpl => {
      const el = document.createElement('div');
      el.className = 'template-item';
      el.innerHTML = `
        <div>
          <div class="tpl-name">${escapeHtml(tpl.name)}</div>
          <div class="tpl-date">${tpl.blocks?.length || 0} composant(s)</div>
        </div>
        <button class="tpl-delete" title="Supprimer">🗑️</button>
      `;
      el.addEventListener('click', async (e) => {
        if (e.target.classList.contains('tpl-delete')) {
          e.stopPropagation();
          await deleteTemplate(tpl.id);
          handleLoadTemplate(); // refresh
          return;
        }
        loadTemplate(tpl);
        modal.classList.add('hidden');
      });
      list.appendChild(el);
    });
  }

  modal.classList.remove('hidden');
}

function loadTemplate(tpl) {
  document.getElementById('template-name').value = tpl.name;
  templateBlocks = (tpl.blocks || []).map(b => ({
    componentId: b.componentId,
    instanceId: generateInstanceId(),
    customHtml: b.customHtml || null
  }));
  renderDropZone();
  updateTemplatePreview();
  window.showToast('📂 Template chargé');
}

function clearTemplate() {
  if (templateBlocks.length > 0 && !confirm('Vider le template ?')) return;
  templateBlocks = [];
  renderDropZone();
  updateTemplatePreview();
}

export async function initAssembler() {
  await renderSidebar();
  renderDropZone();

  document.getElementById('search-components').addEventListener('input', (e) => {
    renderSidebar(e.target.value);
  });

  document.getElementById('copy-html-btn').addEventListener('click', copyHTML);
  document.getElementById('save-template-btn').addEventListener('click', handleSaveTemplate);
  document.getElementById('load-template-btn').addEventListener('click', handleLoadTemplate);
  document.getElementById('clear-template-btn').addEventListener('click', clearTemplate);

  document.querySelector('.modal-close').addEventListener('click', () => {
    document.getElementById('load-modal').classList.add('hidden');
  });

  // Refresh sidebar when switching to assembler tab
  window.addEventListener('assembler-activated', () => {
    renderSidebar(document.getElementById('search-components').value);
  });

  // Style toolbar on assembler block previews (delegated)
  const dropZone = document.getElementById('drop-zone');
  dropZone.addEventListener('click', (e) => {
    const blockPreview = e.target.closest('.block-preview');
    if (!blockPreview || e.target === blockPreview) return;
    const blockEl = blockPreview.closest('.drop-block');
    if (!blockEl) return;
    const instanceId = blockEl.dataset.instanceId;
    const block = templateBlocks.find(b => b.instanceId === instanceId);
    if (!block) return;

    // The initStyleToolbar won't work for dynamic elements, so we call the toolbar directly
    // We handle it here via the event
  });

  initStyleToolbar('#drop-zone', () => {
    // After a style change, sync the customHtml for the affected block
    const dropBlocks = dropZone.querySelectorAll('.drop-block');
    dropBlocks.forEach(blockEl => {
      const instanceId = blockEl.dataset.instanceId;
      const block = templateBlocks.find(b => b.instanceId === instanceId);
      if (!block) return;
      const preview = blockEl.querySelector('.block-preview');
      if (preview) {
        block.customHtml = preview.innerHTML;
      }
    });
    updateTemplatePreview();
  });

  // Refresh sidebar when storage source changes
  window.addEventListener('storage-changed', () => renderSidebar());
}
