'use strict';

// #73 agency portal. Token-auth ONLY (never the dashboard JWT). The access key lives in
// sessionStorage (cleared on tab close — chosen over localStorage so it doesn't linger on a
// shared agency machine) and is sent as a Bearer header. Any 401/403 resets to the entry
// screen with a clear "key invalid" message — never a wall of 403s. The token is narrow
// (agency scope), so even if leaked its blast radius is upload + drafts to designated
// playlists, which the admin must publish.
(function () {
  const KEY = 'agency_key';
  const $ = (id) => document.getElementById(id);
  let uploadedContentId = null;

  const getKey = () => sessionStorage.getItem(KEY) || '';
  const setKey = (k) => sessionStorage.setItem(KEY, k);
  const clearKey = () => sessionStorage.removeItem(KEY);

  function showEntry(msg) {
    $('portal').classList.add('hidden');
    $('entry').classList.remove('hidden');
    const m = $('entryMsg');
    if (msg) { m.textContent = msg; m.style.display = 'block'; } else { m.style.display = 'none'; }
  }
  function showPortal() {
    $('entry').classList.add('hidden');
    $('portal').classList.remove('hidden');
  }
  function portalMsg(text, kind) {
    const m = $('portalMsg');
    m.textContent = text || '';
    m.className = 'msg ' + (kind || 'ok');
    m.style.display = text ? 'block' : 'none';
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Fetch /api/agency/* with the bearer key. On 401/403 -> graceful reset to entry.
  async function agencyFetch(path, opts = {}) {
    const headers = Object.assign({}, opts.headers, { Authorization: 'Bearer ' + getKey() });
    const res = await fetch('/api/agency' + path, Object.assign({}, opts, { headers }));
    if (res.status === 401 || res.status === 403) {
      clearKey();
      showEntry('That access key is invalid, revoked, or expired. Paste it again.');
      throw new Error('auth');
    }
    return res;
  }

  async function loadPortal() {
    let playlists;
    try {
      playlists = await (await agencyFetch('/playlists')).json();
    } catch (e) { return; } // agencyFetch already reset to entry on an auth failure
    const sel = $('plSelect');
    sel.innerHTML = playlists.length
      ? playlists.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('')
      : '<option value="">No playlists designated — ask your contact</option>';
    showPortal();
    portalMsg('', '');
  }

  // ---- entry ----
  $('enterBtn').addEventListener('click', () => {
    const k = $('keyInput').value.trim();
    if (!k) return;
    setKey(k);
    $('keyInput').value = '';
    loadPortal();
  });
  $('keyInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('enterBtn').click(); });
  $('signOutBtn').addEventListener('click', () => { clearKey(); uploadedContentId = null; showEntry(''); });

  // ---- upload ----
  $('fileInput').addEventListener('change', () => { $('uploadBtn').disabled = !$('fileInput').files.length; });
  $('uploadBtn').addEventListener('click', async () => {
    const file = $('fileInput').files[0];
    if (!file) return;
    $('uploadBtn').disabled = true;
    portalMsg('Uploading…', 'ok');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await agencyFetch('/content', { method: 'POST', body: fd });
      if (!res.ok) { portalMsg('Upload failed. Try again.', 'err'); return; }
      const content = await res.json();
      uploadedContentId = content.id;
      $('uploadInfo').textContent = 'Uploaded: ' + (content.filename || content.id);
      $('scheduleBtn').disabled = false;
      portalMsg('Uploaded. Now schedule it below.', 'ok');
    } catch (e) { /* auth already handled */ }
    finally { if (getKey()) $('uploadBtn').disabled = false; }
  });

  // ---- schedule ----
  $('scheduleBtn').addEventListener('click', async () => {
    if (!uploadedContentId) return portalMsg('Upload a file first.', 'err');
    const playlistId = $('plSelect').value;
    if (!playlistId) return portalMsg('No playlist available to schedule on.', 'err');
    const body = { content_id: uploadedContentId };
    if ($('startDate').value) body.start_date = $('startDate').value;
    if ($('endDate').value) body.end_date = $('endDate').value;
    $('scheduleBtn').disabled = true;
    try {
      const res = await agencyFetch('/playlists/' + encodeURIComponent(playlistId) + '/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        portalMsg(e.error || 'Could not add to the playlist.', 'err');
        $('scheduleBtn').disabled = false;
        return;
      }
      portalMsg('Added as a draft — your contact will publish it. You can upload another.', 'ok');
      uploadedContentId = null;
      $('uploadInfo').textContent = '';
      $('fileInput').value = '';
      $('uploadBtn').disabled = true;
    } catch (e) { /* auth already handled */ }
  });

  // ---- boot: a stored key is validated by the first /playlists call ----
  if (getKey()) loadPortal(); else showEntry('');
})();
