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

