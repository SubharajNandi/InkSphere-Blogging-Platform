/* =========================================================
   InkSphere — blog.js
   Renders post-card grids and drives the blog listing page
   (search, tag filter, sort, pagination).
   ========================================================= */

/**
 * Render a single post card. `post` shape expected from API.posts.list():
 * { _id, title, excerpt|content, coverImage, tags, status, author: {name, avatarUrl}, createdAt }
 */
function renderPostCard(post) {
  const id = post._id || post.id;
  const title = escapeHtml(post.title || 'Untitled post');
  const excerpt = escapeHtml(post.excerpt || truncateText(post.content, 110));
  const author = post.author || {};
  const tags = (post.tags || []).slice(0, 2);
  const isDraft = post.status === 'draft';

  return `
    <a href="post.html?id=${encodeURIComponent(id)}" class="post-card">
      <div class="post-card-cover">
        ${post.coverImage
          ? `<img src="${escapeHtml(post.coverImage)}" alt="${title}" loading="lazy">`
          : `<div class="skeleton" style="width:100%;height:100%;border-radius:0;"></div>`}
        <span class="badge ${isDraft ? 'badge-draft' : 'badge-success'} post-card-status">${isDraft ? 'Draft' : 'Published'}</span>
      </div>
      <div class="post-card-body">
        ${tags.length ? `<div class="post-card-tags">${tags.map(t => `<span class="badge badge-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <h3 class="post-card-title">${title}</h3>
        <p class="post-card-excerpt">${excerpt}</p>
        <div class="post-card-meta">
          ${renderAvatarHtml(author.name, author.avatarUrl, 'avatar-sm')}
          <span class="meta-name">${escapeHtml(author.name || 'Unknown')}</span>
          <span class="dot-sep">·</span>
          <span>${formatDate(post.createdAt)}</span>
        </div>
      </div>
    </a>
  `;
}

function renderPostGridSkeletons(container, count = 4) {
  container.innerHTML = Array.from({ length: count })
    .map(() => '<div class="skeleton post-card-skeleton"></div>')
    .join('');
}

/* ---------------- Homepage: featured posts ---------------- */
async function loadHomeFeaturedPosts() {
  const container = document.getElementById('homeFeaturedPosts');
  if (!container) return;

  try {
    const data = await API.posts.list({ limit: 8, sort: '-createdAt', status: 'published' });
    const items = data.posts || data.items || data;
    if (!items || items.length === 0) {
      renderEmptyState(container.parentElement, {
        title: 'No posts yet',
        body: 'Be the first to publish something on InkSphere.',
        actionHtml: '<a href="register.html" class="btn btn-primary">Start writing</a>',
      });
      container.remove();
      return;
    }
    container.innerHTML = items.map(renderPostCard).join('');
  } catch (err) {
    renderEmptyState(container.parentElement, {
      title: 'Couldn\u2019t load posts',
      body: err.message || 'Something went wrong while reaching the server.',
    });
    container.remove();
  }
}

/* ---------------- Blog listing page ---------------- */
const BlogListing = (() => {
  let state = {
    page: 1,
    limit: 9,
    search: getQueryParam('search') || '',
    tag: getQueryParam('tag') || '',
    sort: '-createdAt',
    totalPages: 1,
  };

  async function load() {
    const grid = document.getElementById('blogPostGrid');
    const pagination = document.getElementById('blogPagination');
    if (!grid) return;

    renderPostGridSkeletons(grid, state.limit);
    pagination.innerHTML = '';

    try {
      const params = {
        page: state.page,
        limit: state.limit,
        sort: state.sort,
        status: 'published',
      };
      if (state.search) params.search = state.search;
      if (state.tag) params.tag = state.tag;

      const data = await API.posts.list(params);
      const items = data.posts || data.items || data;
      state.totalPages = data.totalPages || data.pages || 1;

      if (!items || items.length === 0) {
        renderEmptyState(grid, {
          title: 'No posts found',
          body: state.search ? `Nothing matched "${state.search}". Try a different search.` : 'No posts have been published yet.',
        });
        return;
      }

      grid.innerHTML = items.map(renderPostCard).join('');
      renderPagination(pagination);
    } catch (err) {
      renderEmptyState(grid, {
        title: 'Couldn\u2019t load posts',
        body: err.message || 'Something went wrong while reaching the server.',
      });
    }
  }

  function renderPagination(container) {
    if (state.totalPages <= 1) return;
    let html = `<button class="page-btn" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''}>&larr;</button>`;
    for (let p = 1; p <= state.totalPages; p++) {
      html += `<button class="page-btn ${p === state.page ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
    html += `<button class="page-btn" data-page="${state.page + 1}" ${state.page >= state.totalPages ? 'disabled' : ''}>&rarr;</button>`;
    container.innerHTML = html;
    container.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page, 10);
        if (page < 1 || page > state.totalPages) return;
        state.page = page;
        load();
        window.scrollTo({ top: document.getElementById('blogPostGrid').offsetTop - 100, behavior: 'smooth' });
      });
    });
  }

  function setTag(tag) {
    state.tag = tag;
    state.page = 1;
    setQueryParam('tag', tag);
    document.querySelectorAll('.pill[data-tag]').forEach(p => {
      p.classList.toggle('active', p.dataset.tag === tag);
    });
    load();
  }

  function setSearch(value) {
    state.search = value;
    state.page = 1;
    setQueryParam('search', value);
    load();
  }

  function setSort(value) {
    state.sort = value;
    state.page = 1;
    load();
  }

  function init() {
    const searchInput = document.getElementById('blogSearchInput');
    const sortSelect = document.getElementById('blogSortSelect');

    if (searchInput) {
      searchInput.value = state.search;
      searchInput.addEventListener('input', debounce((e) => setSearch(e.target.value.trim()), 400));
    }
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => setSort(e.target.value));
    }
    document.querySelectorAll('.pill[data-tag]').forEach(pill => {
      if (pill.dataset.tag === state.tag) pill.classList.add('active');
      pill.addEventListener('click', () => setTag(pill.dataset.tag));
    });

    load();
  }

  return { init, load };
})();
