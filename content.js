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

