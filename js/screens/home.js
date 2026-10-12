/* Trang chủ khách — bám ảnh docs/reference/03-trang-chu-1.jpg (task 4.1). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var PASTE_KEY = 'ttv_draft_dropoff';
  var carouselTimer = null;
  var carouselEl = null;

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
    var icons = {
      moving: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><path fill="#1b7be4" d="M14 28.5V20l10-7 10 7v8.5h-4.2V24h-11.6v4.5z"/><path fill="#3d9cf0" d="M18.4 26.2h4.1v5.4h-4.1zm7.1 0h4.1v5.4h-4.1z"/><rect x="16.6" y="31.2" width="14.8" height="3.2" rx="1" fill="#f4b942"/></svg>',
      warehouse: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><path fill="#1b7be4" d="M12 29.5 24 18.2 36 29.5H12z"/><rect x="16" y="27" width="6.2" height="6.2" rx="1" fill="#f4b942"/><rect x="25.8" y="27" width="6.2" height="6.2" rx="1" fill="#f4b942"/><rect x="20.8" y="22.2" width="6.4" height="5.4" rx="1" fill="#e89a2d"/></svg>',
      furniture: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><path fill="#1b7be4" d="M13 24c0-5 4.8-8.2 11-8.2S35 19 35 24v3.4H13V24z"/><rect x="12" y="26.8" width="24" height="5.2" rx="2" fill="#3d9cf0"/><rect x="15" y="32" width="2.4" height="3.6" rx=".8" fill="#1b7be4"/><rect x="30.6" y="32" width="2.4" height="3.6" rx=".8" fill="#1b7be4"/></svg>',
      office: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><path fill="#1b7be4" d="M17 33V18.5h14V33H17z"/><path fill="#fff" d="M20 21.2h3v2.4h-3zm5 0h3v2.4h-3zM20 25.2h3v2.4h-3zm5 0h3v2.4h-3z"/><rect x="21.6" y="29.2" width="4.8" height="3.8" fill="#d9ecff"/><rect x="14" y="30.6" width="5.4" height="3.2" rx=".8" fill="#f4b942"/></svg>',
      construction: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><rect x="14" y="26.5" width="20" height="8" rx="1.4" fill="#1b7be4"/><rect x="16.2" y="22.2" width="6.2" height="5" rx="1" fill="#f4b942"/><rect x="25.6" y="20.4" width="6.2" height="6.8" rx="1" fill="#e89a2d"/><path fill="#3d9cf0" d="M18 26.5h12l-1.4-3.4H19.4z"/></svg>',
      hourly: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><circle cx="24" cy="23" r="9.2" fill="none" stroke="#1b7be4" stroke-width="2.4"/><path stroke="#1b7be4" stroke-width="2.2" stroke-linecap="round" d="M24 17.6v6.1l4 2.4"/><rect x="20.4" y="31.4" width="7.2" height="3.6" rx=".8" fill="#f4b942"/></svg>',
      goods: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><circle cx="20.2" cy="18.4" r="3.1" fill="#1b7be4"/><path fill="#1b7be4" d="M17.4 22.2c.4 4.4 2.6 7.2 7.4 7.2h5.2l2.4 5.2h-3.1l-1.5-3.2H22c-5.6 0-8.8-3.6-9.4-9.2z"/><rect x="26.2" y="20.6" width="8.4" height="6.4" rx="1" fill="#f4b942"/><circle cx="17.6" cy="33.4" r="2.1" fill="#3d9cf0"/><circle cx="32.6" cy="33.4" r="2.1" fill="#3d9cf0"/></svg>'
    };
    return icons[code] || icons.goods;
  }

  function pinIcon() {
    return '<span class="home-booking__icon home-booking__icon--pin" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="#fff" d="M12 3.2c-3.4 0-6.1 2.6-6.1 5.9 0 4.4 6.1 11.7 6.1 11.7s6.1-7.3 6.1-11.7c0-3.3-2.7-5.9-6.1-5.9zm0 8a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2z"/></svg></span>';
  }
  function dropIcon() {
    return '<span class="home-booking__icon home-booking__icon--drop" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" d="M12 5v11"/><path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m7.5 12.5 4.5 4.5 4.5-4.5"/></svg></span>';
  }
  function skyline() {
    return '<svg class="home-hero__skyline" viewBox="0 0 220 120" aria-hidden="true"><g fill="#fff" opacity=".22"><rect x="118" y="48" width="18" height="72" rx="1"/><rect x="140" y="28" width="28" height="92" rx="1"/><rect x="172" y="40" width="22" height="80" rx="1"/><path d="M88 78h26v42H88z"/><path d="M148 18l14-12 14 12v10h-28z"/></g><g fill="#b9e4ff" opacity=".55"><rect x="146" y="40" width="4" height="6"/><rect x="154" y="40" width="4" height="6"/><rect x="146" y="50" width="4" height="6"/><rect x="154" y="50" width="4" height="6"/></g></svg>';
  }

  function defaultExplore() {
    return [
      { title: t('home.explore.card1'), tone: 'green' },
      { title: t('home.explore.card2'), tone: 'blue' }
    ];
  }

  function bannerSlide(banner) {
    var type = banner.type || 'promo';
    var title = banner.title || (type === 'member' ? t('home.banner.member') : t('home.banner.promo'));
    var sub = banner.subtitle || (type === 'member' ? t('home.banner.memberSub') : '');
    var target = banner.target === 'coupon' || type === 'promo' || type === 'member' ? '/coupons' : '';
    var img = banner.image_path
      ? '<img src="' + esc(banner.image_path) + '" alt="">'
      : '<div class="home-banner__art" aria-hidden="true"><span class="home-banner__gift">%</span></div>';
    var clickable = target ? ' data-route="' + esc(target) + '"' : '';
    return '<article class="home-banner home-banner--' + esc(type) + '" role="group" aria-label="' + esc(title) + '"' + clickable + '>' +
      '<div class="home-banner__copy"><h3>' + esc(title) + '</h3>' +
      (sub ? '<p>' + esc(sub) + '</p>' : '') +
      (type === 'member' ? '<span class="home-banner__cta">' + esc(t('home.banner.cta')) + '</span>' : '') +
      '</div>' + img + '</article>';
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

  function markup(data) {
    var unread = data.unread > 0;
    var services = data.services || [];
    var banners = data.banners || [];
    var zalo = data.zalo || 'https://zalo.me';
    return '<div class="home">' +
      '<header class="home-hero">' +
        '<div class="home-hero__bar">' +
          '<h1>' + esc(t(greetingKey())) + '</h1>' +
          '<button class="home-hero__bell" data-route="/notifications" aria-label="' + esc(t('home.notifications')) + '">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M12 3.6a5.4 5.4 0 0 0-5.4 5.4v2.3c0 .9-.4 1.8-1.1 2.4l-.7.6c-.5.4-.2 1.3.5 1.3h13.4c.7 0 1-.9.5-1.3l-.7-.6a3.3 3.3 0 0 1-1.1-2.4V9A5.4 5.4 0 0 0 12 3.6zm0 16.2a2.4 2.4 0 0 0 2.3-1.8H9.7A2.4 2.4 0 0 0 12 19.8z"/></svg>' +
            (unread ? '<span class="home-hero__dot"></span>' : '') +
          '</button>' +
        '</div>' + skyline() +
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
        '<div class="home-explore__scroller">' + defaultExplore().map(function (card) {
          return '<article class="home-explore-card home-explore-card--' + esc(card.tone) + '"><p>' + esc(card.title) + '</p></article>';
        }).join('') + '</div>' +
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
        TTV.api.getSetting('zalo_url'),
        TTV.api.unreadNotificationCount()
      ]).then(function (parts) {
        container.innerHTML = markup({
          services: parts[0] || [],
          banners: parts[1] || [],
          zalo: parts[2] || 'https://zalo.me',
          unread: parts[3] || 0
        });
        bindCarousel(container);
        container.addEventListener('click', onClick);
        container._homeClick = onClick;
      }).catch(function (err) {
        container.innerHTML = TTV.Components.emptyState('Không tải được trang chủ', err.message || t('common.error'));
      });
    },
    destroy: function () {
      if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }
      carouselEl = null;
      var app = document.getElementById('app');
      if (app && app._homeClick) {
        app.removeEventListener('click', app._homeClick);
        app._homeClick = null;
      }
    }
  };
})(window.TTV);
