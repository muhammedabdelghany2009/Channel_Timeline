var CT = {
  year: new Date().getFullYear(),
  channelId: null,
  channelName: '',
  allVideos: [],
  filtered: [],
  settings: {},
  history: [],
  injected: false,
  observer: null
};

(function init() {
  var obs = new MutationObserver(function () { CT.route(); });
  obs.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('yt-navigate-finish', function () { CT.route(); });
  window.addEventListener('yt-page-data-updated', function () { CT.route(); });
  setTimeout(function () { CT.route(); }, 800);
})();

CT.route = function () {
  var path = location.pathname;

  if (CT.isChannelPage(path)) { CT.handleChannel(); return; }
};

CT.isChannelPage = function (p) {
  return /^\/@[^/]+(\/|$)/.test(p) || /^\/channel\/[^/]+/.test(p);
};


CT.handleChannel = function () {
  var handle = CT.getHandle();
  if (!handle) return;
  if (CT.channelId !== handle) {
    CT.channelId = handle;
    CT.allVideos = [];
    CT.injected = false;
  }
  if (CT.injected) return;
  CT.channelName = document.querySelector('#channel-name, ytd-channel-name yt-formatted-string')?.textContent?.trim() || handle;
  CT.injected = true;
  CT.loadSettings().then(function () { CT.injectChannelBtns(); });
};

CT.getHandle = function () {
  var m = location.pathname.match(/\/@([^/?]+)/) || location.pathname.match(/\/channel\/([^/?]+)/);
  return m ? m[1] : null;
};

CT.injectChannelBtns = function () {
  document.querySelector('.ct-wrap')?.remove();
  var target = document.querySelector('#subscribe-button, ytd-subscribe-button-renderer');
  if (!target) { setTimeout(function () { CT.injectChannelBtns(); }, 1000); return; }
  var wrap = document.createElement('div');
  wrap.className = 'ct-wrap';
  var b1 = document.createElement('button');
  b1.textContent = '📋 Playlist';
  b1.className = 'ct-pl-btn';
  b1.addEventListener('click', CT.onPlaylistClick.bind(CT));
  var b2 = document.createElement('button');
  b2.textContent = '⚙️ Settings';
  b2.className = 'ct-st-btn';
  b2.addEventListener('click', function () { CT.openSettings(false); });
  wrap.appendChild(b1);
  wrap.appendChild(b2);
  target.parentNode.insertBefore(wrap, target);
};

CT.onPlaylistClick = async function () {
  var key = await CT.getKey();
  if (!key) { CT.toast('❌ Add your API Key from the extension icon', 5000); return; }
  var s = CT.settings;
  var hasFilters = (s.years && s.years.length > 0)
    || (s.months && s.months.length > 0)
    || (s.keywords && s.keywords.trim())
    || (s.excludeWords && s.excludeWords.trim())
    || (s.types && s.types.length < 3)
    || +s.minDuration > 0 || +s.maxDuration > 0;
  if (!hasFilters) { CT.openSettings(true); return; }
  if (CT.allVideos.length > 0) { CT.openModal(); return; }
  CT.fetchAll();
};

CT.fetchAll = async function () {
  var key = await CT.getKey();
  var btn = document.querySelector('.ct-pl-btn');
  if (btn) { btn.textContent = '⏳ Loading…'; btn.disabled = true; }
  try {
    var cid = await CT.resolveId(key);
    if (!cid) throw new Error('Could not identify this channel');
    CT.allVideos = await CT.fetchVideos(key, cid);
    if (btn) { btn.textContent = '📋 Playlist (' + CT.allVideos.length + ')'; btn.disabled = false; }
    CT.openModal();
  } catch (e) {
    CT.toast('❌ ' + e.message, 5000);
    if (btn) { btn.textContent = '📋 Playlist'; btn.disabled = false; }
  }
};

CT.resolveId = async function (key) {
  var meta = document.querySelector('meta[itemprop="channelId"]');
  if (meta) return meta.content;
  var handle = CT.getHandle();
  if (!handle) return null;
  var r = await fetch('https://googleapis.com' + encodeURIComponent(handle) + '&key=' + key);
  var d = await r.json();
  if (d.items && d.items[0]) return d.items[0].id;
  r = await fetch('https://googleapis.com' + encodeURIComponent(handle) + '&key=' + key);
  d = await r.json();
  return d.items && d.items[0] ? d.items[0].id : null;
};

