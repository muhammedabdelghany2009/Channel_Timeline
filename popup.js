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

