var CT = {
  year:      new Date().getFullYear(),
  channelId: null,
  channelName: '',
  allVideos:   [],
  filtered:    [],
  settings:    {},
  history:     [],
  injected:    false,
  observer:    null
};

(function init() {
  var obs = new MutationObserver(function() { CT.route(); });
  obs.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('yt-navigate-finish', function() { CT.route(); });
  window.addEventListener('yt-page-data-updated', function() { CT.route(); });
  setTimeout(function() { CT.route(); }, 800);
})();

CT.route = function() {
  var path = location.pathname;

  if (CT.isHomePage(path))        { CT.handleHome();          return; }
  if (CT.isShorts(path))          { CT.handleShorts();        return; }
  if (CT.isSearch(path))          { CT.handleSearch();        return; }
  if (CT.isSubscriptions(path))   { CT.handleSubscriptions(); return; }
  if (CT.isWatchPage(path))       { CT.handleWatch();         return; }
  if (CT.isChannelPage(path))     { CT.handleChannel();       return; }
};

CT.isHomePage      = function(p) { return p === '/' || p === '/feed/trending'; };
CT.isShorts        = function(p) { return p.indexOf('/shorts/') === 0; };
CT.isSearch        = function(p) { return p === '/results'; };
CT.isSubscriptions = function(p) { return p === '/feed/subscriptions'; };
CT.isWatchPage     = function(p) { return p === '/watch'; };
CT.isChannelPage   = function(p) {
  return /^\/@[^/]+(\/|$)/.test(p) || /^\/channel\/[^/]+/.test(p);
};

CT.handleHome = function() {
  setTimeout(function() {
    var feed = document.querySelector('ytd-browse[page-subtype="home"], ytd-rich-grid-renderer, #contents.ytd-rich-grid-renderer');
    if (feed && !document.getElementById('ct-home-block')) {
      feed.style.display = 'none';
      var shorts = document.querySelectorAll('ytd-rich-section-renderer, ytd-reel-shelf-renderer');
      shorts.forEach(function(el) { el.style.display = 'none'; });
      CT.injectHomeMessage();
    }
  }, 600);
};

CT.injectHomeMessage = function() {
  if (document.getElementById('ct-home-block')) return;
  var wrap = document.createElement('div');
  wrap.id = 'ct-home-block';
  wrap.innerHTML = '<div class="ct-home-msg">'
    + '<div class="ct-home-icon">📋</div>'
    + '<div class="ct-home-title">Channel Timeline</div>'
    + '<div class="ct-home-sub">The home feed is hidden for your focus.</div>'
    + '<button class="ct-home-btn" id="ct-go-subs">Go to Subscriptions</button>'
    + '</div>';
  var primary = document.querySelector('#primary, ytd-page-manager');
  if (primary) {
    primary.insertBefore(wrap, primary.firstChild);
  } else {
    document.body.appendChild(wrap);
  }
  document.getElementById('ct-go-subs').addEventListener('click', function() {
    window.location.href = 'https://youtube.com';
  });
};

CT.handleShorts = function() {
  window.location.replace('https://youtube.com');
};

CT.handleSearch = function() {
  setTimeout(function() {
    CT.filterSearchToChannels();
  }, 800);
  var obs2 = new MutationObserver(function() {
    CT.filterSearchToChannels();
  });
  var results = document.querySelector('ytd-section-list-renderer');
  if (results) obs2.observe(results, { childList: true, subtree: true });
};

CT.filterSearchToChannels = function() {
  var items = document.querySelectorAll('ytd-item-section-renderer');
  items.forEach(function(section) {
    var hasChannel = section.querySelector('ytd-channel-renderer');
    if (!hasChannel) {
      section.style.display = 'none';
    }
  });

  var chips = document.querySelectorAll('yt-chip-cloud-chip-renderer');
  chips.forEach(function(chip) {
    var txt = chip.textContent.trim().toLowerCase();
    if (txt === 'channels') {
      chip.click();
    }
  });

  var shorts = document.querySelectorAll('ytd-reel-shelf-renderer, ytd-rich-section-renderer');
  shorts.forEach(function(el) { el.style.display = 'none'; });
};

CT.handleSubscriptions = function() {
  setTimeout(function() {
    CT.hideSubsShorts();
    CT.injectSubsFilter();
  }, 700);
};

