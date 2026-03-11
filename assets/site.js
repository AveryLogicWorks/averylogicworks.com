(function () {
  const cfg = window.AVERY_CONFIG || {};
  const stripe = (cfg.stripeLinks || {});
  const founderImages = (cfg.founderImages || {});
  const fallbacks = {
    main: 'assets/founder-main-placeholder.svg',
    avatar: 'assets/founder-avatar-placeholder.svg'
  };

  document.querySelectorAll('[data-current-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  document.querySelectorAll('[data-founder-name]').forEach((el) => {
    if (cfg.founderName) el.textContent = cfg.founderName;
  });

  function applyImage(selector, src, fallback) {
    document.querySelectorAll(selector).forEach((img) => {
      img.src = src || fallback;
      img.onerror = () => { img.src = fallback; };
    });
  }

  applyImage('[data-founder-main]', founderImages.main || fallbacks.main, fallbacks.main);
  applyImage('[data-founder-avatar]', founderImages.avatar || founderImages.main || fallbacks.avatar, fallbacks.avatar);

  const emailTargets = {
    '[data-support-email-text]': cfg.supportEmail,
    '[data-billing-email-text]': cfg.billingEmail
  };
  Object.entries(emailTargets).forEach(([selector, value]) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (value) el.textContent = value;
    });
  });
  document.querySelectorAll('[data-support-email-link]').forEach((el) => {
    if (cfg.supportEmail) el.href = 'mailto:' + cfg.supportEmail;
  });
  document.querySelectorAll('[data-billing-email-link]').forEach((el) => {
    if (cfg.billingEmail) el.href = 'mailto:' + cfg.billingEmail;
  });

  const stripeTargets = {
    '[data-stripe-one-time]': stripe.oneTime,
    '[data-stripe-monthly]': stripe.monthly,
    '[data-stripe-shop]': stripe.shop,
    '[data-stripe-portal]': stripe.portal
  };
  Object.entries(stripeTargets).forEach(([selector, url]) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (url && url !== '#') {
        el.href = url;
        if (el.dataset.pendingText) el.textContent = el.dataset.pendingText;
      } else {
        el.href = '#';
        el.setAttribute('aria-disabled', 'true');
        const pendingText = el.getAttribute('data-pending-text');
        if (pendingText) el.textContent = pendingText;
      }
    });
  });

  function setMessage(box, text) {
    if (!box) return;
    box.textContent = text;
    box.classList.add('show');
  }

  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const data = {
        displayName: signupForm.querySelector('[name="displayName"]').value.trim(),
        email: signupForm.querySelector('[name="email"]').value.trim(),
        newsletter: signupForm.querySelector('[name="newsletter"]').checked,
        supporterUpdates: signupForm.querySelector('[name="supporterUpdates"]').checked,
        acceptedTerms: signupForm.querySelector('[name="acceptedTerms"]').checked,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('avery-signup-preview', JSON.stringify(data));
      localStorage.setItem('avery-account-settings', JSON.stringify({
        newsletter: data.newsletter,
        supporterUpdates: data.supporterUpdates,
        accountLocked: false
      }));
      setMessage(document.getElementById('signup-message'), 'Saved as a front-end preview on this device. For a live website, connect this form to your email/list service or auth backend.');
      signupForm.reset();
    });
  }

  const accountForm = document.getElementById('account-form');
  if (accountForm) {
    const stored = JSON.parse(localStorage.getItem('avery-account-settings') || '{}');
    const newsletter = accountForm.querySelector('[name="newsletter"]');
    const supporterUpdates = accountForm.querySelector('[name="supporterUpdates"]');
    const accountLocked = accountForm.querySelector('[name="accountLocked"]');
    if (newsletter) newsletter.checked = !!stored.newsletter;
    if (supporterUpdates) supporterUpdates.checked = !!stored.supporterUpdates;
    if (accountLocked) accountLocked.checked = !!stored.accountLocked;

    accountForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const next = {
        newsletter: newsletter ? newsletter.checked : false,
        supporterUpdates: supporterUpdates ? supporterUpdates.checked : false,
        accountLocked: accountLocked ? accountLocked.checked : false
      };
      localStorage.setItem('avery-account-settings', JSON.stringify(next));
      setMessage(document.getElementById('account-message'), 'Settings saved on this device for preview. Live syncing will work after your backend is connected.');
    });
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      setMessage(document.getElementById('login-message'), 'This sign-in form is a front-end shell. Connect it to Supabase Auth, Clerk, Firebase Auth, or your preferred auth provider when you are ready.');
    });
  }

  const resetForm = document.getElementById('reset-form');
  if (resetForm) {
    resetForm.addEventListener('submit', function (e) {
      e.preventDefault();
      setMessage(document.getElementById('reset-message'), 'Password reset email flow needs a real auth provider. This page is already laid out for that handoff.');
    });
  }
})();