CT.fetchVideos = async function (key, cid) {
  var chR = await fetch('https://googleapis.com' + cid + '&key=' + key);
  var chD = await chR.json();
  if (chD.error) throw new Error(chD.error.message);
  CT.channelName = (chD.items && chD.items[0] && chD.items[0].snippet.title) || CT.channelName;
  var uploadsId = chD.items && chD.items[0] && chD.items[0].contentDetails.relatedPlaylists.uploads;
  if (!uploadsId) throw new Error('Could not find the uploads playlist');

  var raw = [], token = '', page = 0;
  do {
    page++;
    CT.toast('⏳ Fetching page ' + page + ' (' + raw.length + ' videos)…');
    var url = 'https://googleapis.com' + uploadsId + '&maxResults=50&pageToken=' + token + '&key=' + key;
    var r = await fetch(url);
    var d = await r.json();
    if (d.error) throw new Error(d.error.message);
    (d.items || []).forEach(function (item) {
      var sn = item.snippet;
      if (sn.title === 'Private video' || sn.title === 'Deleted video') return;
      raw.push({ id: sn.resourceId.videoId, title: sn.title, publishedAt: sn.publishedAt, thumbnail: (sn.thumbnails.medium || sn.thumbnails.default || {}).url || '' });
    });
    token = d.nextPageToken || '';
  } while (token);

  var videos = [];
  for (var i = 0; i < raw.length; i += 50) {
    CT.toast('⏳ Loading details ' + (i + 1) + '–' + Math.min(i + 50, raw.length) + ' / ' + raw.length + '…');
    var ids = raw.slice(i, i + 50).map(function (v) { return v.id; }).join(',');
    var url2 = 'https://googleapis.com' + ids + '&key=' + key;
    var r2 = await fetch(url2);
    var d2 = await r2.json();
    if (d2.error) throw new Error(d2.error.message);
    (d2.items || []).forEach(function (item) {
      var rv = raw.find(function (x) { return x.id === item.id; });
      if (!rv) return;
      var secs = CT.parseDur(item.contentDetails.duration || 'PT0S');
      var lt = item.snippet.liveBroadcastContent;
      var noStats = !item.statistics;
      var type = 'video';
      if (lt === 'live' || lt === 'completed') type = 'live';
      else if (secs > 0 && secs <= 62) type = 'short';
      else if (noStats) type = 'member';
      videos.push(Object.assign({}, rv, {
        type: type, duration: secs, durationStr: CT.fmtDur(secs),
        views: +(item.statistics && item.statistics.viewCount || 0),
        likes: +(item.statistics && item.statistics.likeCount || 0),
        description: item.snippet.description || ''
      }));
    });
  }
  return videos;
};

CT.applyFilters = function (videos) {
  var members = videos.filter(function (v) { return v.type === 'member'; });
  var regular = videos.filter(function (v) { return v.type !== 'member'; });
  var s = CT.settings;
  if (s.types && s.types.length && s.types.length < 3)
    regular = regular.filter(function (v) { return s.types.indexOf(v.type) !== -1; });
  if (s.years && s.years.length)
    regular = regular.filter(function (v) { return s.years.indexOf(new Date(v.publishedAt).getFullYear()) !== -1; });
  if (s.months && s.months.length)
    regular = regular.filter(function (v) { return s.months.indexOf(new Date(v.publishedAt).getMonth() + 1) !== -1; });
  if (s.keywords && s.keywords.trim()) {
    var kws = s.keywords.toLowerCase().split(/[\s,]+/).filter(Boolean);
    regular = regular.filter(function (v) { return kws.some(function (k) { return v.title.toLowerCase().indexOf(k) !== -1; }); });
  }
  if (s.excludeWords && s.excludeWords.trim()) {
    var exs = s.excludeWords.toLowerCase().split(/[\s,]+/).filter(Boolean);
    regular = regular.filter(function (v) { return !exs.some(function (k) { return v.title.toLowerCase().indexOf(k) !== -1; }); });
  }
  if (+s.minDuration > 0) regular = regular.filter(function (v) { return v.duration >= +s.minDuration * 60; });
  if (+s.maxDuration > 0) regular = regular.filter(function (v) { return v.duration <= +s.maxDuration * 60; });
  regular.sort(function (a, b) {
    var da = new Date(a.publishedAt), db = new Date(b.publishedAt);
    return s.order === 'oldest' ? da - db : db - da;
  });
  return { regular: regular, members: members };
};

