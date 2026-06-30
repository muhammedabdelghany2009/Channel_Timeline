const store = {
    get: (k) => new Promise(r => chrome.storage.local.get(k, r)),
    set: (o) => new Promise(r => chrome.storage.local.set(o, r)),
    del: (k) => new Promise(r => chrome.storage.local.remove(k, r))
};
const $p = id => document.getElementById(id);

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        $p('tab-' + tab.dataset.tab).classList.add('active');
    });
});

const apikeyInput = $p('apikey-input');
const statusBar = $p('key-status-bar');

store.get('ct_api_key').then(d => {
    if (d.ct_api_key) apikeyInput.value = d.ct_api_key;
});

apikeyInput.addEventListener('input', () => {
    const key = apikeyInput.value.trim();
    if (key.length > 10) {
        store.set({ ct_api_key: key });
        showSt('✅ Key saved', 'ok');
    }
});

$p('toggle-visibility').addEventListener('click', () => {
    const isPass = apikeyInput.type === 'password';
    apikeyInput.type = isPass ? 'text' : 'password';
    $p('toggle-visibility').textContent = isPass ? '🙈' : '👁';
});

$p('test-key-btn').addEventListener('click', async () => {
    const key = apikeyInput.value.trim();
    if (!key) { showSt('❌ Enter a key first', 'err'); return; }
    showSt('⏳ Testing…', 'ok');
    try {
        const res = await fetch('https://googleapis.com' + key);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        showSt('✅ Key is working!', 'ok');
        await store.set({ ct_api_key: key });
    } catch (e) {
        showSt('❌ ' + e.message, 'err');
    }
});

function showSt(msg, type) {
    statusBar.textContent = msg;
    statusBar.className = 'key-status-bar ' + type;
    if (type === 'ok') setTimeout(() => statusBar.classList.add('hidden'), 2000);
}
let mergerLinks = [];
const mergerInput = $p('merger-input');
const mergerList = $p('merger-list');
const mergeBtn = $p('merge-btn');
const mergerRes = $p('merger-result');

$p('merger-add-btn').addEventListener('click', addLink);
mergerInput.addEventListener('keydown', e => { if (e.key === 'Enter') addLink(); });

async function addLink() {
    const raw = mergerInput.value.trim();
    if (!raw) return;
    const parsed = parseYtUrl(raw);
    if (!parsed) { showMErr('❌ Invalid link — paste a YouTube playlist or video URL'); return; }
    if (mergerLinks.find(l => l.url === raw)) { showMErr('⚠️ This link is already in the list'); return; }
    mergerLinks.push({ url: raw, ...parsed });
    mergerInput.value = '';
    renderMerger();
}

function parseYtUrl(url) {
    try {
        const u = new URL(url);
        const listId = u.searchParams.get('list');
        if (listId) return { type: 'playlist', id: listId, label: 'Playlist: ' + listId.slice(0, 16) + '…' };
        let vid = u.searchParams.get('v');
        if (!vid && u.hostname === 'youtu.be') vid = u.pathname.slice(1);
        if (vid) return { type: 'video', id: vid, label: 'Video: ' + vid };
    } catch { }
    return null;
}

function showMErr(msg) {
    document.querySelector('.merger-err')?.remove();
    const e = document.createElement('div');
    e.style.cssText = 'color:#ef5350;font-size:11px;margin-top:4px;padding:4px 6px;background:#2a1515;border-radius:5px;';
    e.textContent = msg;
    e.className = 'merger-err';
    mergerInput.closest('.field').appendChild(e);
    setTimeout(() => e.remove(), 3000);
}

function renderMerger() {
    mergerList.innerHTML = '';
    mergerLinks.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'merger-item';
        div.innerHTML = '<span class="merger-item-icon">' + (item.type === 'playlist' ? '📋' : '▶️') + '</span>'
            + '<span class="merger-item-label">' + esc(item.label) + '</span>'
            + '<span class="merger-item-count" id="mc-' + idx + '">…</span>'
            + '<button class="merger-item-del" data-idx="' + idx + '">✕</button>';
        mergerList.appendChild(div);
    });

    mergerList.querySelectorAll('.merger-item-del').forEach(btn => {
        btn.addEventListener('click', () => {
            mergerLinks.splice(+btn.dataset.idx, 1);
            renderMerger();
        });
    });

    const has = mergerLinks.length > 0;
    mergeBtn.disabled = !has;
    $p('merger-name-wrap').style.display = has ? 'block' : 'none';
    mergerRes.classList.add('hidden');
    if (has) resolveCounts();
}

