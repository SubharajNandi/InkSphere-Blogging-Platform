/* =========================================================
   InkSphere — utils.js
   Shared helper functions: toasts, date formatting, DOM helpers,
   nav/auth-state rendering, debounce, etc.
   ========================================================= */

/* ---------- Toasts ---------- */
function ensureToastStack() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}

function showToast(message, type = 'success', duration = 3200) {
  const stack = ensureToastStack();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/* ---------- Date formatting ---------- */
function formatDate(dateInput, options = {}) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const defaults = { day: 'numeric', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('en-US', { ...defaults, ...options });
}

function formatRelativeTime(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(date);
}

/* ---------- Text helpers ---------- */
function truncateText(text, maxLength = 160) {
  if (!text) return '';
  const stripped = stripHtml(text);
  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength).trim() + '…';
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function estimateReadTime(content) {
  const text = stripHtml(content || '');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* Deterministic-ish color pick for avatar fallback, purely cosmetic */
function avatarColor(seedStr) {
  const palette = ['#ea2804', '#202020', '#2b9a66', '#c01f00', '#575757'];
  if (!seedStr) return palette[0];
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

/* Render an avatar element (img if avatarUrl provided, else initials) */
function renderAvatarHtml(name, avatarUrl, sizeClass = 'avatar-md') {
  if (avatarUrl) {
    return `<img class="avatar ${sizeClass}" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name || 'User')}">`;
  }
  const initials = getInitials(name);
  const color = avatarColor(name || 'user');
  return `<span class="avatar avatar-fallback ${sizeClass}" style="background:${color}">${initials}</span>`;
}

/* ---------- Query params ---------- */
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function setQueryParam(name, value) {
  const url = new URL(window.location.href);
  if (value === null || value === undefined || value === '') {
    url.searchParams.delete(name);
  } else {
    url.searchParams.set(name, value);
  }
  window.history.replaceState({}, '', url);
}

/* ---------- Debounce ---------- */
function debounce(fn, wait = 300) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

/* ---------- Loading / skeleton helpers ---------- */
function renderLoadingRow(container, message = 'Loading…') {
  container.innerHTML = `<div class="loading-row"><span class="spinner"></span><span>${escapeHtml(message)}</span></div>`;
}

function renderEmptyState(container, { title, body, actionHtml = '' }) {
  container.innerHTML = `
    <div class="empty-state">
      <h3 class="heading-sm">${escapeHtml(title)}</h3>
      <p class="body-md">${escapeHtml(body)}</p>
      ${actionHtml}
    </div>`;
}

/* ---------- Nav: auth-aware rendering ---------- */
function initNav() {
  const user = Auth.getCurrentUser();
  const authSlot = document.querySelector('[data-nav-auth-slot]');
  if (!authSlot) return;

  if (user) {
    authSlot.innerHTML = `
      <a href="create-post.html" class="btn btn-primary btn-sm">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        New post
      </a>
      <div class="nav-user" data-user-menu-toggle>
        ${renderAvatarHtml(user.name, user.avatarUrl, 'avatar-sm')}
        <div class="nav-dropdown" data-user-dropdown>
          <a href="dashboard.html">Dashboard</a>
          <a href="profile.html">Profile</a>
          <hr>
          <button type="button" data-logout-btn class="danger">Sign out</button>
        </div>
      </div>
    `;
    const toggle = authSlot.querySelector('[data-user-menu-toggle]');
    const dropdown = authSlot.querySelector('[data-user-dropdown]');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => dropdown.classList.remove('open'));
    authSlot.querySelector('[data-logout-btn]').addEventListener('click', () => {
      Auth.logout();
      window.location.href = 'index.html';
    });
  } else {
    authSlot.innerHTML = `
      <a href="login.html" class="btn btn-ghost btn-sm">Sign in</a>
      <a href="register.html" class="btn btn-primary btn-sm">Get started</a>
    `;
  }

  /* Mobile drawer wiring */
  const burger = document.querySelector('[data-nav-burger]');
  const drawer = document.querySelector('[data-mobile-drawer]');
  const drawerClose = document.querySelector('[data-mobile-drawer-close]');
  if (burger && drawer) {
    burger.addEventListener('click', () => drawer.classList.add('open'));
    drawer.addEventListener('click', (e) => { if (e.target === drawer) drawer.classList.remove('open'); });
  }
  if (drawerClose && drawer) {
    drawerClose.addEventListener('click', () => drawer.classList.remove('open'));
  }

  /* Mark active nav link */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) link.classList.add('active');
  });
}

/* ---------- Guard helpers ---------- */
function requireAuth(redirectTo = 'login.html') {
  if (!Auth.getCurrentUser()) {
    const next = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
    window.location.href = `${redirectTo}?next=${next}`;
    return false;
  }
  return true;
}

function redirectIfAuthed(redirectTo = 'dashboard.html') {
  if (Auth.getCurrentUser()) {
    window.location.href = redirectTo;
    return true;
  }
  return false;
}

document.addEventListener('DOMContentLoaded', initNav);
