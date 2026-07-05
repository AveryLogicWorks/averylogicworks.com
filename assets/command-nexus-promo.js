(function () {
  'use strict';

  var NORMAL_PLANS = {
    proAlpha: { type: 'sub', amount: '10', period: 'M', item: 'Command Nexus Pro Alpha' },
    businessAlpha: { type: 'sub', amount: '30', period: 'M', item: 'Command Nexus Business Alpha' },
    unlimitedAlpha: { type: 'sub', amount: '50', period: 'M', item: 'Command Nexus Unlimited Alpha' },
    trialBeta: { type: 'one', amount: '5', item: 'Command Nexus Beta Trial' },
    proBeta: { type: 'sub', amount: '20', period: 'M', item: 'Command Nexus Pro Beta' },
    businessBeta: { type: 'sub', amount: '40', period: 'M', item: 'Command Nexus Business Beta' },
    unlimitedBeta: { type: 'sub', amount: '60', period: 'M', item: 'Command Nexus Unlimited Beta' },
    trialFull: { type: 'one', amount: '10', item: 'Command Nexus 15-Day Trial' },
    proMonthly: { type: 'sub', amount: '30', period: 'M', item: 'Command Nexus Pro Monthly' },
    proYearly: { type: 'sub', amount: '324', period: 'Y', item: 'Command Nexus Pro Yearly' },
    businessMonthly: { type: 'sub', amount: '50', period: 'M', item: 'Command Nexus Business Monthly' },
    businessYearly: { type: 'sub', amount: '552', period: 'Y', item: 'Command Nexus Business Yearly' },
    unlimitedMonthly: { type: 'sub', amount: '80', period: 'M', item: 'Command Nexus Unlimited Monthly' },
    unlimitedYearly: { type: 'sub', amount: '900', period: 'Y', item: 'Command Nexus Unlimited Yearly' }
  };

  function normalUrlFromPromoUrl(promoHref, key) {
    var plan = NORMAL_PLANS[key];
    if (!plan) return promoHref;
    try {
      var url = new URL(promoHref, window.location.href);
      if (plan.type === 'one') {
        url.searchParams.set('cmd', '_xclick');
        url.searchParams.set('amount', plan.amount);
        url.searchParams.delete('a1');
        url.searchParams.delete('p1');
        url.searchParams.delete('t1');
        url.searchParams.delete('a3');
        url.searchParams.delete('p3');
        url.searchParams.delete('t3');
      } else {
        url.searchParams.set('cmd', '_xclick-subscriptions');
        url.searchParams.delete('amount');
        url.searchParams.delete('a1');
        url.searchParams.delete('p1');
        url.searchParams.delete('t1');
        url.searchParams.set('a3', plan.amount);
        url.searchParams.set('p3', '1');
        url.searchParams.set('t3', plan.period);
      }
      url.searchParams.set('item_name', plan.item);
      url.searchParams.set('currency_code', 'USD');
      return url.toString();
    } catch (e) {
      return promoHref;
    }
  }

  function addPromoBox(link) {
    if (!link || link.getAttribute('data-cn-promo-switch-ready') === '1') return;

    var key = link.getAttribute('data-cn-link');
    var promoHref = link.href;
    var normalHref = normalUrlFromPromoUrl(promoHref, key);

    link.href = normalHref;
    link.setAttribute('data-normal-href', normalHref);
    link.setAttribute('data-promo-href', promoHref);
    link.setAttribute('data-cn-promo-switch-ready', '1');

    var existingBox = link.previousElementSibling;
    var box;
    if (existingBox && existingBox.querySelector && existingBox.querySelector('input') && /Promo code/i.test(existingBox.textContent || '')) {
      box = existingBox;
    } else {
      box = document.createElement('div');
      box.style.cssText = 'margin:.75rem 0 1rem;padding:1rem;border:1px solid rgba(125,211,252,.28);border-radius:16px;background:rgba(125,211,252,.08);display:grid;gap:.65rem;';
      box.innerHTML = '<label style="font-weight:800;display:block;">Promo code</label><div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;"><input type="text" placeholder="Enter promo code" autocomplete="off" style="flex:1;min-width:160px;padding:.78rem 1rem;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.18);color:inherit;font:inherit;text-transform:uppercase;"><button type="button" class="button">Apply code</button></div><p class="soft" style="margin:0;font-size:.86rem;">New customers can use BACK25 for 25% off one purchase of any one product.</p><p data-msg style="margin:0;font-size:.88rem;font-weight:800;"></p>';
      link.parentNode.insertBefore(box, link);
    }

    var input = box.querySelector('input');
    var button = box.querySelector('button');
    var msg = box.querySelector('[data-msg]') || box.querySelector('p:last-child');
    if (!input || !button || !msg) return;

    button.addEventListener('click', function () {
      var code = String(input.value || '').trim().toUpperCase();
      input.value = code;
      if (code === 'BACK25') {
        link.href = link.getAttribute('data-promo-href');
        link.setAttribute('data-promo-applied', 'BACK25');
        msg.textContent = 'BACK25 applied: 25% off for new customers.';
        msg.style.color = 'var(--accent)';
      } else {
        link.href = link.getAttribute('data-normal-href');
        link.removeAttribute('data-promo-applied');
        msg.textContent = code ? 'That promo code is not valid.' : 'Enter BACK25 to apply the new-customer discount.';
        msg.style.color = '#facc15';
      }
    });

    input.addEventListener('input', function () {
      input.value = input.value.toUpperCase();
      if (link.getAttribute('data-promo-applied') && input.value.trim().toUpperCase() !== 'BACK25') {
        link.href = link.getAttribute('data-normal-href');
        link.removeAttribute('data-promo-applied');
        msg.textContent = '';
      }
    });
  }

  function init() {
    document.querySelectorAll('[data-cn-link]').forEach(addPromoBox);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.setTimeout(init, 600);
})();