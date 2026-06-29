/* =========================================================
   InkSphere — post.js
   Drives post.html: loads the post by id/slug, renders body
   + comments, wires likes, comment create/edit/delete, and
   owner-only edit/delete controls on the post itself.
   ========================================================= */

const PostPage = (() => {
  let currentPost = null;
  let currentUser = null;

  function getPostId() {
    return getQueryParam('id') || getQueryParam('slug');
  }

  async function load() {
    const id = getPostId();
    const root = document.getElementById('postRoot');
    if (!id) {
      renderEmptyState(root, { title: 'Post not found', body: 'No post id was provided in the URL.' });
      return;
    }

    currentUser = Auth.getCurrentUser();

    try {
      const data = await (getQueryParam('id') ? API.posts.getById(id) : API.posts.getBySlug(id));
      currentPost = data.post || data;
      renderPost(currentPost);
      loadComments(currentPost._id || currentPost.id);
    } catch (err) {
      renderEmptyState(root, {
        title: 'Couldn\u2019t load this post',
        body: err.message || 'It may have been removed, or the link is incorrect.',
        actionHtml: '<a href="blog.html" class="btn btn-outline">Back to all posts</a>',
      });
    }
  }

  function renderPost(post) {
    document.title = `${post.title} — InkSphere`;

    const tagsRow = document.getElementById('postTagsRow');
    tagsRow.innerHTML = (post.tags || []).map(t => `<span class="badge badge-tag">${escapeHtml(t)}</span>`).join('');

    document.getElementById('postTitle').textContent = post.title;

    const author = post.author || {};
    document.getElementById('postAuthorAvatar').innerHTML = renderAvatarHtml(author.name, author.avatarUrl, 'avatar-md');
    document.getElementById('postAuthorName').textContent = author.name || 'Unknown author';
    document.getElementById('postAuthorMeta').textContent = `${formatDate(post.createdAt)} · ${estimateReadTime(post.content)}`;

    const coverWrap = document.getElementById('postCoverWrap');
    if (post.coverImage) {
      coverWrap.innerHTML = `<img src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.title)}">`;
    } else {
      coverWrap.classList.add('hidden');
    }

    document.getElementById('postBody').innerHTML = post.content || '';

    // Like button
    const likeBtn = document.getElementById('postLikeBtn');
    const likedByMe = currentUser && (post.likes || []).includes(currentUser.id);
    likeBtn.classList.toggle('liked', !!likedByMe);
    document.getElementById('likeCount').textContent = (post.likes || []).length;
    likeBtn.addEventListener('click', handleLike);

    // Owner actions
    const ownerActions = document.getElementById('postOwnerActions');
    const isOwner = currentUser && (author.id === currentUser.id || author._id === currentUser.id);
    if (isOwner) {
      ownerActions.classList.remove('hidden');
      ownerActions.innerHTML = `
        <a href="edit-post.html?id=${post._id || post.id}" class="btn btn-outline btn-sm">Edit</a>
        <button type="button" class="btn btn-danger btn-sm" id="postDeleteBtn">Delete</button>
      `;
      document.getElementById('postDeleteBtn').addEventListener('click', handleDelete);
    }
  }

  async function handleLike() {
    if (!currentUser) {
      window.location.href = `login.html?next=${encodeURIComponent('post.html?id=' + getPostId())}`;
      return;
    }
    const likeBtn = document.getElementById('postLikeBtn');
    likeBtn.disabled = true;
    try {
      const data = await API.posts.like(currentPost._id || currentPost.id);
      const liked = data.liked ?? !likeBtn.classList.contains('liked');
      likeBtn.classList.toggle('liked', liked);
      document.getElementById('likeCount').textContent = data.likesCount ?? (parseInt(document.getElementById('likeCount').textContent, 10) + (liked ? 1 : -1));
    } catch (err) {
      showToast(err.message || 'Could not update like.', 'error');
    } finally {
      likeBtn.disabled = false;
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await API.posts.delete(currentPost._id || currentPost.id);
      showToast('Post deleted.', 'success');
      window.location.href = 'dashboard.html';
    } catch (err) {
      showToast(err.message || 'Could not delete post.', 'error');
    }
  }

  /* ---------------- Comments ---------------- */
  async function loadComments(postId) {
    const list = document.getElementById('commentList');
    renderLoadingRow(list, 'Loading comments…');

    try {
      const data = await API.comments.listForPost(postId);
      const items = data.comments || data;
      document.getElementById('commentCount').textContent = items.length;

      if (!items.length) {
        renderEmptyState(list, { title: 'No comments yet', body: 'Be the first to share your thoughts.' });
        return;
      }
      list.innerHTML = items.map(renderComment).join('');
      wireCommentActions(list, postId);
    } catch (err) {
      renderEmptyState(list, { title: 'Couldn\u2019t load comments', body: err.message || 'Something went wrong.' });
    }
  }

  function renderComment(comment) {
    const author = comment.author || {};
    const isMine = currentUser && (author.id === currentUser.id || author._id === currentUser.id);
    const id = comment._id || comment.id;
    return `
      <div class="comment-item" data-comment-id="${id}">
        ${renderAvatarHtml(author.name, author.avatarUrl, 'avatar-md')}
        <div class="comment-body-wrap">
          <div class="comment-meta-row">
            <span class="comment-author">${escapeHtml(author.name || 'Unknown')}</span>
            <span class="comment-time">${formatRelativeTime(comment.createdAt)}</span>
          </div>
          <p class="comment-text" data-comment-text>${escapeHtml(comment.content)}</p>
          ${isMine ? `
            <div class="comment-actions">
              <button type="button" data-edit-comment>Edit</button>
              <button type="button" class="danger" data-delete-comment>Delete</button>
            </div>
            <div class="comment-edit-form hidden" data-edit-form>
              <textarea class="input textarea">${escapeHtml(comment.content)}</textarea>
              <div class="comment-form-actions">
                <button type="button" class="btn btn-ghost btn-sm" data-cancel-edit>Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" data-save-edit>Save</button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function wireCommentActions(list, postId) {
    list.querySelectorAll('[data-edit-comment]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.comment-item');
        item.querySelector('[data-comment-text]').classList.add('hidden');
        item.querySelector('.comment-actions').classList.add('hidden');
        item.querySelector('[data-edit-form]').classList.remove('hidden');
      });
    });
    list.querySelectorAll('[data-cancel-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.comment-item');
        item.querySelector('[data-comment-text]').classList.remove('hidden');
        item.querySelector('.comment-actions').classList.remove('hidden');
        item.querySelector('[data-edit-form]').classList.add('hidden');
      });
    });
    list.querySelectorAll('[data-save-edit]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const item = btn.closest('.comment-item');
        const commentId = item.dataset.commentId;
        const textarea = item.querySelector('[data-edit-form] textarea');
        try {
          await API.comments.update(commentId, { content: textarea.value.trim() });
          showToast('Comment updated.', 'success');
          loadComments(postId);
        } catch (err) {
          showToast(err.message || 'Could not update comment.', 'error');
        }
      });
    });
    list.querySelectorAll('[data-delete-comment]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this comment?')) return;
        const item = btn.closest('.comment-item');
        try {
          await API.comments.delete(item.dataset.commentId);
          loadComments(postId);
        } catch (err) {
          showToast(err.message || 'Could not delete comment.', 'error');
        }
      });
    });
  }

  function wireCommentForm() {
    const form = document.getElementById('commentForm');
    if (!form) return;

    if (!Auth.getCurrentUser()) {
      form.classList.add('hidden');
      document.getElementById('commentLoginPrompt').classList.remove('hidden');
      return;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const textarea = form.querySelector('textarea');
      const content = textarea.value.trim();
      if (!content) return;

      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;

      try {
        await API.comments.create(currentPost._id || currentPost.id, { content });
        textarea.value = '';
        loadComments(currentPost._id || currentPost.id);
        showToast('Comment posted.', 'success');
      } catch (err) {
        showToast(err.message || 'Could not post comment.', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  function init() {
    load().then(() => wireCommentForm());
  }

  return { init };
})();
/* =========================================================
   InkSphere — PostEditor — shared by create-post.html and
   edit-post.html via data-editor-mode="create"|"edit".
   Uses a contenteditable area with execCommand for simple
   formatting (bold/italic/list/link), tag chips, and a cover
   image preview prior to upload.
   ========================================================= */

const PostEditor = (() => {
  let mode = 'create'; // or 'edit'
  let postId = null;
  let tags = [];
  let coverFile = null;
  let coverPreviewUrl = null;
  let existingCoverUrl = null;

  function init(editorMode) {
    if (!requireAuth()) return;
    mode = editorMode;

    wireFormatBar();
    wireTagInput();
    wireCoverDrop();
    wireFormSubmit();

    if (mode === 'edit') {
      postId = getQueryParam('id');
      if (!postId) {
        showToast('No post id provided.', 'error');
        window.location.href = 'dashboard.html';
        return;
      }
      loadExistingPost(postId);
    }
  }

  async function loadExistingPost(id) {
    const contentArea = document.getElementById('editorContentArea');
    contentArea.setAttribute('data-placeholder', 'Loading post…');
    try {
      const data = await API.posts.getById(id);
      const post = data.post || data;

      document.getElementById('editorTitleInput').value = post.title || '';
      contentArea.innerHTML = post.content || '';
      contentArea.setAttribute('data-placeholder', 'Start writing…');

      tags = post.tags || [];
      renderTags();

      if (post.coverImage) {
        existingCoverUrl = post.coverImage;
        showCoverPreview(post.coverImage);
      }

      document.getElementById('editorStatusSelect').value = post.status || 'draft';
      document.getElementById('editorPageTitle').textContent = 'Edit post';
      document.getElementById('editorPublishBtn').textContent = 'Save changes';
    } catch (err) {
      showToast(err.message || 'Could not load this post.', 'error');
      window.location.href = 'dashboard.html';
    }
  }

  /* ---------------- Formatting toolbar ---------------- */
  function wireFormatBar() {
    document.querySelectorAll('[data-format]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.format;
        document.getElementById('editorContentArea').focus();
        if (cmd === 'createLink') {
          const url = prompt('Link URL:', 'https://');
          if (url) document.execCommand(cmd, false, url);
        } else {
          document.execCommand(cmd, false, null);
        }
      });
    });
  }

  /* ---------------- Tags ---------------- */
  function wireTagInput() {
    const input = document.getElementById('tagInput');
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const value = input.value.trim().replace(/,$/, '');
        if (value && !tags.includes(value) && tags.length < 5) {
          tags.push(value);
          renderTags();
        }
        input.value = '';
      } else if (e.key === 'Backspace' && !input.value && tags.length) {
        tags.pop();
        renderTags();
      }
    });
  }

  function renderTags() {
    const wrap = document.getElementById('tagInputWrap');
    const input = document.getElementById('tagInput');
    wrap.querySelectorAll('.tag-chip').forEach(chip => chip.remove());
    tags.forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${escapeHtml(tag)} <button type="button" aria-label="Remove tag">&times;</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        tags.splice(i, 1);
        renderTags();
      });
      wrap.insertBefore(chip, input);
    });
  }

  /* ---------------- Cover image ---------------- */
  function wireCoverDrop() {
    const dropZone = document.getElementById('editorCoverDrop');
    const fileInput = document.getElementById('coverFileInput');
    const removeBtn = document.getElementById('coverRemoveBtn');
    if (!dropZone) return;

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      coverFile = file;
      existingCoverUrl = null;
      const reader = new FileReader();
      reader.onload = (e) => showCoverPreview(e.target.result);
      reader.readAsDataURL(file);
    });

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      coverFile = null;
      existingCoverUrl = null;
      fileInput.value = '';
      dropZone.classList.remove('has-image');
      dropZone.querySelector('.editor-cover-drop-label').classList.remove('hidden');
      const img = dropZone.querySelector('img');
      if (img) img.remove();
    });
  }

  function showCoverPreview(url) {
    const dropZone = document.getElementById('editorCoverDrop');
    dropZone.classList.add('has-image');
    dropZone.querySelector('.editor-cover-drop-label').classList.add('hidden');
    let img = dropZone.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      dropZone.insertBefore(img, dropZone.firstChild);
    }
    img.src = url;
  }

  /* ---------------- Submit ---------------- */
  function wireFormSubmit() {
    const form = document.getElementById('postEditorForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('editorTitleInput').value.trim();
      const content = document.getElementById('editorContentArea').innerHTML.trim();
      const status = document.getElementById('editorStatusSelect').value;
      const errorBox = document.getElementById('editorFormError');
      errorBox.classList.add('hidden');

      if (!title) {
        errorBox.textContent = 'Give your post a title before publishing.';
        errorBox.classList.remove('hidden');
        return;
      }
      if (!content || content === '<br>') {
        errorBox.textContent = 'Your post needs some content before it can be saved.';
        errorBox.classList.remove('hidden');
        return;
      }

      const publishBtn = document.getElementById('editorPublishBtn');
      publishBtn.disabled = true;
      publishBtn.innerHTML = '<span class="spinner"></span> Saving…';

      try {
        let coverImage = existingCoverUrl;
        if (coverFile) {
          const formData = new FormData();
          formData.append('cover', coverFile);
          const uploadRes = await API.posts.uploadCover(formData);
          coverImage = uploadRes.url || uploadRes.coverImage;
        }

        const payload = { title, content, tags, status, coverImage };

        if (mode === 'edit') {
          await API.posts.update(postId, payload);
          showToast('Post updated.', 'success');
          window.location.href = `post.html?id=${postId}`;
        } else {
          const data = await API.posts.create(payload);
          const newId = (data.post && (data.post._id || data.post.id)) || data._id || data.id;
          showToast('Post published.', 'success');
          window.location.href = `post.html?id=${newId}`;
        }
      } catch (err) {
        errorBox.textContent = err.message || 'Could not save your post. Try again.';
        errorBox.classList.remove('hidden');
        publishBtn.disabled = false;
        publishBtn.textContent = mode === 'edit' ? 'Save changes' : 'Publish post';
      }
    });
  }

  return { init };
})();

