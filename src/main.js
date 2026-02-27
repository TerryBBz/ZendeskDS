import './style.css';
import { initBuilder } from './builder.js';
import { initAssembler } from './assembler.js';
import { loadDefaultComponents } from './defaults.js';
import { isAuthenticated, login, logout } from './auth.js';
import { loadFolders } from './categories.js';

// --- Login flow ---
async function showLogin() {
  const overlay = document.getElementById('login-overlay');
  const app = document.getElementById('app');
  overlay.classList.remove('hidden');
  app.classList.add('hidden');

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const input = document.getElementById('login-password');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const password = input.value;
    if (!password) return;

    try {
      await login(password);
      overlay.classList.add('hidden');
      app.classList.remove('hidden');
      await initApp();
    } catch (err) {
      errorEl.textContent = err.message;
      input.select();
    }
  });

  input.focus();
}

async function initApp() {
  // Load folders from API
  await loadFolders();

  // Load defaults if needed
  await loadDefaultComponents();

  // Init modules
  await initBuilder();
  await initAssembler();

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

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle-btn');
  const savedTheme = localStorage.getItem('ztb-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeBtn.textContent = savedTheme === 'light' ? '☀️' : '🌙';
  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ztb-theme', next);
    themeBtn.textContent = next === 'light' ? '☀️' : '🌙';
  });
}

// Toast helper — type: 'success' (default), 'error', 'warning'
window.showToast = (message, duration = 2500, type = 'success') => {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
};

// Apply saved theme early
const earlyTheme = localStorage.getItem('ztb-theme') || 'dark';
document.documentElement.setAttribute('data-theme', earlyTheme);

// Start
if (isAuthenticated()) {
  document.getElementById('login-overlay').classList.add('hidden');
  await initApp();
} else {
  showLogin();
}
