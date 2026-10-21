/* Trang chủ khách — bám ảnh docs/reference/03-trang-chu-1.jpg (task 4.1). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var PASTE_KEY = 'ttv_draft_dropoff';
  var carouselTimer = null;
  var carouselEl = null;
  var exploreEl = null;
  var stopUnread = null;

  function t(key) { return TTV.I18n ? TTV.I18n.t(key) : key; }
  function esc(v) { return TTV.Components.escape(v); }

  function greetingKey() {
    var h = new Date().getHours();
    if (h >= 5 && h < 11) return 'home.greet.morning';
    if (h >= 11 && h < 14) return 'home.greet.noon';
    if (h >= 14 && h < 18) return 'home.greet.afternoon';
    return 'home.greet.evening';
  }

  function serviceIcon(code) {
    var photos = {
      moving: 'uploads/img-giaodien/chuyennha.png',
      warehouse: 'uploads/img-giaodien/bocxepkho1.png',
      furniture: 'uploads/img-giaodien/noithat.png',
      office: 'uploads/img-giaodien/vanphong.png',
      construction: 'uploads/img-giaodien/congtrinh.png',
      hourly: 'uploads/img-giaodien/theogio.png',
      goods: 'uploads/img-giaodien/bocvachanghoa.png'
    };
    var src = photos[code] || photos.goods;
    return '<img class="home-service__img" src="' + esc(src) + '" alt="">';
  }

  function pinIcon() {
    return '<span class="home-booking__icon home-booking__icon--pin" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="#fff" d="M12 3.2c-3.4 0-6.1 2.6-6.1 5.9 0 4.4 6.1 11.7 6.1 11.7s6.1-7.3 6.1-11.7c0-3.3-2.7-5.9-6.1-5.9zm0 8a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2z"/></svg></span>';
  }
  function dropIcon() {
    return '<span class="home-booking__icon home-booking__icon--drop" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" d="M12 5v11"/><path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m7.5 12.5 4.5 4.5 4.5-4.5"/></svg></span>';
  }
  var HERO_IMG = 'uploads/img-giaodien/header.png';

  var EXPLORE_IMG = 'uploads/img-giaodien/item1.png';
  var BANNER_IMG = {
    member: 'uploads/img-giaodien/uudaihoivien.png',
    promo: 'uploads/img-giaodien/chuyennhabaner.png',
    explore: 'uploads/img-giaodien/bocxepkhochuyennghiep.png'
  };

  function bannerImage(banner) {
    return banner.image_path || BANNER_IMG[banner.type] || BANNER_IMG.promo;
  }

  function bannerSlide(banner) {
    var type = banner.type || 'promo';
    var title = banner.title || '';
    var target = banner.target === 'coupon' || type === 'promo' || type === 'member' ? '/coupons' : '';
    var clickable = target ? ' data-route="' + esc(target) + '"' : '';
    return '<article class="home-banner" role="group" aria-label="' + esc(title) + '"' + clickable + '>' +
      '<img src="' + esc(bannerImage(banner)) + '" alt="' + esc(title) + '">' +
      '</article>';
  }

  function goCreate(query) {
    var q = query || {};
    var parts = Object.keys(q).filter(function (k) { return q[k]; }).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]);
    });
    TTV.Router.navigate('/create/order' + (parts.length ? '?' + parts.join('&') : ''));
  }

  function pasteDropoff() {
    var apply = function (text) {
      text = String(text || '').trim();
      if (!text) {
        TTV.Components.toast(t('home.paste.denied'), 'danger');
        goCreate({ paste: '1' });
        return;
      }
      try { sessionStorage.setItem(PASTE_KEY, text); } catch (_) {}
      goCreate({ paste: '1' });
    };
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(apply).catch(function () { apply(''); });
      return;
    }
    apply('');
  }

  function bindCarousel(root) {
    carouselEl = root.querySelector('[data-home-carousel]');
    if (!carouselEl) return;
    var dots = root.querySelectorAll('[data-banner-dot]');
    var slides = carouselEl.querySelectorAll('.home-banner');
    if (!slides.length) return;
    function syncDots() {
      var i = Math.round(carouselEl.scrollLeft / Math.max(carouselEl.clientWidth, 1));
      i = Math.max(0, Math.min(slides.length - 1, i));
      dots.forEach(function (dot, idx) { dot.classList.toggle('is-active', idx === i); });
      return i;
    }
    carouselEl.addEventListener('scroll', syncDots, { passive: true });
    dots.forEach(function (dot, idx) {
      dot.addEventListener('click', function () {
        carouselEl.scrollTo({ left: idx * carouselEl.clientWidth, behavior: 'smooth' });
      });
    });
    if (slides.length > 1) {
      carouselTimer = setInterval(function () {
        if (!carouselEl) return;
        var i = syncDots();
        var next = (i + 1) % slides.length;
        carouselEl.scrollTo({ left: next * carouselEl.clientWidth, behavior: 'smooth' });
      }, 4500);
    }
    syncDots();
  }

  function bindExploreDrag(root) {
    exploreEl = root.querySelector('[data-home-explore]');
    if (!exploreEl) return;
    var dragging = false, startX = 0, startLeft = 0;
    function onDown(e) {
      dragging = true;
      startX = e.clientX;
      startLeft = exploreEl.scrollLeft;
      exploreEl.classList.add('is-dragging');
      if (exploreEl.setPointerCapture && e.pointerId != null) exploreEl.setPointerCapture(e.pointerId);
    }
    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      exploreEl.scrollLeft = startLeft - (e.clientX - startX);
    }
    function onUp() {
      dragging = false;
      exploreEl.classList.remove('is-dragging');
    }
    exploreEl.addEventListener('pointerdown', onDown);
    exploreEl.addEventListener('pointermove', onMove);
    exploreEl.addEventListener('pointerup', onUp);
    exploreEl.addEventListener('pointercancel', onUp);
    exploreEl._off = function () {
      exploreEl.removeEventListener('pointerdown', onDown);
      exploreEl.removeEventListener('pointermove', onMove);
      exploreEl.removeEventListener('pointerup', onUp);
      exploreEl.removeEventListener('pointercancel', onUp);
    };
  }

  function markup(data) {
    var unread = Math.max(0, Math.round(Number(data.unread) || 0));
    var services = data.services || [];
    var banners = data.banners || [];
    var zalo = data.zalo || 'https://zalo.me';
    return '<div class="home">' +
      '<header class="home-hero" style="background-image:url(\'' + HERO_IMG + '\')">' +
        '<div class="home-hero__bar">' +
          '<h1>' + esc(t(greetingKey())) + '</h1>' +
          '<button class="home-hero__bell" data-route="/notifications" aria-label="' + esc(t('home.notifications') + (unread ? ' (' + unread + ')' : '')) + '">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M12 3.6a5.4 5.4 0 0 0-5.4 5.4v2.3c0 .9-.4 1.8-1.1 2.4l-.7.6c-.5.4-.2 1.3.5 1.3h13.4c.7 0 1-.9.5-1.3l-.7-.6a3.3 3.3 0 0 1-1.1-2.4V9A5.4 5.4 0 0 0 12 3.6zm0 16.2a2.4 2.4 0 0 0 2.3-1.8H9.7A2.4 2.4 0 0 0 12 19.8z"/></svg>' +
            TTV.Utils.unreadBadge(unread) +
          '</button>' +
        '</div>' +
      '</header>' +
      '<section class="home-booking">' +
        '<button type="button" class="home-booking__row" data-action="home-pickup">' +
          pinIcon() +
          '<span class="home-booking__text"><small>' + esc(t('home.pickup.label')) + '</small><strong>' + esc(t('home.pickup.placeholder')) + '</strong></span>' +
          '<span class="home-booking__chevron" aria-hidden="true">›</span>' +
        '</button>' +
        '<div class="home-booking__divider"></div>' +
        '<div class="home-booking__row home-booking__row--drop">' +
          '<button type="button" class="home-booking__drop" data-action="home-dropoff">' +
            dropIcon() + '<span>' + esc(t('home.dropoff.label')) + '</span>' +
          '</button>' +
          '<button type="button" class="home-booking__paste" data-action="home-paste">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="7" width="10" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M6 16V6.5A1.5 1.5 0 0 1 7.5 5H16"/><rect x="11" y="4" width="4" height="2.4" rx=".6" fill="currentColor"/></svg>' +
            esc(t('home.paste')) +
          '</button>' +
        '</div>' +
      '</section>' +
      '<nav class="home-services" aria-label="' + esc(t('home.services')) + '">' +
        services.map(function (sv) {
          return '<button type="button" class="home-service" data-action="home-service" data-service="' + esc(sv.code || sv.id) + '">' +
            serviceIcon(sv.code || sv.id) + '<span>' + esc(sv.name) + '</span></button>';
        }).join('') +
      '</nav>' +
      '<section class="home-carousel-wrap">' +
        '<div class="home-carousel" data-home-carousel>' + banners.map(bannerSlide).join('') + '</div>' +
        (banners.length > 1 ? '<div class="home-dots">' + banners.map(function (_, i) {
          return '<button type="button" class="home-dots__item' + (i === 0 ? ' is-active' : '') + '" data-banner-dot="' + i + '" aria-label="Banner ' + (i + 1) + '"></button>';
        }).join('') + '</div>' : '') +
      '</section>' +
      '<section class="home-explore">' +
        '<h2>' + esc(t('home.explore')) + '</h2>' +
        '<div class="home-explore__scroller" data-home-explore>' +
          [0, 1, 2].map(function () {
            return '<article class="home-explore-card"><img src="' + EXPLORE_IMG + '" alt=""></article>';
          }).join('') +
        '</div>' +
      '</section>' +
      '<a class="zalo-fab" href="' + esc(zalo) + '" target="_blank" rel="noopener noreferrer" aria-label="Zalo">Zalo</a>' +
      TTV.Components.bottomTab('home') +
    '</div>';
  }

  function onClick(e) {
    var paste = e.target.closest('[data-action="home-paste"]');
    if (paste) { e.preventDefault(); e.stopPropagation(); pasteDropoff(); return; }
    var pickup = e.target.closest('[data-action="home-pickup"]');
    if (pickup) { goCreate({}); return; }
    var drop = e.target.closest('[data-action="home-dropoff"]');
    if (drop) { goCreate({}); return; }
    var service = e.target.closest('[data-action="home-service"]');
    if (service) { goCreate({ service: service.getAttribute('data-service') }); }
  }

  TTV.screens.home = {
    pasteKey: PASTE_KEY,
    render: function (container) {
      TTV.screens.home.destroy();
      container.classList.remove('is-wide');
      container.innerHTML = TTV.Components.loading(t('common.loading'));
      Promise.all([
        TTV.api.listServices(),
        TTV.api.listBanners(),
        TTV.api.getSetting('zalo_url')
      ]).then(function (parts) {
        container.innerHTML = markup({
          services: parts[0] || [],
          banners: parts[1] || [],
          zalo: parts[2] || 'https://zalo.me',
          unread: TTV.NotiLive ? TTV.NotiLive.unread() : 0
        });
        bindCarousel(container);
        bindExploreDrag(container);
        container.addEventListener('click', onClick);
        container._homeClick = onClick;
        if (stopUnread) stopUnread();
        stopUnread = TTV.Utils.watchUnread(container);
      }).catch(function (err) {
        container.innerHTML = TTV.Components.emptyState('Không tải được trang chủ', err.message || t('common.error'));
      });
    },
    destroy: function () {
      if (stopUnread) { stopUnread(); stopUnread = null; }
      if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }
      carouselEl = null;
      if (exploreEl && exploreEl._off) exploreEl._off();
      exploreEl = null;
      var app = document.getElementById('app');
      if (app && app._homeClick) {
        app.removeEventListener('click', app._homeClick);
        app._homeClick = null;
      }
    }
  };
})(window.TTV);