async function resolveCounts() {
    const key = (await store.get('ct_api_key')).ct_api_key || '';
    for (let i = 0; i < mergerLinks.length; i++) {
        const item = mergerLinks[i];
        const el = $p('mc-' + i);
        if (!el) continue;
        try {
            if (item.type === 'video') {
                item.videoIds = [item.id];
                el.textContent = '1 video';
            } else if (item.type === 'playlist' && key) {
                const ids = await fetchPlIds(key, item.id);
                item.videoIds = ids;
                el.textContent = ids.length + ' videos';
            } else {
                el.textContent = key ? '?' : 'Need API Key';
            }
        } catch { el.textContent = 'Error'; }
    }
}

async function fetchPlIds(key, plId) {
    const ids = [];
    let token = '';
    do {
        const r = await fetch('https://googleapis.com' + plId + '&maxResults=50&pageToken=' + token + '&key=' + key);
        const d = await r.json();
        if (d.error) throw new Error(d.error.message);
        for (const item of (d.items || [])) {
            const vid = item.snippet?.resourceId?.videoId;
            if (vid) ids.push(vid);
        }
        token = d.nextPageToken || '';
    } while (token);
    return ids;
}

$p('merge-btn').addEventListener('click', async () => {
    let allIds = [];
    for (const item of mergerLinks) {
        if (item.videoIds?.length) allIds = allIds.concat(item.videoIds);
    }
    allIds = [...new Set(allIds)];
    if (!allIds.length) { showMErr('❌ No videos found — save your API Key first'); return; }

    const name = $p('merger-name').value.trim() || 'Merged Playlist';
    const url = 'https://youtube.com' + allIds.join(',') + '&title=' + encodeURIComponent(name);

    $p('result-url').value = url;
    $p('open-result-btn').href = url;
    mergerRes.classList.remove('hidden');

    $p('copy-result-btn').onclick = () => {
        navigator.clipboard.writeText(url);
        $p('copy-result-btn').textContent = '✅';
        setTimeout(() => { $p('copy-result-btn').textContent = '📋'; }, 2000);
    };

    await saveHistory({ name, url, count: allIds.length, type: 'merger', date: new Date().toLocaleDateString('en-GB'), sources: mergerLinks.map(l => l.url) });
    renderHistory();
});

document.querySelectorAll('.dl-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const code = document.getElementById(btn.dataset.target);
        if (!code) return;
        navigator.clipboard.writeText(code.textContent);
        btn.textContent = '✅';
        setTimeout(() => { btn.textContent = '📋'; }, 2000);
    });
});

async function loadHistory() {
    const d = await store.get('ct_history_global');
    return d.ct_history_global || [];
}

async function saveHistory(entry) {
    let h = await loadHistory();
    h.unshift({ ...entry, id: Date.now() });
    if (h.length > 200) h = h.slice(0, 200);
    await store.set({ ct_history_global: h });
}

async function renderHistory() {
    const list = await loadHistory();
    const el = $p('history-list');
    $p('history-count').textContent = list.length + ' playlist' + (list.length !== 1 ? 's' : '');
    if (!list.length) { el.innerHTML = '<div class="empty-state">📭 No playlists saved yet</div>'; return; }
    el.innerHTML = list.map(item => `
    <div class="history-item">
      <div class="history-item-name">${esc(item.name)}</div>
      <div class="history-item-meta">${item.type === 'merger' ? '🔗 Merged' : '📋 Channel'} · ${item.count} videos · ${item.date}</div>
      <div class="history-item-url">${esc(item.url)}</div>
      <div class="history-item-actions">
        <a class="btn-open" href="${esc(item.url)}" target="_blank">▶️ Open</a>
        <button class="btn-copy-url" data-url="${esc(item.url)}">📋 Copy</button>
        <button class="btn-delete" data-id="${item.id}">🗑</button>
      </div>
    </div>`).join('');

    el.querySelectorAll('.btn-copy-url').forEach(btn => {
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(btn.dataset.url);
            btn.textContent = '✅';
            setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
        });
    });
    el.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            let h = await loadHistory();
            h = h.filter(x => x.id !== +btn.dataset.id);
            await store.set({ ct_history_global: h });
            renderHistory();
        });
    });
}

$p('export-history-btn').addEventListener('click', async () => {
    const list = await loadHistory();
    if (!list.length) { alert('No playlists to export'); return; }
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'channel-timeline-history-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
});

$p('clear-history-btn').addEventListener('click', async () => {
    if (!confirm('Clear all saved playlists?')) return;
    await store.del('ct_history_global');
    renderHistory();
});

renderHistory();

function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
