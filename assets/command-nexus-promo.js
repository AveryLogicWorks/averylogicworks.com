(function () {
  'use strict';

  var cfg = window.AVERY_CONFIG || {};
  var promo = cfg.promo || {};

  function promoIsActive() {
    if (!promo.enabled || !promo.code) return false;
    if (!promo.expiresOn) return true;
    var end = new Date(String(promo.expiresOn) + 'T23:59:59');
    return Number.isFinite(end.getTime()) && Date.now() <= end.getTime();
  }

  function init() {
    if (!promoIsActive()) return;
    var code = String(promo.code || '').toUpperCase();
    var percent = Number(promo.percentOff || 0);
    if (!code || percent <= 0 || percent >= 100) return;

    document.querySelectorAll('[data-cn-link]').forEach(function (link) {
      if (!link || link.getAttribute('data-cn-promo-ready') === '1') return;
      var normalHref = link.href;
      if (!normalHref || normalHref === '#') return;
      link.setAttribute('data-cn-promo-ready', '1');

      var box = document.createElement('div');
      box.className = 'promo-box';
      box.style.cssText = 'margin:.75rem 0 1rem;padding:1rem;border:1px solid rgba(125,211,252,.22);border-radius:12px;background:rgba(125,211,252,.05);display:grid;gap:.65rem;';
      box.innerHTML = '<label style="font-weight:800;display:block;">Promo code</label>'
        + '<div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">'
        + '<input type="text" placeholder="Enter promo code" autocomplete="off" style="flex:1;min-width:160px;padding:.72rem .9rem;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.14);color:inherit;font:inherit;text-transform:uppercase;">'
        + '<button type="button" class="button">Apply code</button></div>'
        + '<p class="soft" style="margin:0;font-size:.82rem;">' + (promo.label || (percent + '% promotional discount')) + '</p>'
        + '<p data-msg style="margin:0;font-size:.86rem;font-weight:800;"></p>';
      link.parentNode.insertBefore(box, link);

      var input = box.querySelector('input');
      var button = box.querySelector('button');
      var msg = box.querySelector('[data-msg]');
      if (!input || !button || !msg) return;

      button.addEventListener('click', function () {
        var entered = String(input.value || '').trim().toUpperCase();
        input.value = entered;
        if (entered === code) {
          msg.textContent = 'Promotion recognized. The checkout link must display the promotional amount before you pay.';
          msg.style.color = 'var(--accent)';
        } else {
          msg.textContent = entered ? 'That promo code is not valid.' : 'Enter a promo code first.';
          msg.style.color = '#facc15';
        }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
