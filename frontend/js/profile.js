/* =========================================================
   InkSphere — profile.js
   Drives profile.html. With no `user` query param, shows the
   logged-in user's own editable profile. With `?user=<id>`,
   shows a read-only public profile for that user.
   ========================================================= */

const ProfilePage = (() => {
  let profileUser = null;
  let isOwnProfile = false;

  async function init() {
    const targetId = getQueryParam('user');
    const currentUser = Auth.getCurrentUser();

    if (!targetId) {
      if (!requireAuth()) return;
      isOwnProfile = true;
    }

    try {
      if (isOwnProfile) {
        profileUser = await Auth.refreshCurrentUser() || currentUser;
      } else {
        const data = await API.users.getProfile(targetId);
        profileUser = data.user || data;
        isOwnProfile = currentUser && (currentUser.id === (profileUser.id || profileUser._id));
      }
      renderHeader();
      renderTabs();
      loadUserPosts();
    } catch (err) {
      renderEmptyState(document.getElementById('profileRoot'), {
        title: 'Couldn\u2019t load this profile',
        body: err.message || 'This user may not exist.',
      });
    }
  }

  function renderHeader() {
    document.getElementById('profileAvatar').innerHTML = renderAvatarHtml(profileUser.name, profileUser.avatarUrl, 'avatar-xl');
    document.getElementById('profileName').textContent = profileUser.name || 'Unknown';
    document.getElementById('profileBio').textContent = profileUser.bio || (isOwnProfile ? 'Add a short bio to tell readers about yourself.' : 'This writer hasn\u2019t added a bio yet.');
    document.getElementById('profileJoined').textContent = `Joined ${formatDate(profileUser.createdAt)}`;

    document.getElementById('statFollowers').textContent = profileUser.followersCount ?? 0;
    document.getElementById('statPosts').textContent = profileUser.postsCount ?? '—';

    const actions = document.getElementById('profileActions');
    if (isOwnProfile) {
      actions.innerHTML = `<button type="button" class="btn btn-outline" id="editProfileToggle">Edit profile</button>`;
      document.getElementById('editProfileToggle').addEventListener('click', () => {
        document.getElementById('profileEditSection').classList.toggle('hidden');
        document.getElementById('profileEditSection').scrollIntoView({ behavior: 'smooth' });
        prefillEditForm();
      });
      document.getElementById('profileEditSection').classList.remove('hidden');
      wireEditForm();
      wirePasswordForm();
      wireDangerZone();
    } else {
      const isFollowing = profileUser.isFollowing;
      actions.innerHTML = `<button type="button" class="btn ${isFollowing ? 'btn-outline' : 'btn-primary'}" id="followBtn">${isFollowing ? 'Following' : 'Follow'}</button>`;
      document.getElementById('followBtn').addEventListener('click', handleFollow);
    }
  }

  function renderTabs() {
    document.querySelectorAll('.profile-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadUserPosts(tab.dataset.status);
      });
    });
  }

  async function loadUserPosts(status = '') {
    const grid = document.getElementById('profilePostGrid');
    renderPostGridSkeletons(grid, 4);
    try {
      const id = profileUser.id || profileUser._id;
      const params = isOwnProfile ? {} : { status: status || 'published' };
      const data = isOwnProfile && status === 'all'
        ? await API.posts.listMine()
        : await API.posts.list({ author: id, ...params });
      const items = data.posts || data.items || data;
      if (!items.length) {
        renderEmptyState(grid, { title: 'No posts here yet', body: isOwnProfile ? 'Posts you publish will show up on your profile.' : 'This writer hasn\u2019t published anything yet.' });
        return;
      }
      grid.innerHTML = items.map(renderPostCard).join('');
    } catch (err) {
      renderEmptyState(grid, { title: 'Couldn\u2019t load posts', body: err.message || 'Something went wrong.' });
    }
  }

  async function handleFollow() {
    const btn = document.getElementById('followBtn');
    const id = profileUser.id || profileUser._id;
    btn.disabled = true;
    try {
      if (profileUser.isFollowing) {
        await API.users.unfollow(id);
        profileUser.isFollowing = false;
        profileUser.followersCount = Math.max(0, (profileUser.followersCount || 1) - 1);
      } else {
        await API.users.follow(id);
        profileUser.isFollowing = true;
        profileUser.followersCount = (profileUser.followersCount || 0) + 1;
      }
      document.getElementById('statFollowers').textContent = profileUser.followersCount;
      btn.textContent = profileUser.isFollowing ? 'Following' : 'Follow';
      btn.classList.toggle('btn-primary', !profileUser.isFollowing);
      btn.classList.toggle('btn-outline', profileUser.isFollowing);
    } catch (err) {
      showToast(err.message || 'Could not update follow status.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------------- Edit profile (own only) ---------------- */
  function prefillEditForm() {
    const form = document.getElementById('profileEditForm');
    if (!form) return;
    form.name.value = profileUser.name || '';
    form.bio.value = profileUser.bio || '';
    document.getElementById('editAvatarPreview').innerHTML = renderAvatarHtml(profileUser.name, profileUser.avatarUrl, 'avatar-lg');
  }

  function wireEditForm() {
    const form = document.getElementById('profileEditForm');
    if (!form) return;

    const avatarInput = document.getElementById('avatarFileInput');
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('editAvatarPreview').innerHTML = `<img class="avatar avatar-lg" src="${e.target.result}" alt="Avatar preview">`;
      };
      reader.readAsDataURL(file);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Saving…';

      try {
        let avatarUrl = profileUser.avatarUrl;
        if (avatarInput.files[0]) {
          const formData = new FormData();
          formData.append('avatar', avatarInput.files[0]);
          const res = await API.users.uploadAvatar(formData);
          avatarUrl = res.url || res.avatarUrl;
        }
        const updated = await API.users.updateProfile({
          name: form.name.value.trim(),
          bio: form.bio.value.trim(),
          avatarUrl,
        });
        profileUser = { ...profileUser, ...(updated.user || updated) };
        Auth.setCurrentUser(profileUser);
        renderHeader();
        showToast('Profile updated.', 'success');
      } catch (err) {
        showToast(err.message || 'Could not update profile.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save changes';
      }
    });
  }

  function wirePasswordForm() {
    const form = document.getElementById('passwordChangeForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorBox = document.getElementById('passwordFormError');
      errorBox.classList.add('hidden');

      if (form.newPassword.value !== form.confirmNewPassword.value) {
        errorBox.textContent = 'New passwords do not match.';
        errorBox.classList.remove('hidden');
        return;
      }

      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;

      try {
        await API.users.changePassword({
          currentPassword: form.currentPassword.value,
          newPassword: form.newPassword.value,
        });
        showToast('Password updated.', 'success');
        form.reset();
      } catch (err) {
        errorBox.textContent = err.message || 'Could not update password.';
        errorBox.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update password';
      }
    });
  }

  function wireDangerZone() {
    const btn = document.getElementById('deleteAccountBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (!confirm('Delete your account permanently? This cannot be undone.')) return;
      if (!confirm('Are you absolutely sure? All your posts and comments will be removed.')) return;
      try {
        await API.users.deleteAccount();
        Auth.logout();
        window.location.href = 'index.html';
      } catch (err) {
        showToast(err.message || 'Could not delete account.', 'error');
      }
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('profileRoot')) ProfilePage.init();
});