CT.hideSubsShorts = function() {
  var items = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer');
  items.forEach(function(item) {
    var link = item.querySelector('a[href]');
    if (link && link.href && link.href.indexOf('/shorts/') !== -1) {
      item.style.display = 'none';
    }
  });
  var shelves = document.querySelectorAll('ytd-reel-shelf-renderer, ytd-rich-section-renderer');
  shelves.forEach(function(el) { el.style.display = 'none'; });
};

CT.injectSubsFilter = function() {
  if (document.getElementById('ct-subs-filter')) return;

  var nav = document.querySelector('ytd-feed-filter-chip-bar-renderer, #chips-wrapper, yt-chip-cloud-renderer');
  if (!nav) return;

  var bar = document.createElement('div');
  bar.id = 'ct-subs-filter';

  bar.innerHTML = '<div class="ct-filter-row">'
    + '<button class="ct-filter-btn ct-active" data-period="all">All</button>'
    + '<button class="ct-filter-btn" data-period="7">Last 7 days</button>'
    + '<button class="ct-filter-btn" data-period="14">Last 2 weeks</button>'
    + '<button class="ct-filter-btn" data-period="30">Last month</button>'
    + '<div class="ct-filter-sep"></div>'
    + '<label class="ct-filter-check"><input type="checkbox" id="ct-show-posts" /> Posts</label>'
    + '</div>';

  nav.parentNode.insertBefore(bar, nav.nextSibling);

  bar.querySelectorAll('.ct-filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      bar.querySelectorAll('.ct-filter-btn').forEach(function(b) { b.classList.remove('ct-active'); });
      btn.classList.add('ct-active');
      CT.applySubsFilter(btn.dataset.period);
    });
  });
};

CT.applySubsFilter = function(period) {
  var items = document.querySelectorAll('ytd-rich-item-renderer');
  var now   = Date.now();
  var days  = period === 'all' ? 0 : parseInt(period);

  items.forEach(function(item) {
    var link = item.querySelector('a[href]');
    if (link && link.href && link.href.indexOf('/shorts/') !== -1) {
      item.style.display = 'none';
      return;
    }
    if (days === 0) { item.style.display = ''; return; }
    var timeEl = item.querySelector('ytd-video-meta-block #metadata-line span:last-child, span.ytd-video-meta-block');
    if (!timeEl) { item.style.display = ''; return; }
    var txt  = timeEl.textContent.trim().toLowerCase();
    var pass = CT.timeTextWithinDays(txt, days);
    item.style.display = pass ? '' : 'none';
  });
};

CT.timeTextWithinDays = function(txt, days) {
  var n = parseInt(txt);
  if (isNaN(n)) return true;
  if (txt.indexOf('hour') !== -1 || txt.indexOf('minute') !== -1) return true;
  if (txt.indexOf('day') !== -1)   return n <= days;
  if (txt.indexOf('week') !== -1)  return n * 7 <= days;
  if (txt.indexOf('month') !== -1) return false;
  if (txt.indexOf('year') !== -1)  return false;
  return true;
};

CT.handleWatch = function() {
  setTimeout(function() {
    CT.hideWatchExtras();
    CT.injectVideoControls();
  }, 900);
};

CT.hideWatchExtras = function() {
  var sidebar = document.querySelector('#secondary, #related');
  if (sidebar) sidebar.style.display = 'none';

  var desc = document.querySelector('ytd-video-secondary-info-renderer #description, ytd-expander');
  if (desc) desc.style.display = 'none';

  var comments = document.querySelector('ytd-comments, #comments');
  if (comments) comments.style.display = 'none';

  var shorts = document.querySelectorAll('ytd-reel-shelf-renderer, ytd-rich-section-renderer');
  shorts.forEach(function(el) { el.style.display = 'none'; });
};

