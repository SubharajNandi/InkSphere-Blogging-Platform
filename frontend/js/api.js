/* =========================================================
   InkSphere — api.js
   Central API client. Every request to the Express/Mongo
   backend funnels through here, matching the route structure:
     /api/auth/*      -> authRoutes.js    (authController)
     /api/posts/*      -> postRoutes.js    (postController)
     /api/comments/*   -> commentRoutes.js (commentController)
     /api/users/*      -> userRoutes.js    (userController)

   Change BASE_URL to point at your running backend.
   ========================================================= */

const API = (() => {
  // During local dev with a separate backend on :5000, set this to
  // 'http://localhost:5000/api'. If frontend is served by the same
  // Express app (server.js serving static files), '/api' is correct.
  const BASE_URL = window.INKSPHERE_API_BASE_URL || '/api';

  const TOKEN_KEY = 'inksphere_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  /**
   * Core request wrapper.
   * @param {string} path - e.g. '/posts' or '/posts/123'
   * @param {object} opts - { method, body, auth, isFormData }
   */
  async function request(path, opts = {}) {
    const { method = 'GET', body, auth = true, isFormData = false } = opts;

    const headers = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';

    if (auth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    let response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
      });
    } catch (networkErr) {
      throw new ApiError('Could not reach the server. Check your connection and try again.', 0, null);
    }

    let data = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => null);
    } else {
      data = await response.text().catch(() => null);
    }

    if (!response.ok) {
      const message = (data && (data.message || data.error)) || `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status, data);
    }

    return data;
  }

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.data = data;
    }
  }

  /* ---------------- Auth: /api/auth ---------------- */
  const auth = {
    register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),
    // payload: { name, email, password }

    login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),
    // payload: { email, password } -> { token, user }

    logout: () => request('/auth/logout', { method: 'POST' }).catch(() => null),

    me: () => request('/auth/me', { method: 'GET' }),

    forgotPassword: (payload) => request('/auth/forgot-password', { method: 'POST', body: payload, auth: false }),

    resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: payload, auth: false }),
  };

  /* ---------------- Posts: /api/posts ---------------- */
  const posts = {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/posts${qs ? `?${qs}` : ''}`, { auth: false });
      // params: { page, limit, search, tag, author, sort }
    },

    getById: (id) => request(`/posts/${id}`, { auth: false }),

    getBySlug: (slug) => request(`/posts/slug/${slug}`, { auth: false }),

    create: (payload) => request('/posts', { method: 'POST', body: payload }),
    // payload: { title, content, tags, coverImage, status }

    update: (id, payload) => request(`/posts/${id}`, { method: 'PUT', body: payload }),

    delete: (id) => request(`/posts/${id}`, { method: 'DELETE' }),

    listMine: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/posts/me/all${qs ? `?${qs}` : ''}`);
    },

    like: (id) => request(`/posts/${id}/like`, { method: 'POST' }),

    uploadCover: (formData) => request('/posts/upload', { method: 'POST', body: formData, isFormData: true }),
  };

  /* ---------------- Comments: /api/comments ---------------- */
  const comments = {
    listForPost: (postId) => request(`/comments/post/${postId}`, { auth: false }),

    create: (postId, payload) => request(`/comments/post/${postId}`, { method: 'POST', body: payload }),
    // payload: { content, parentCommentId? }

    update: (commentId, payload) => request(`/comments/${commentId}`, { method: 'PUT', body: payload }),

    delete: (commentId) => request(`/comments/${commentId}`, { method: 'DELETE' }),
  };

  /* ---------------- Users: /api/users ---------------- */
  const users = {
    getProfile: (idOrUsername) => request(`/users/${idOrUsername}`, { auth: false }),

    updateProfile: (payload) => request('/users/me', { method: 'PUT', body: payload }),
    // payload: { name, bio, avatarUrl, socialLinks }

    changePassword: (payload) => request('/users/me/password', { method: 'PUT', body: payload }),

    uploadAvatar: (formData) => request('/users/me/avatar', { method: 'POST', body: formData, isFormData: true }),

    deleteAccount: () => request('/users/me', { method: 'DELETE' }),

    follow: (id) => request(`/users/${id}/follow`, { method: 'POST' }),
    unfollow: (id) => request(`/users/${id}/follow`, { method: 'DELETE' }),
  };

  return { request, auth, posts, comments, users, getToken, setToken, ApiError };
})();
