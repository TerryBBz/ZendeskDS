import './style.css';
import { initBuilder } from './builder.js';
import { initAssembler } from './assembler.js';
import { loadDefaultComponents } from './defaults.js';
import { startFileWatcher, onStorageChange } from './storage.js';

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

// Load defaults on first visit
await loadDefaultComponents();

// Init modules
await initBuilder();
await initAssembler();

// File watcher — détecte les modifications manuelles dans Documents/ZendeskDS/
onStorageChange(() => {
  window.showToast('🔄 Données mises à jour depuis le dossier');
  initBuilder();
  initAssembler();
});
startFileWatcher();
