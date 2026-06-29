/* =========================================================
   InkSphere — auth.js
   Wraps API.auth + handles persisted session (token + user
   cached in localStorage so nav/guards work without refetching
   on every page load). Also drives login.html / register.html.
   ========================================================= */

const Auth = (() => {
  const USER_KEY = 'inksphere_user';

  function getCurrentUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function setCurrentUser(user) {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }

  async function login({ email, password }) {
    const data = await API.auth.login({ email, password });
    // Expected shape: { token, user: { id, name, email, avatarUrl, bio, role } }
    API.setToken(data.token);
    setCurrentUser(data.user);
    return data.user;
  }

  async function register({ name, email, password }) {
    const data = await API.auth.register({ name, email, password });
    if (data.token) {
      API.setToken(data.token);
      setCurrentUser(data.user);
    }
    return data.user;
  }

  function logout() {
    API.auth.logout();
    API.setToken(null);
    setCurrentUser(null);
  }

  /** Re-sync cached user with the server; call on dashboard/profile load. */
  async function refreshCurrentUser() {
    try {
      const data = await API.auth.me();
      setCurrentUser(data.user || data);
      return getCurrentUser();
    } catch (err) {
      if (err.status === 401) logout();
      return null;
    }
  }

  return { getCurrentUser, setCurrentUser, login, register, logout, refreshCurrentUser };
})();

/* ---------------- Page wiring ---------------- */

function wireLoginForm() {
  const form = document.querySelector('[data-login-form]');
  if (!form) return;

  redirectIfAuthed();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    const errorBox = form.querySelector('[data-form-error]');
    errorBox?.classList.add('hidden');

    const email = form.email.value.trim();
    const password = form.password.value;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Signing in…';

    try {
      await Auth.login({ email, password });
      const next = getQueryParam('next');
      window.location.href = next ? decodeURIComponent(next) : 'dashboard.html';
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = err.message || 'Could not sign in. Check your email and password.';
        errorBox.classList.remove('hidden');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });
}

function wireRegisterForm() {
  const form = document.querySelector('[data-register-form]');
  if (!form) return;

  redirectIfAuthed();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    const errorBox = form.querySelector('[data-form-error]');
    errorBox?.classList.add('hidden');

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if (password !== confirmPassword) {
      errorBox.textContent = 'Passwords do not match.';
      errorBox.classList.remove('hidden');
      return;
    }
    if (password.length < 8) {
      errorBox.textContent = 'Password must be at least 8 characters.';
      errorBox.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Creating account…';

    try {
      await Auth.register({ name, email, password });
      window.location.href = 'dashboard.html';
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = err.message || 'Could not create your account. Try a different email.';
        errorBox.classList.remove('hidden');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wireLoginForm();
  wireRegisterForm();
});