CT.openModal = function () {
  CT.closeModal('ct-pl-modal');
  var res = CT.applyFilters(CT.allVideos);
  CT.filtered = res.regular;
  var stats = CT.calcStats(res.regular);

  var modal = document.createElement('div');
  modal.id = 'ct-pl-modal';
  modal.innerHTML = '<div class="ct-box ct-pl-box">'
    + '<div class="ct-hdr"><span>📋 Channel Timeline — ' + CT.esc(CT.channelName) + '</span>'
    + '<div style="display:flex;gap:8px;align-items:center">'
    + '<button class="ct-ico-btn" id="ct-srch-toggle">🔍</button>'
    + '<button class="ct-ico-btn" id="ct-close-pl">✖</button>'
    + '</div></div>'
    + '<div id="ct-srch-bar" class="ct-srch-bar ct-hidden"><input id="ct-srch-inp" type="text" placeholder="Search video titles…" /></div>'
    + '<div class="ct-stats">'
    + '<div class="ct-stat"><span class="ct-sn">' + res.regular.length + '</span><span class="ct-sl">Videos</span></div>'
    + '<div class="ct-stat"><span class="ct-sn">' + stats.totalHours + 'h</span><span class="ct-sl">Total Time</span></div>'
    + '<div class="ct-stat"><span class="ct-sn">' + stats.avgViews + '</span><span class="ct-sl">Avg Views</span></div>'
    + '<div class="ct-stat"><span class="ct-sn">' + stats.topMonth + '</span><span class="ct-sl">Top Month</span></div>'
    + '</div>'
    + '<div class="ct-body">'
    + '<div class="ct-row"><label>Playlist name:</label><input id="ct-pl-name" type="text" value="' + CT.esc(CT.channelName) + ' — Timeline" /></div>'
    + '<div class="ct-sel-row">'
    + '<button class="ct-sm-btn" id="ct-sel-all">✅ Select All</button>'
    + '<button class="ct-sm-btn" id="ct-desel-all">⬜ Deselect All</button>'
    + '<span class="ct-sel-count" id="ct-sel-count">' + res.regular.length + ' selected</span>'
    + '</div>'
    + '<div class="ct-vlist" id="ct-vlist">'
    + res.regular.map(function (v, i) { return CT.videoRow(v, i); }).join('')
    + (res.members.length ? CT.membersSection(res.members) : '')
    + '</div>'
    + '<div class="ct-actions">'
    + '<button class="ct-primary-btn" id="ct-make-pl">📋 Create Playlist</button>'
    + '<button class="ct-sec-btn" id="ct-export-btn">📥 Export CSV</button>'
    + '</div>'
    + (CT.history.length ? CT.historyHTML() : '')
    + '</div></div>';

  document.body.appendChild(modal);

  CT.el('ct-close-pl').onclick = function () { modal.remove(); };
  CT.el('ct-srch-toggle').onclick = function () {
    var bar = CT.el('ct-srch-bar');
    bar.classList.toggle('ct-hidden');
    if (!bar.classList.contains('ct-hidden')) CT.el('ct-srch-inp').focus();
  };
  CT.el('ct-srch-inp').addEventListener('input', function () {
    var q = this.value.toLowerCase();
    document.querySelectorAll('.ct-vrow').forEach(function (row) {
      var t = (row.querySelector('.ct-vtitle') || {}).textContent || '';
      row.style.display = t.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
    });
    CT.updateCount();
  });
  CT.el('ct-sel-all').onclick = function () { CT.setChecks(true); CT.updateCount(); };
  CT.el('ct-desel-all').onclick = function () { CT.setChecks(false); CT.updateCount(); };
  modal.addEventListener('change', function (e) { if (e.target.classList.contains('ct-chk')) CT.updateCount(); });
  CT.el('ct-make-pl').onclick = function () { CT.createPlaylist(); };
  CT.el('ct-export-btn').onclick = function () { CT.exportCsv(); };
};



CT.videoRow = function (v, i) {
  var icon = v.type === 'live' ? '🔴' : v.type === 'short' ? '📱' : '▶️';
  var date = new Date(v.publishedAt).toLocaleDateString('en-GB');
  var views = CT.fmtNum(v.views);
  return '<div class="ct-vrow" data-id="' + v.id + '">'
    + '<input type="checkbox" class="ct-chk" checked data-idx="' + i + '" />'
    + '<img class="ct-thumb" src="' + v.thumbnail + '" loading="lazy" />'
    + '<div class="ct-vinfo">'
    + '<div class="ct-vtitle">' + CT.esc(v.title) + '</div>'
    + '<div class="ct-vmeta">' + icon + ' ' + date + ' · ' + v.durationStr + ' · ' + views + ' views</div>'
    + '</div></div>';
};