CT.injectVideoControls = function() {
  if (document.getElementById('ct-video-controls')) return;

  var below = document.querySelector('ytd-video-primary-info-renderer, #above-the-fold');
  if (!below) return;

  var ctrl = document.createElement('div');
  ctrl.id = 'ct-video-controls';

  ctrl.innerHTML = '<button class="ct-vc-btn" id="ct-toggle-desc" title="Toggle description">'
    + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
    + '</button>'
    + '<button class="ct-vc-btn" id="ct-toggle-comments" title="Toggle comments">'
    + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    + '</button>'
    + '<span class="ct-vc-label">Best option</span>';

  below.parentNode.insertBefore(ctrl, below.nextSibling);

  var descVisible = false;
  var commVisible = false;

  document.getElementById('ct-toggle-desc').addEventListener('click', function() {
    var desc = document.querySelector('ytd-video-secondary-info-renderer #description, ytd-expander');
    if (!desc) return;
    descVisible = !descVisible;
    desc.style.display = descVisible ? '' : 'none';
    this.classList.toggle('ct-vc-active', descVisible);
  });

  document.getElementById('ct-toggle-comments').addEventListener('click', function() {
    var comments = document.querySelector('ytd-comments, #comments');
    if (!comments) return;
    commVisible = !commVisible;
    comments.style.display = commVisible ? '' : 'none';
    this.classList.toggle('ct-vc-active', commVisible);
  });
};

CT.handleChannel = function() {
  var handle = CT.getHandle();
  if (!handle) return;
  if (CT.channelId !== handle) {
    CT.channelId   = handle;
    CT.allVideos   = [];
    CT.injected    = false;
  }
  if (CT.injected) return;
  CT.channelName = document.querySelector('#channel-name, ytd-channel-name yt-formatted-string')?.textContent?.trim() || handle;
  CT.injected    = true;
  CT.loadSettings().then(function() { CT.injectChannelBtns(); });
};

CT.getHandle = function() {
  var m = location.pathname.match(/\/@([^/?]+)/) || location.pathname.match(/\/channel\/([^/?]+)/);
  return m ? m[1] : null;
};

CT.injectChannelBtns = function() {
  document.querySelector('.ct-wrap')?.remove();
  var target = document.querySelector('#subscribe-button, ytd-subscribe-button-renderer');
  if (!target) { setTimeout(function() { CT.injectChannelBtns(); }, 1000); return; }
  var wrap = document.createElement('div');
  wrap.className = 'ct-wrap';
  var b1 = document.createElement('button');
  b1.textContent = '📋 Playlist';
  b1.className   = 'ct-pl-btn';
  b1.addEventListener('click', CT.onPlaylistClick.bind(CT));
  var b2 = document.createElement('button');
  b2.textContent = '⚙️ Settings';
  b2.className   = 'ct-st-btn';
  b2.addEventListener('click', function() { CT.openSettings(false); });
  wrap.appendChild(b1);
  wrap.appendChild(b2);
  target.parentNode.insertBefore(wrap, target);
};

