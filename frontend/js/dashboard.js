/* =========================================================
   InkSphere — dashboard.js
   Drives dashboard.html: loads "my posts", computes simple
   stats, renders the management table with edit/delete.
   ========================================================= */

const Dashboard = (() => {
  let myPosts = [];

  async function load() {
    if (!requireAuth()) return;

    const user = await Auth.refreshCurrentUser() || Auth.getCurrentUser();
    renderProfileMini(user);

    const tableBody = document.getElementById('dashPostTableBody');
    renderLoadingRow(tableBody.closest('table').parentElement, 'Loading your posts…');

    try {
      const data = await API.posts.listMine({ sort: '-createdAt' });
      myPosts = data.posts || data.items || data;
      renderStats(myPosts);
      renderTable(myPosts);
    } catch (err) {
      renderEmptyState(document.getElementById('dashTableWrap'), {
        title: 'Couldn\u2019t load your posts',
        body: err.message || 'Something went wrong while reaching the server.',
      });
    }
  }

  function renderProfileMini(user) {
    const el = document.getElementById('dashProfileMini');
    if (!el || !user) return;
    el.innerHTML = `
      ${renderAvatarHtml(user.name, user.avatarUrl, 'avatar-md')}
      <div>
        <div class="name">${escapeHtml(user.name)}</div>
        <div class="role">${escapeHtml(user.email || '')}</div>
      </div>
    `;
  }

  function renderStats(posts) {
    const published = posts.filter(p => p.status === 'published').length;
    const drafts = posts.filter(p => p.status === 'draft').length;
    const totalLikes = posts.reduce((sum, p) => sum + ((p.likes && p.likes.length) || p.likesCount || 0), 0);

    document.getElementById('statPublished').textContent = published;
    document.getElementById('statDrafts').textContent = drafts;
    document.getElementById('statLikes').textContent = totalLikes;
  }

  function renderTable(posts) {
    const wrap = document.getElementById('dashTableWrap');
    if (!posts.length) {
      renderEmptyState(wrap, {
        title: 'You haven\u2019t written anything yet',
        body: 'Your published and draft posts will show up here.',
        actionHtml: '<a href="create-post.html" class="btn btn-primary">Write your first post</a>',
      });
      return;
    }

    wrap.innerHTML = `
      <table class="post-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Comments</th>
            <th>Likes</th>
            <th>Published</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="dashPostTableBody">
          ${posts.map(renderRow).join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('[data-delete-post]').forEach(btn => {
      btn.addEventListener('click', () => handleDelete(btn.dataset.deletePost));
    });
  }

  function renderRow(post) {
    const id = post._id || post.id;
    const isDraft = post.status === 'draft';
    const likes = (post.likes && post.likes.length) || post.likesCount || 0;
    const comments = post.commentsCount ?? '—';

    return `
      <tr data-row-id="${id}">
        <td>
          <a href="post.html?id=${id}" class="row-title">
            ${post.coverImage
              ? `<img class="row-thumb" src="${escapeHtml(post.coverImage)}" alt="">`
              : `<span class="row-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--color-ash);font-size:11px;">No img</span>`}
            ${escapeHtml(post.title)}
          </a>
        </td>
        <td><span class="badge ${isDraft ? 'badge-draft' : 'badge-success'}">${isDraft ? 'Draft' : 'Published'}</span></td>
        <td>${comments}</td>
        <td>${likes}</td>
        <td>${formatDate(post.createdAt)}</td>
        <td>
          <div class="row-actions">
            <a href="edit-post.html?id=${id}" class="btn-icon" aria-label="Edit post">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </a>
            <button type="button" class="btn-icon" aria-label="Delete post" data-delete-post="${id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  async function handleDelete(id) {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await API.posts.delete(id);
      myPosts = myPosts.filter(p => (p._id || p.id) !== id);
      renderStats(myPosts);
      renderTable(myPosts);
      showToast('Post deleted.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not delete post.', 'error');
    }
  }

  return { load };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dashTableWrap')) Dashboard.load();
});