CT.membersSection = function (members) {
  return '<div class="ct-members-sec">'
    + '<div class="ct-members-title">👑 Members-only (' + members.length + ') — count only</div>'
    + members.map(function (v) {
      return '<div class="ct-vrow ct-mrow">'
        + '<span class="ct-mlock">🔒</span>'
        + '<img class="ct-thumb" src="' + v.thumbnail + '" loading="lazy" />'
        + '<div class="ct-vinfo"><div class="ct-vtitle">' + CT.esc(v.title) + '</div>'
        + '<div class="ct-vmeta ct-mtag">👑 Members only</div></div></div>';
    }).join('')
    + '</div>';
};

CT.historyHTML = function () {
  return '<div class="ct-hist"><div class="ct-hist-title">📂 Previous Playlists</div>'
    + CT.history.map(function (h) {
      return '<div class="ct-hist-row">'
        + '<a href="' + h.url + '" target="_blank">' + CT.esc(h.name) + '</a>'
        + '<span class="ct-badge">' + h.count + '</span>'
        + '<span class="ct-hist-date">' + h.date + '</span>'
        + '</div>';
    }).join('') + '</div>';
};

CT.createPlaylist = function () {
  var chosen = CT.getChecked();
  if (!chosen.length) { CT.toast('❌ No videos selected'); return; }
  var name = (CT.el('ct-pl-name') || {}).value || CT.channelName + ' — Timeline';
  var ids = chosen.map(function (v) { return v.id; });
  var url = 'https://youtube.com' + ids.join(',') + '&title=' + encodeURIComponent(name.trim());
  CT.showResult(url, name.trim(), ids.length);
  CT.pushHistory({ name: name.trim(), url: url, count: ids.length, date: new Date().toLocaleDateString('en-GB'), channelId: CT.channelId });
};

CT.showResult = function (url, name, count) {
  CT.closeModal('ct-res-modal');
  var modal = document.createElement('div');
  modal.id = 'ct-res-modal';
  modal.innerHTML = '<div class="ct-box ct-res-box">'
    + '<div class="ct-hdr"><span>✅ Playlist ready!</span>'
    + '<button class="ct-ico-btn" id="ct-close-res">✖</button></div>'
    + '<div class="ct-body">'
    + '<div class="ct-res-name">' + CT.esc(name) + '</div>'
    + '<div class="ct-res-count">📊 ' + count + ' videos</div>'
    + '<div class="ct-res-warn">⚠️ <strong>Save this link now.</strong><br>It is the only way to access this playlist later.</div>'
    + '<div class="ct-res-url-wrap"><input type="text" id="ct-res-url" value="' + CT.esc(url) + '" readonly />'
    + '<button class="ct-ico-btn" id="ct-copy-res">📋</button></div>'
    + '<a class="ct-primary-btn ct-open-btn" href="' + CT.esc(url) + '" target="_blank">▶️ Open Playlist</a>'
    + '</div></div>';
  document.body.appendChild(modal);
  CT.el('ct-close-res').onclick = function () { modal.remove(); };
  CT.el('ct-copy-res').onclick = function () {
    navigator.clipboard.writeText(url);
    CT.el('ct-copy-res').textContent = '✅';
    setTimeout(function () { CT.el('ct-copy-res').textContent = '📋'; }, 2000);
  };
};

