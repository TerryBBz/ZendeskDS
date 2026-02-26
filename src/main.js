import './style.css';
import { initBuilder } from './builder.js';
import { initAssembler } from './assembler.js';
import { loadDefaultComponents } from './defaults.js';
import { restoreFolderAccess, requestFolder, hasFolderAccess } from './storage.js';

// Tab navigation
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');

    if (tab.dataset.tab === 'assembler') {
      window.dispatchEvent(new Event('assembler-activated'));
    }
  });
});

// Toast helper
window.showToast = (message, duration = 2000) => {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
};

// Folder access banner
function showFolderBanner() {
  if (document.getElementById('folder-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'folder-banner';
  banner.style.cssText = 'background:#0984e3;color:white;padding:10px 20px;text-align:center;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;';
  banner.innerHTML = '📁 <span>Sélectionner un dossier pour sauvegarder vos données en fichiers locaux</span> <button style="background:white;color:#0984e3;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-weight:bold;">Choisir un dossier</button>';
  banner.querySelector('button').addEventListener('click', async () => {
    const ok = await requestFolder();
    if (ok) {
      banner.remove();
      window.showToast('📁 Dossier connecté — les données seront sauvegardées en fichiers');
      // Reload data without re-binding events
      await loadDefaultComponents();
      window.dispatchEvent(new Event('storage-changed'));
    }
  });
  document.body.prepend(banner);
}

// Try to restore previous folder access
const restored = await restoreFolderAccess();

// Load defaults on first visit
await loadDefaultComponents();

// Init modules
await initBuilder();
await initAssembler();

// Show banner if no folder access
if (!restored) {
  showFolderBanner();
}