CT.onPlaylistClick = async function() {
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

CT.fetchAll = async function() {
  var key = await CT.getKey();
  var btn = document.querySelector('.ct-pl-btn');
  if (btn) { btn.textContent = '⏳ Loading…'; btn.disabled = true; }
  try {
    var cid = await CT.resolveId(key);
    if (!cid) throw new Error('Could not identify this channel');
    CT.allVideos = await CT.fetchVideos(key, cid);
    if (btn) { btn.textContent = '📋 Playlist (' + CT.allVideos.length + ')'; btn.disabled = false; }
    CT.openModal();
  } catch(e) {
    CT.toast('❌ ' + e.message, 5000);
    if (btn) { btn.textContent = '📋 Playlist'; btn.disabled = false; }
  }
};

CT.resolveId = async function(key) {
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

CT.fetchVideos = async function(key, cid) {
  var chR = await fetch('https://googleapis.com' + cid + '&key=' + key);
  var chD = await chR.json();
  if (chD.error) throw new Error(chD.error.message);
  CT.channelName = (chD.items && chD.items[0] && chD.items[0].snippet.title) || CT.channelName;
  var uploadsId  = chD.items && chD.items[0] && chD.items[0].contentDetails.relatedPlaylists.uploads;
  if (!uploadsId) throw new Error('Could not find the uploads playlist');

  var raw = [], token = '', page = 0;
  do {
    page++;
    CT.toast('⏳ Fetching page ' + page + ' (' + raw.length + ' videos)…');
    var url = 'https://googleapis.com' + uploadsId + '&maxResults=50&pageToken=' + token + '&key=' + key;
    var r = await fetch(url);
    var d = await r.json();
    if (d.error) throw new Error(d.error.message);
    (d.items || []).forEach(function(item) {
      var sn = item.snippet;
      if (sn.title === 'Private video' || sn.title === 'Deleted video') return;
      raw.push({ id: sn.resourceId.videoId, title: sn.title, publishedAt: sn.publishedAt, thumbnail: (sn.thumbnails.medium || sn.thumbnails.default || {}).url || '' });
    });
    token = d.nextPageToken || '';
  } while (token);

  var videos = [];
  for (var i = 0; i < raw.length; i += 50) {
    CT.toast('⏳ Loading details ' + (i+1) + '–' + Math.min(i+50, raw.length) + ' / ' + raw.length + '…');
    var ids = raw.slice(i, i+50).map(function(v) { return v.id; }).join(',');
    var url2 = 'https://googleapis.com' + ids + '&key=' + key;
    var r2 = await fetch(url2);
    var d2 = await r2.json();
    if (d2.error) throw new Error(d2.error.message);
    (d2.items || []).forEach(function(item) {
      var rv = raw.find(function(x) { return x.id === item.id; });
      if (!rv) return;
      var secs    = CT.parseDur(item.contentDetails.duration || 'PT0S');
      var lt      = item.snippet.liveBroadcastContent;
      var noStats = !item.statistics;
      var type    = 'video';
      if (lt === 'live' || lt === 'completed') type = 'live';
      else if (secs > 0 && secs <= 62)         type = 'short';
      else if (noStats)                         type = 'member';
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

CT.applyFilters = function(videos) {
  var members = videos.filter(function(v) { return v.type === 'member'; });
  var regular = videos.filter(function(v) { return v.type !== 'member'; });
  var s = CT.settings;
  if (s.types && s.types.length && s.types.length < 3)
    regular = regular.filter(function(v) { return s.types.indexOf(v.type) !== -1; });
  if (s.years && s.years.length)
    regular = regular.filter(function(v) { return s.years.indexOf(new Date(v.publishedAt).getFullYear()) !== -1; });
  if (s.months && s.months.length)
    regular = regular.filter(function(v) { return s.months.indexOf(new Date(v.publishedAt).getMonth() + 1) !== -1; });
  if (s.keywords && s.keywords.trim()) {
    var kws = s.keywords.toLowerCase().split(/[\s,]+/).filter(Boolean);
    regular = regular.filter(function(v) { return kws.some(function(k) { return v.title.toLowerCase().indexOf(k) !== -1; }); });
  }
  if (s.excludeWords && s.excludeWords.trim()) {
    var exs = s.excludeWords.toLowerCase().split(/[\s,]+/).filter(Boolean);
    regular = regular.filter(function(v) { return !exs.some(function(k) { return v.title.toLowerCase().indexOf(k) !== -1; }); });
  }
  if (+s.minDuration > 0) regular = regular.filter(function(v) { return v.duration >= +s.minDuration * 60; });
  if (+s.maxDuration > 0) regular = regular.filter(function(v) { return v.duration <= +s.maxDuration * 60; });
  regular.sort(function(a, b) {
    var da = new Date(a.publishedAt), db = new Date(b.publishedAt);
    return s.order === 'oldest' ? da - db : db - da;
  });
  return { regular: regular, members: members };
};

CT.openModal = function() {
  CT.closeModal('ct-pl-modal');
  var res     = CT.applyFilters(CT.allVideos);
  CT.filtered = res.regular;
  var stats   = CT.calcStats(res.regular);

  var modal = document.createElement('div');
  modal.id  = 'ct-pl-modal';
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
    + res.regular.map(function(v, i) { return CT.videoRow(v, i); }).join('')
    + (res.members.length ? CT.membersSection(res.members) : '')
    + '</div>'
    + '<div class="ct-actions">'
    + '<button class="ct-primary-btn" id="ct-make-pl">📋 Create Playlist</button>'
    + '<button class="ct-sec-btn" id="ct-export-btn">📥 Export CSV</button>'
    + '</div>'
    + (CT.history.length ? CT.historyHTML() : '')
    + '</div></div>';

  document.body.appendChild(modal);

  CT.el('ct-close-pl').onclick = function() { modal.remove(); };
  CT.el('ct-srch-toggle').onclick = function() {
    var bar = CT.el('ct-srch-bar');
    bar.classList.toggle('ct-hidden');
    if (!bar.classList.contains('ct-hidden')) CT.el('ct-srch-inp').focus();
  };
  CT.el('ct-srch-inp').addEventListener('input', function() {
    var q = this.value.toLowerCase();
    document.querySelectorAll('.ct-vrow').forEach(function(row) {
      var t = (row.querySelector('.ct-vtitle') || {}).textContent || '';
      row.style.display = t.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
    });
    CT.updateCount();
  });
  CT.el('ct-sel-all').onclick   = function() { CT.setChecks(true);  CT.updateCount(); };
  CT.el('ct-desel-all').onclick = function() { CT.setChecks(false); CT.updateCount(); };
  modal.addEventListener('change', function(e) { if (e.target.classList.contains('ct-chk')) CT.updateCount(); });
  CT.el('ct-make-pl').onclick    = function() { CT.createPlaylist(); };
  CT.el('ct-export-btn').onclick = function() { CT.exportCsv(); };
};



CT.videoRow = function(v, i) {
  var icon  = v.type === 'live' ? '🔴' : v.type === 'short' ? '📱' : '▶️';
  var date  = new Date(v.publishedAt).toLocaleDateString('en-GB');
  var views = CT.fmtNum(v.views);
  return '<div class="ct-vrow" data-id="' + v.id + '">'
    + '<input type="checkbox" class="ct-chk" checked data-idx="' + i + '" />'
    + '<img class="ct-thumb" src="' + v.thumbnail + '" loading="lazy" />'
    + '<div class="ct-vinfo">'
    + '<div class="ct-vtitle">' + CT.esc(v.title) + '</div>'
    + '<div class="ct-vmeta">' + icon + ' ' + date + ' · ' + v.durationStr + ' · ' + views + ' views</div>'
    + '</div></div>';
};

CT.membersSection = function(members) {
  return '<div class="ct-members-sec">'
    + '<div class="ct-members-title">👑 Members-only (' + members.length + ') — count only</div>'
    + members.map(function(v) {
      return '<div class="ct-vrow ct-mrow">'
        + '<span class="ct-mlock">🔒</span>'
        + '<img class="ct-thumb" src="' + v.thumbnail + '" loading="lazy" />'
        + '<div class="ct-vinfo"><div class="ct-vtitle">' + CT.esc(v.title) + '</div>'
        + '<div class="ct-vmeta ct-mtag">👑 Members only</div></div></div>';
    }).join('')
    + '</div>';
};

CT.historyHTML = function() {
  return '<div class="ct-hist"><div class="ct-hist-title">📂 Previous Playlists</div>'
    + CT.history.map(function(h) {
      return '<div class="ct-hist-row">'
        + '<a href="' + h.url + '" target="_blank">' + CT.esc(h.name) + '</a>'
        + '<span class="ct-badge">' + h.count + '</span>'
        + '<span class="ct-hist-date">' + h.date + '</span>'
        + '</div>';
    }).join('') + '</div>';
};

CT.createPlaylist = function() {
  var chosen = CT.getChecked();
  if (!chosen.length) { CT.toast('❌ No videos selected'); return; }
  var name = (CT.el('ct-pl-name') || {}).value || CT.channelName + ' — Timeline';
  var ids  = chosen.map(function(v) { return v.id; });
  var url  = 'https://youtube.com' + ids.join(',') + '&title=' + encodeURIComponent(name.trim());
  CT.showResult(url, name.trim(), ids.length);
  CT.pushHistory({ name: name.trim(), url: url, count: ids.length, date: new Date().toLocaleDateString('en-GB'), channelId: CT.channelId });
};

CT.showResult = function(url, name, count) {
  CT.closeModal('ct-res-modal');
  var modal = document.createElement('div');
  modal.id  = 'ct-res-modal';
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
  CT.el('ct-close-res').onclick = function() { modal.remove(); };
  CT.el('ct-copy-res').onclick  = function() {
    navigator.clipboard.writeText(url);
    CT.el('ct-copy-res').textContent = '✅';
    setTimeout(function() { CT.el('ct-copy-res').textContent = '📋'; }, 2000);
  };
};