CT.exportCsv = function () {
  var chosen = CT.getChecked();
  if (!chosen.length) { CT.toast('❌ No videos selected'); return; }
  var BOM = '\uFEFF';
  var header = ['#', 'Title', 'URL', 'Date', 'Duration', 'Views', 'Likes', 'Type'].join(',');
  var rows = chosen.map(function (v, i) {
    return [i + 1, '"' + v.title.replace(/"/g, '""') + '"',
    'https://youtube.com' + v.id,
    new Date(v.publishedAt).toLocaleDateString('en-GB'),
    v.durationStr, v.views, v.likes, v.type].join(',');
  });
  var csv = BOM + [header].concat(rows).join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = CT.channelName + '_timeline.csv';
  a.click();
  CT.toast('✅ Exported ' + chosen.length + ' videos');
};

CT.openSettings = function (fromBtn) {
  CT.closeModal('ct-st-modal');
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var s = CT.settings;
  var modal = document.createElement('div');
  modal.id = 'ct-st-modal';

  var yearsHTML = '';
  var sel = s.years || [];
  for (var y = CT.year; y >= 2005; y--) {
    yearsHTML += '<label class="ct-year-lbl"><input type="checkbox" class="st-year-cb" value="' + y + '" ' + (sel.indexOf(y) !== -1 ? 'checked' : '') + '>' + y + '</label>';
  }

  var monthsHTML = months.map(function (mn, i) {
    var num = i + 1;
    return '<label class="ct-month-lbl"><input type="checkbox" class="st-month" value="' + num + '" ' + (s.months && s.months.indexOf(num) !== -1 ? 'checked' : '') + '>' + mn + '</label>';
  }).join('');

  modal.innerHTML = '<div class="ct-box ct-st-box">'
    + '<div class="ct-hdr"><span>⚙️ Settings' + (fromBtn ? ' — set filters first' : '') + '</span>'
    + '<button class="ct-ico-btn" id="ct-close-st">✖</button></div>'
    + '<div class="ct-body">'
    + (fromBtn ? '<div class="ct-hint">⚠️ Choose at least one filter then click Save</div>' : '')
    + '<div class="ct-field"><label>🔃 Order</label>'
    + '<select id="st-order"><option value="oldest"' + (s.order === 'oldest' ? ' selected' : '') + '>Oldest to newest</option>'
    + '<option value="newest"' + (s.order === 'newest' ? ' selected' : '') + '>Newest to oldest</option></select></div>'
    + '<div class="ct-field"><label>📅 Years</label><div class="ct-years-grid">' + yearsHTML + '</div></div>'
    + '<div class="ct-field"><label>🗓️ Months</label><div class="ct-months-grid">' + monthsHTML + '</div></div>'
    + '<div class="ct-field"><label>🔍 Include keywords</label><input id="st-kw" type="text" placeholder="python, tutorial" value="' + CT.esc(s.keywords || '') + '" /></div>'
    + '<div class="ct-field"><label>🚫 Exclude keywords</label><input id="st-ex" type="text" placeholder="ad, sponsor" value="' + CT.esc(s.excludeWords || '') + '" /></div>'
    + '<div class="ct-field"><label>⏱️ Duration (minutes)</label>'
    + '<div class="ct-dur-row"><input id="st-mind" type="number" min="0" placeholder="Min" value="' + (s.minDuration || '') + '" />'
    + '<span>—</span><input id="st-maxd" type="number" min="0" placeholder="Max" value="' + (s.maxDuration || '') + '" /></div></div>'
    + '<div class="ct-field"><label>🎬 Video type</label><div class="ct-types-row">'
    + '<label><input type="checkbox" class="st-type" value="video" ' + (s.types && s.types.indexOf('video') !== -1 ? 'checked' : '') + '> ▶️ Regular</label>'
    + '<label><input type="checkbox" class="st-type" value="live" ' + (s.types && s.types.indexOf('live') !== -1 ? 'checked' : '') + '> 🔴 Live</label>'
    + '<label><input type="checkbox" class="st-type" value="short" ' + (s.types && s.types.indexOf('short') !== -1 ? 'checked' : '') + '> 📱 Short</label>'
    + '</div></div>'
    + '<div class="ct-actions">'
    + '<button id="st-save" class="ct-primary-btn">💾 Save Settings</button>'
    + '<button id="st-reset" class="ct-sec-btn">🔄 Reset</button>'
    + '</div></div></div>';

  document.body.appendChild(modal);

  CT.el('ct-close-st').onclick = function () { modal.remove(); };
  CT.el('st-reset').onclick = function () {
    if (!confirm('Reset all settings?')) return;
    CT.settings = { order: 'oldest', years: [], months: [], keywords: '', excludeWords: '', types: ['video', 'live', 'short'], minDuration: 0, maxDuration: 0 };
    CT.saveSettings(CT.settings);
    modal.remove();
    CT.openSettings(false);
  };
  CT.el('st-save').onclick = function () {
    var years = Array.from(document.querySelectorAll('.st-year-cb:checked')).map(function (c) { return +c.value; });
    var newS = {
      order: CT.el('st-order').value,
      years: years,
      months: Array.from(document.querySelectorAll('.st-month:checked')).map(function (c) { return +c.value; }),
      keywords: CT.el('st-kw').value.trim(),
      excludeWords: CT.el('st-ex').value.trim(),
      minDuration: +CT.el('st-mind').value || 0,
      maxDuration: +CT.el('st-maxd').value || 0,
      types: Array.from(document.querySelectorAll('.st-type:checked')).map(function (c) { return c.value; })
    };
    CT.saveSettings(newS);
    modal.remove();
    CT.toast('✅ Settings saved');
    if (fromBtn) { CT.allVideos = []; CT.fetchAll(); }
  };
};
CT.loadSettings = async function () {
  var d = await CT.cGet(['ct_s_' + CT.channelId, 'ct_h_' + CT.channelId]);
  CT.settings = d['ct_s_' + CT.channelId] || { order: 'oldest', years: [], months: [], keywords: '', excludeWords: '', types: ['video', 'live', 'short'], minDuration: 0, maxDuration: 0 };
  CT.history = d['ct_h_' + CT.channelId] || [];
};

CT.saveSettings = async function (s) {
  CT.settings = s;
  var obj = {};
  obj['ct_s_' + CT.channelId] = s;
  await CT.cSet(obj);
};

CT.pushHistory = async function (entry) {
  CT.history.unshift(entry);
  if (CT.history.length > 50) CT.history = CT.history.slice(0, 50);
  var obj1 = {}, obj2 = {};
  obj1['ct_h_' + CT.channelId] = CT.history;
  await CT.cSet(obj1);
  var d = await CT.cGet('ct_history_global');
  var gh = d['ct_history_global'] || [];
  gh.unshift(Object.assign({}, entry, { id: Date.now(), type: 'channel' }));
  if (gh.length > 200) gh.splice(200);
  obj2['ct_history_global'] = gh;
  await CT.cSet(obj2);
};

CT.calcStats = function (videos) {
  if (!videos.length) return { totalHours: '0', avgViews: '0', topMonth: '—' };
  var secs = videos.reduce(function (a, v) { return a + v.duration; }, 0);
  var totalHours = (secs / 3600).toFixed(1);
  var avgViews = CT.fmtNum(Math.round(videos.reduce(function (a, v) { return a + v.views; }, 0) / videos.length));
  var mc = {};
  videos.forEach(function (v) {
    var k = new Date(v.publishedAt).toLocaleString('en-US', { month: 'short', year: 'numeric' });
    mc[k] = (mc[k] || 0) + 1;
  });
  var topMonth = Object.entries(mc).sort(function (a, b) { return b[1] - a[1]; })[0];
  return { totalHours: totalHours, avgViews: avgViews, topMonth: topMonth ? topMonth[0] : '—' };
};

CT.setChecks = function (val) {
  document.querySelectorAll('.ct-chk').forEach(function (c) {
    if (c.closest('.ct-vrow').style.display !== 'none') c.checked = val;
  });
};
CT.updateCount = function () {
  var n = document.querySelectorAll('.ct-chk:checked').length;
  var el = CT.el('ct-sel-count');
  if (el) el.textContent = n + ' selected';
};
CT.getChecked = function () {
  return Array.from(document.querySelectorAll('.ct-chk:checked')).map(function (c) {
    return CT.filtered[+c.dataset.idx];
  }).filter(Boolean);
};
CT.parseDur = function (iso) {
  var m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
};
CT.fmtDur = function (s) {
  var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? h + ':' + CT.pad(m) + ':' + CT.pad(sec) : m + ':' + CT.pad(sec);
};
CT.pad = function (n) { return String(n).padStart(2, '0'); };
CT.fmtNum = function (n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n); };
CT.getKey = async function () { var d = await CT.cGet('ct_api_key'); return d.ct_api_key || ''; };
CT.closeModal = function (id) { var el = document.getElementById(id); if (el) el.remove(); };
CT.el = function (id) { return document.getElementById(id); };
CT.toast = function (msg, ms) {
  var old = document.getElementById('ct-toast');
  if (old) old.remove();
  var t = document.createElement('div');
  t.id = 'ct-toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, ms || 2500);
};
CT.cGet = function (key) { return new Promise(function (r) { chrome.storage.local.get(key, r); }); };
CT.cSet = function (obj) { return new Promise(function (r) { chrome.storage.local.set(obj, r); }); };
CT.esc = function (s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
