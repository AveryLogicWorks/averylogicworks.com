(function () {
  const cfg = window.AVERY_CONFIG || {};
  const stripe = (cfg.paypalLinks || {});
  const founderImages = (cfg.founderImages || {});
  const supabaseCfg = cfg.supabase || {};
  const emailOctopusCfg = cfg.emailOctopus || {};
  const paths = Object.assign({
    home: 'index.html',
    login: 'login.html',
    signup: 'signup.html',
    signupSuccess: 'signup-success.html',
    account: 'account.html',
    confirmNotice: 'login.html?check-email=1',
    resetRedirect: 'login.html?reset=1'
  }, cfg.paths || {});
  const fallbacks = {
    main: 'assets/founder-main-placeholder.svg',
    avatar: 'assets/founder-avatar-placeholder.svg'
  };

  const reservedDisplayNames = new Set([
    'founder', 'owner', 'admin', 'administrator', 'moderator', 'support', 'official', 'staff', 'team',
    'creator', 'avery logic works', 'averylogicworks', 'averylogicworks.com', 'themis'
  ]);
  const bannedFragments = [
    'fuck', 'shit', 'bitch', 'asshole', 'nigger', 'faggot', 'cunt', 'slut', 'whore', 'rape', 'molest',
    'kill', 'murder', 'terror', 'fraud', 'scam', 'bomb', 'suicide', 'pedo', 'porn', 'sex', 'nazi'
  ];

  function absoluteUrl(path) {
    return new URL(path, window.location.href).toString();
  }

  function getRememberKey() {
    return 'avery-remember-me';
  }

  function getRememberedEmailKey() {
    return 'avery-remembered-email';
  }

  function getRememberPreference() {
    const raw = localStorage.getItem(getRememberKey());
    return raw === null ? true : raw === 'true';
  }

  function setRememberPreference(value) {
    localStorage.setItem(getRememberKey(), value ? 'true' : 'false');
    if (!value) {
      localStorage.removeItem(getRememberedEmailKey());
    }
  }

  function getRememberedEmail() {
    if (!getRememberPreference()) return '';
    return localStorage.getItem(getRememberedEmailKey()) || '';
  }

  function setRememberedEmail(email) {
    if (getRememberPreference() && email) {
      localStorage.setItem(getRememberedEmailKey(), email);
    } else {
      localStorage.removeItem(getRememberedEmailKey());
    }
  }

  function moveAuthStorage(useLocal) {
    const keyPrefix = 'sb-' + (supabaseCfg.url || 'avery');
    const source = useLocal ? sessionStorage : localStorage;
    const target = useLocal ? localStorage : sessionStorage;
    Object.keys(source).forEach((key) => {
      if (key.startsWith(keyPrefix)) {
        target.setItem(key, source.getItem(key));
        source.removeItem(key);
      }
    });
  }

  const authStorage = {
    getItem(key) {
      return localStorage.getItem(key) || sessionStorage.getItem(key);
    },
    setItem(key, value) {
      if (getRememberPreference()) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    },
    removeItem(key) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  };

  let sb = null;
  if (window.supabase && supabaseCfg.url && supabaseCfg.publishableKey) {
    try {
      sb = window.supabase.createClient(supabaseCfg.url, supabaseCfg.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: authStorage
        }
      });
      window._averySupabase = sb;
    } catch (err) {
      console.error('Supabase init failed', err);
    }
  }

  function normalizeName(value) {
    return (value || '').trim().replace(/\s+/g, ' ');
  }

  function isOwnerEmail(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    return normalizedEmail && Array.isArray(cfg.ownerEmails) && cfg.ownerEmails.some((value) => {
      return String(value || '').trim().toLowerCase() === normalizedEmail;
    });
  }

  function validateDisplayName(value, email) {
    const name = normalizeName(value);
    if (!name) return { ok: false, message: 'Add a display name so the account has a readable label.' };
    if (name.length < 2) return { ok: false, message: 'Display name must be at least 2 characters.' };
    if (name.length > 32) return { ok: false, message: 'Display name must stay under 33 characters.' };
    if (!/^[A-Za-z0-9 ._\-]+$/.test(name)) return { ok: false, message: 'Display name can use letters, numbers, spaces, periods, underscores, and hyphens only.' };
    if (/([._\- ])\1\1/.test(name)) return { ok: false, message: 'Display name cannot use repeated symbol spam.' };
    const lowered = name.toLowerCase();
    if (reservedDisplayNames.has(lowered)) {
      if (lowered === 'founder' && isOwnerEmail(email)) {
        return { ok: true, value: name };
      }
      return { ok: false, message: 'That display name is reserved. Please choose another.' };
    }
    if (bannedFragments.some((term) => lowered.includes(term))) return { ok: false, message: 'That display name is not allowed. Please choose another.' };
    return { ok: true, value: name };
  }

  let analyticsEnabled = true;

  async function trackEvent(eventType, payload) {
    if (!analyticsEnabled || !eventType || !supabaseCfg.telemetryEdgeFunction) return;
    try {
      const sessionData = sb ? await sb.auth.getSession() : null;
      const session = sessionData?.data?.session || null;
      const headers = {
        'Content-Type': 'application/json',
        'apikey': supabaseCfg.publishableKey || ''
      };
      if (session?.access_token) headers.Authorization = 'Bearer ' + session.access_token;
      await fetch(supabaseCfg.telemetryEdgeFunction, {
        method: 'POST',
        headers: headers,
        keepalive: true,
        body: JSON.stringify({
        event_type: eventType,
        page_path: window.location.pathname || '/',
        visitor_token: getVisitorToken(),
        attempted_email: eventType === 'login_failed' ? payload?.email : null,
        referrer: document.referrer || '',
        metadata: payload || {}
        })
      });
    } catch (err) {
      console.debug('site event skipped', eventType, err?.message || err);
    }
  }

  function getVisitorToken() {
    const key = 'avery-visitor-token';
    let token = localStorage.getItem(key);
    if (!token) {
      token = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, token);
    }
    return token;
  }


  function currentManagedPath() {
    const part = String(window.location.pathname || '/').split('/').filter(Boolean).pop();
    return part || 'index.html';
  }

  function applyManagedValue(row) {
    if (!row || !row.selector) return;
    let nodes;
    try { nodes = document.querySelectorAll(row.selector); } catch (_) { return; }
    nodes.forEach((node) => {
      if (row.property === 'text') node.textContent = row.value || '';
      if (row.property === 'href' && node instanceof HTMLAnchorElement) node.setAttribute('href', row.value || '#');
      if (row.property === 'src' && (node instanceof HTMLImageElement || node instanceof HTMLSourceElement)) node.setAttribute('src', row.value || '');
      if (row.property === 'hidden') node.hidden = String(row.value).toLowerCase() === 'true';
    });
  }

  function showManagedBanner(setting) {
    if (!setting || !setting.enabled || !setting.message) return;
    const banner = document.createElement('div');
    banner.className = 'alw-managed-banner alw-managed-banner-' + String(setting.tone || 'info');
    banner.setAttribute('role', setting.tone === 'critical' ? 'alert' : 'status');
    banner.textContent = setting.message;
    banner.style.cssText = 'padding:12px 18px;text-align:center;font-weight:800;border-bottom:1px solid rgba(255,255,255,.18);background:#14304d;color:#fff;';
    if (setting.tone === 'warning') banner.style.background = '#6b4c09';
    if (setting.tone === 'critical') banner.style.background = '#7a2420';
    if (setting.tone === 'success') banner.style.background = '#175b34';
    document.body.insertBefore(banner, document.body.firstChild);
  }

  function showMaintenance(setting) {
    if (!setting || !setting.enabled || currentManagedPath() === 'vault-m7q4k2.html') return;
    const main = document.querySelector('main');
    if (!main) return;
    main.innerHTML = '<section class="page-hero"><div class="container"><div class="form-shell" style="max-width:760px;margin:0 auto;text-align:center;"><span class="tag warm">Maintenance</span><h1>We will be right back.</h1><p class="muted" id="alw-maintenance-message"></p><p class="small-note">Customer data and account access remain protected while maintenance is active.</p></div></div></section>';
    const message = document.getElementById('alw-maintenance-message');
    if (message) message.textContent = setting.message || 'Avery Logic Works is temporarily undergoing maintenance.';
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => '\\' + char);
  }

  function stableSelector(element) {
    if (element.id) return '#' + cssEscape(element.id);
    const contentKey = element.getAttribute('data-content-key');
    if (contentKey) return '[data-content-key="' + cssEscape(contentKey) + '"]';
    const parts = [];
    let node = element;
    while (node && node !== document.body && parts.length < 7) {
      let part = node.tagName.toLowerCase();
      if (node.classList && node.classList.length) {
        const usable = Array.from(node.classList).find((name) => !name.startsWith('alw-vault-'));
        if (usable) part += '.' + cssEscape(usable);
      }
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((child) => child.tagName === node.tagName);
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }

  function editorProperty(element) {
    if (element instanceof HTMLAnchorElement) return 'href';
    if (element instanceof HTMLImageElement || element instanceof HTMLSourceElement) return 'src';
    return 'text';
  }

  async function enableOwnerVisualEditor() {
    if (new URLSearchParams(window.location.search).get('vault-editor') !== '1' || !sb) return;
    try {
      const session = (await sb.auth.getSession())?.data?.session;
      if (!session) return;
      const allowed = await sb.from('site_admins').select('email').limit(1);
      if (allowed.error || !allowed.data?.length) return;
    } catch (_) { return; }

    const style = document.createElement('style');
    style.textContent = '.alw-vault-edit-mode *{cursor:crosshair!important}.alw-vault-edit-mode [data-alw-edit-hover]{outline:3px solid #58a6ff!important;outline-offset:3px!important}.alw-vault-editor-note{position:fixed;z-index:2147483647;left:16px;right:16px;bottom:16px;padding:12px 16px;border-radius:12px;background:#0d2842;color:#fff;border:1px solid #58a6ff;font-weight:800;text-align:center;box-shadow:0 12px 35px rgba(0,0,0,.45)}';
    document.head.appendChild(style);
    let editing = false;
    let hovered = null;
    const note = document.createElement('div');
    note.className = 'alw-vault-editor-note';
    note.hidden = true;
    note.textContent = 'Click an element to send it to the Vault editor. Press Escape to stop.';
    document.body.appendChild(note);

    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin || !event.data) return;
      if (event.data.type === 'alw-vault-editor-start') {
        editing = true; note.hidden = false; document.documentElement.classList.add('alw-vault-edit-mode');
      }
      if (event.data.type === 'alw-vault-editor-preview') applyManagedValue(event.data);
    });

    document.addEventListener('mouseover', (event) => {
      if (!editing || event.target === note) return;
      if (hovered) hovered.removeAttribute('data-alw-edit-hover');
      hovered = event.target;
      hovered.setAttribute('data-alw-edit-hover', 'true');
    }, true);

    document.addEventListener('click', (event) => {
      if (!editing || event.target === note) return;
      event.preventDefault(); event.stopPropagation();
      const element = event.target;
      const property = editorProperty(element);
      const value = property === 'text' ? element.textContent.trim() : (element.getAttribute(property) || '');
      const label = (element.getAttribute('aria-label') || element.textContent || element.getAttribute('alt') || element.tagName).trim().slice(0, 100);
      window.parent.postMessage({
        type: 'alw-vault-editor-selection',
        selector: stableSelector(element),
        property: property,
        value: value,
        label: label || 'Page content'
      }, window.location.origin);
      editing = false; note.hidden = true; document.documentElement.classList.remove('alw-vault-edit-mode');
      if (hovered) hovered.removeAttribute('data-alw-edit-hover');
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        editing = false; note.hidden = true; document.documentElement.classList.remove('alw-vault-edit-mode');
        if (hovered) hovered.removeAttribute('data-alw-edit-hover');
      }
    });
  }

  async function initializeManagedSite() {
    if (!sb) { maybeTrackVisit(); return; }
    try {
      const settingsResponse = await sb.from('platform_settings').select('key,value').in('key', ['site_banner', 'maintenance_mode', 'analytics']);
      if (!settingsResponse.error) {
        const settings = Object.fromEntries((settingsResponse.data || []).map((row) => [row.key, row.value || {}]));
        analyticsEnabled = settings.analytics?.enabled !== false;
        showManagedBanner(settings.site_banner);
        showMaintenance(settings.maintenance_mode);
      }
      const contentResponse = await sb.from('managed_page_content').select('selector,property,value,published').eq('page_path', currentManagedPath()).eq('published', true);
      if (!contentResponse.error) (contentResponse.data || []).forEach(applyManagedValue);
    } catch (error) {
      console.debug('managed site settings unavailable', error?.message || error);
    }
    await enableOwnerVisualEditor();
    maybeTrackVisit();
  }

  function maybeTrackVisit() {
    if (!sb) return;
    const key = 'avery-last-visit:' + (window.location.pathname || '/');
    const now = Date.now();
    const last = Number(localStorage.getItem(key) || 0);
    if (last && (now - last) < (30 * 60 * 1000)) return;
    localStorage.setItem(key, String(now));
    trackEvent('page_visit', {
      href: window.location.href,
      title: document.title || '',
      referrer: document.referrer || ''
    });
  }

  function setMessage(box, text, tone) {
    if (!box) return;
    box.textContent = text;
    box.className = 'form-message show' + (tone ? ' ' + tone : '');
  }

  function clearMessage(box) {
    if (!box) return;
    box.textContent = '';
    box.className = 'form-message';
  }

  function setBusy(form, busy) {
    if (!form) return;
    form.querySelectorAll('button').forEach((btn) => {
      btn.disabled = !!busy;
    });
  }

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
    '[data-stripe-portal]': stripe.portal
  };
  // Legacy selectors kept for backward compat — now powered by paypalLinks
  Object.entries(stripeTargets).forEach(([selector, url]) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (url && url !== '#') {
        el.href = url;
        if (selector !== '[data-stripe-portal]') {
          el.target = '_blank';
          el.rel = 'noopener noreferrer';
        }
      } else {
        el.href = '#';
        el.setAttribute('aria-disabled', 'true');
        const pendingText = el.getAttribute('data-pending-text');
        if (pendingText) el.textContent = pendingText;
      }
    });
  });

  function hydrateRememberToggles() {
    const remember = getRememberPreference();
    document.querySelectorAll('[data-remember-me]').forEach((input) => {
      input.checked = remember;
      input.addEventListener('change', () => {
        const next = !!input.checked;
        setRememberPreference(next);
        moveAuthStorage(next);
        document.querySelectorAll('[data-remember-me]').forEach((other) => {
          if (other !== input) other.checked = next;
        });
      });
    });
  }

  function hydratePasswordToggles() {
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = document.getElementById(button.getAttribute('data-password-toggle'));
        if (!target) return;
        const nextType = target.type === 'password' ? 'text' : 'password';
        target.type = nextType;
        const isText = nextType === 'text';
        button.setAttribute('aria-pressed', String(isText));
        button.setAttribute('aria-label', isText ? 'Hide password' : 'Show password');
        button.textContent = isText ? '\u{1F441} Hide' : '\u{1F441} Show';
      });
    });
  }

  function applyActiveNavState() {
    const current = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const currentWithHash = current + window.location.hash.toLowerCase();
    document.querySelectorAll('.nav-links a, .nav-links button, .footer-links a').forEach((el) => {
      el.classList.remove('active');
      if (el.tagName.toLowerCase() === 'button') return;
      const href = (el.getAttribute('href') || '').toLowerCase();
      if (!href || href === '#') return;
      const normalized = href.split('/').pop();
      // Never hide the Home link — always keep it visible
      if (normalized === 'index.html' && current === 'index.html') {
        el.classList.add('active');
        return;
      }
      // For non-home pages, hide the link if it points to the current page
      if (normalized === current || normalized === currentWithHash) {
        el.classList.add('nav-hidden');
      } else {
        el.classList.remove('nav-hidden');
      }
      if (current === 'index.html' && href === 'index.html#support' && window.location.hash.toLowerCase() === '#support') {
        el.classList.add('active');
      }
    });
  }

  async function updateNavAuth() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) {
      applyActiveNavState();
      return;
    }
    const loginLink = navLinks.querySelector('a[href="login.html"], a[data-auth-state="login"]');
    const signupLink = navLinks.querySelector('a[href="signup.html"]');
    const donateLink = navLinks.querySelector('a.button.secondary.small[href*="#support"], a.button.secondary.small[data-nav-donate]');
    if (!loginLink) {
      applyActiveNavState();
      return;
    }

    const session = sb ? (await sb.auth.getSession())?.data?.session : null;
    let accountLink = navLinks.querySelector('[data-auth-account="true"]');
    let signOutLink = navLinks.querySelector('[data-auth-signout]');

    if (session) {
      if (!accountLink) {
        accountLink = document.createElement('a');
        accountLink.href = paths.account;
        accountLink.textContent = 'Account';
        accountLink.setAttribute('data-auth-account', 'true');
        navLinks.insertBefore(accountLink, donateLink || null);
      }
      loginLink.classList.add('nav-hidden');
      if (signupLink) signupLink.classList.add('nav-hidden');
      if (!signOutLink) {
        signOutLink = document.createElement('button');
        signOutLink.type = 'button';
        signOutLink.className = 'button ghost small nav-signout';
        signOutLink.textContent = 'Log out';
        signOutLink.setAttribute('data-auth-signout', 'true');
        navLinks.insertBefore(signOutLink, donateLink || null);
      }
      signOutLink.onclick = async function () {
        if (sb) await sb.auth.signOut();
        window.location.href = paths.login;
      };
    } else {
      loginLink.classList.remove('nav-hidden');
      if (signupLink) signupLink.classList.remove('nav-hidden');
      if (accountLink) accountLink.remove();
      if (signOutLink) signOutLink.remove();
    }
    applyActiveNavState();
  }

  async function updateAuthCtas() {
    const ctas = document.querySelectorAll('[data-auth-cta]');
    if (!ctas.length) return;
    const session = sb ? (await sb.auth.getSession())?.data?.session : null;
    ctas.forEach(function (el) {
      if (session) {
        if (!el.hasAttribute('data-auth-cta-default-href')) {
          el.setAttribute('data-auth-cta-default-href', el.getAttribute('href') || '');
        }
        if (!el.hasAttribute('data-auth-cta-default-text')) {
          el.setAttribute('data-auth-cta-default-text', el.textContent);
        }
        el.href = el.getAttribute('data-auth-cta') || paths.account;
        const signedInText = el.getAttribute('data-auth-cta-text');
        if (signedInText) el.textContent = signedInText;
      } else if (el.hasAttribute('data-auth-cta-default-href')) {
        el.href = el.getAttribute('data-auth-cta-default-href');
        el.textContent = el.getAttribute('data-auth-cta-default-text');
      }
    });
  }

  initializeManagedSite();

  document.querySelectorAll('[data-track-event]').forEach((el) => {
    el.addEventListener('click', () => {
      trackEvent(el.getAttribute('data-track-event'), {
        label: (el.textContent || '').trim().slice(0, 160),
        href: el.getAttribute('href') || ''
      });
    });
  });

  document.querySelectorAll('[data-track-view]').forEach((el) => {
    const eventType = el.getAttribute('data-track-view');
    const key = 'alw-view:' + window.location.pathname + ':' + eventType;
    let alreadySeen = false;
    try { alreadySeen = window.sessionStorage.getItem(key) === '1'; } catch (e) { /* unavailable */ }
    if (alreadySeen || !eventType) return;
    const recordView = () => {
      try { window.sessionStorage.setItem(key, '1'); } catch (e) { /* unavailable */ }
      trackEvent(eventType, { label: (el.querySelector('h1,h2,h3')?.textContent || '').trim().slice(0, 160) });
    };
    if (!('IntersectionObserver' in window)) { recordView(); return; }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.4)) return;
      observer.disconnect();
      recordView();
    }, { threshold: [0.4] });
    observer.observe(el);
  });
  hydrateRememberToggles();
  hydratePasswordToggles();
  applyActiveNavState();

  var loginEmailField = document.getElementById('loginEmail');
  if (loginEmailField) {
    var rememberedEmail = getRememberedEmail();
    if (rememberedEmail) loginEmailField.value = rememberedEmail;
  }

  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const messageBox = document.getElementById('signup-message');
      clearMessage(messageBox);
      const displayNameRaw = signupForm.querySelector('[name="displayName"]').value;
      const email = signupForm.querySelector('[name="email"]').value.trim();
      const nameCheck = validateDisplayName(displayNameRaw, email);
      const password = signupForm.querySelector('[name="password"]').value;
      const confirmPassword = signupForm.querySelector('[name="confirmPassword"]').value;
      const newsletter = signupForm.querySelector('[name="newsletter"]').checked;
      const supporterUpdates = signupForm.querySelector('[name="supporterUpdates"]').checked;
      const acceptedTerms = signupForm.querySelector('[name="acceptedTerms"]').checked;

      if (!nameCheck.ok) {
        setMessage(messageBox, nameCheck.message, 'error');
        return;
      }
      if (password.length < 8) {
        setMessage(messageBox, 'Use at least 8 characters for your password.', 'error');
        return;
      }
      if (password !== confirmPassword) {
        setMessage(messageBox, 'Passwords do not match.', 'error');
        return;
      }
      if (!acceptedTerms) {
        setMessage(messageBox, 'Please accept the terms before creating an account.', 'error');
        return;
      }
      if (!sb) {
        setMessage(messageBox, 'Supabase is not connected yet. Add the project URL and publishable key to site-config.js.', 'error');
        return;
      }

      setBusy(signupForm, true);
      try {
        var signupNext = searchParams.get('next');
        var emailRedirect = absoluteUrl(paths.login);
        if (signupNext) emailRedirect += '?next=' + encodeURIComponent(signupNext);
        const { error } = await sb.auth.signUp({
          email: email,
          password: password,
          options: {
            emailRedirectTo: emailRedirect,
            data: {
              display_name: nameCheck.value,
              newsletter_opt_in: newsletter,
              supporter_updates_opt_in: supporterUpdates,
              accepted_terms: true,
              signup_source: 'website'
            }
          }
        });
        if (error) throw error;

        // If newsletter opted in, add to EmailOctopus immediately
        if (newsletter && emailOctopusCfg.enabled && emailOctopusCfg.listId) {
          try {
            await fetch(emailOctopusCfg.edgeFunctionUrl || '/api/emailoctopus-subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: email,
                name: nameCheck.value,
                listId: emailOctopusCfg.listId
              })
            });
          } catch (eoErr) {
            console.debug('EmailOctopus signup failed silently', eoErr);
          }
        }

        localStorage.setItem('avery-account-settings', JSON.stringify({
          newsletter: newsletter,
          supporterUpdates: supporterUpdates,
          accountLocked: false
        }));
        trackEvent('signup_submitted', {
          email: email,
          display_name: nameCheck.value,
          newsletter_opt_in: newsletter,
          supporter_updates_opt_in: supporterUpdates
        });
        signupForm.reset();
        hydrateRememberToggles();
        var signupNextUrl = paths.signupSuccess;
        var signupNextParam = searchParams.get('next');
        if (signupNextParam) signupNextUrl += '?next=' + encodeURIComponent(signupNextParam);
        window.location.href = signupNextUrl;
      } catch (err) {
        setMessage(messageBox, err.message || 'Unable to create your account right now.', 'error');
      } finally {
        setBusy(signupForm, false);
      }
    });
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const messageBox = document.getElementById('login-message');
      clearMessage(messageBox);
      if (!sb) {
        setMessage(messageBox, 'Supabase is not connected yet. Add the project URL and publishable key to site-config.js.', 'error');
        return;
      }
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const remember = !!loginForm.querySelector('[data-remember-me]')?.checked;
      setRememberPreference(remember);
      moveAuthStorage(remember);
      if (remember) setRememberedEmail(email);
      else setRememberedEmail('');
      setBusy(loginForm, true);
      try {
        const { error } = await sb.auth.signInWithPassword({ email: email, password: password });
        if (error) throw error;
        trackEvent('login_success', { email: email, remember_me: remember });
        const nextParam = searchParams.get('next');
        if (nextParam) {
          window.location.href = decodeURIComponent(nextParam);
        } else {
          window.location.href = paths.account;
        }
      } catch (err) {
        trackEvent('login_failed', { email: email, reason: err.message || 'Sign-in failed' });
        setMessage(messageBox, err.message || 'Sign-in failed.', 'error');
      } finally {
        setBusy(loginForm, false);
      }
    });
  }

  const resetForm = document.getElementById('reset-form');
  if (resetForm) {
    resetForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const messageBox = document.getElementById('reset-message');
      clearMessage(messageBox);
      if (!sb) {
        setMessage(messageBox, 'Supabase is not connected yet. Add the project URL and publishable key to site-config.js.', 'error');
        return;
      }
      const email = document.getElementById('resetEmail').value.trim();
      setBusy(resetForm, true);
      try {
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: absoluteUrl(paths.resetRedirect)
        });
        if (error) throw error;
        trackEvent('password_reset_requested', {});
        setMessage(messageBox, 'Reset email sent. Open the link in that email to choose a new password.', 'info');
        resetForm.reset();
      } catch (err) {
        setMessage(messageBox, err.message || 'Unable to send reset email.', 'error');
      } finally {
        setBusy(resetForm, false);
      }
    });
  }

  const completeResetForm = document.getElementById('complete-reset-form');
  const completeResetWrap = document.getElementById('complete-reset-wrap');
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search);
  const recoveryType = hashParams.get('type');
  if (completeResetWrap && recoveryType === 'recovery') {
    completeResetWrap.classList.remove('hidden');
  }
  if (completeResetForm) {
    completeResetForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const messageBox = document.getElementById('complete-reset-message');
      clearMessage(messageBox);
      if (!sb) {
        setMessage(messageBox, 'Supabase is not connected yet. Add the project URL and publishable key to site-config.js.', 'error');
        return;
      }
      const password = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;
      if (password.length < 8) {
        setMessage(messageBox, 'Use at least 8 characters for your new password.', 'error');
        return;
      }
      if (password !== confirmPassword) {
        setMessage(messageBox, 'The new passwords do not match.', 'error');
        return;
      }
      setBusy(completeResetForm, true);
      try {
        const { error } = await sb.auth.updateUser({ password: password });
        if (error) throw error;
        setMessage(messageBox, 'Password updated. You can sign in now.', 'info');
        completeResetForm.reset();
      } catch (err) {
        setMessage(messageBox, err.message || 'Unable to update your password.', 'error');
      } finally {
        setBusy(completeResetForm, false);
      }
    });
  }

  async function loadOwnerDashboard() {
    const wrap = document.getElementById('owner-dashboard');
    if (!wrap || !sb) return;
    try {
      const { data, error } = await sb.rpc('get_owner_dashboard_counts');
      if (error) throw error;
      if (!data || !data.length) return;
      const stats = data[0];
      wrap.classList.remove('hidden');
      const bindings = {
        '[data-stat="visits_24h"]': stats.visits_24h,
        '[data-stat="visits_30d"]': stats.visits_30d,
        '[data-stat="visits_all_time"]': stats.visits_all_time,
        '[data-stat="logins_30d"]': stats.logins_30d,
        '[data-stat="logins_all_time"]': stats.logins_all_time,
        '[data-stat="signups_30d"]': stats.signups_30d,
        '[data-stat="signups_all_time"]': stats.signups_all_time,
        '[data-stat="accounts_total"]': stats.accounts_total,
        '[data-stat="newsletter_opt_ins"]': stats.newsletter_opt_ins,
        '[data-stat="supporter_updates_opt_ins"]': stats.supporter_updates_opt_ins,
        '[data-stat="donation_events"]': stats.donation_events,
        '[data-stat="subscription_events"]': stats.subscription_events,
        '[data-stat="donation_total"]': stats.donation_total_display,
        '[data-stat="subscription_total"]': stats.subscription_total_display
      };
      Object.entries(bindings).forEach(([selector, value]) => {
        const el = wrap.querySelector(selector);
        if (el) el.textContent = value ?? '0';
      });
    } catch (err) {
      console.debug('owner dashboard unavailable', err?.message || err);
    }
  }

  async function hydrateAccountPage() {
    const accountForm = document.getElementById('account-form');
    if (!accountForm) return;
    const messageBox = document.getElementById('account-message');
    const statusBox = document.getElementById('account-status');
    const emailNode = document.getElementById('account-email');
    const signOutButton = document.getElementById('signout-button');
    if (!sb) {
      if (statusBox) setMessage(statusBox, 'Supabase is not connected yet. Add the project URL and publishable key to site-config.js.', 'error');
      return;
    }

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      window.location.href = paths.login;
      return;
    }

    if (emailNode) emailNode.textContent = session.user.email || '';
    if (statusBox) {
      setMessage(statusBox, 'Signed in as ' + (session.user.email || 'your account') + '.', 'info');
    }

    const metadata = session.user.user_metadata || {};
    const stored = JSON.parse(localStorage.getItem('avery-account-settings') || '{}');
    const newsletter = accountForm.querySelector('[name="newsletter"]');
    const supporterUpdates = accountForm.querySelector('[name="supporterUpdates"]');
    const accountLocked = accountForm.querySelector('[name="accountLocked"]');
    if (newsletter) newsletter.checked = metadata.newsletter_opt_in ?? stored.newsletter ?? false;
    if (supporterUpdates) supporterUpdates.checked = metadata.supporter_updates_opt_in ?? stored.supporterUpdates ?? false;
    if (accountLocked) accountLocked.checked = !!(stored.accountLocked);

    accountForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearMessage(messageBox);
      const next = {
        newsletter: newsletter ? newsletter.checked : false,
        supporterUpdates: supporterUpdates ? supporterUpdates.checked : false,
        accountLocked: accountLocked ? accountLocked.checked : false
      };
      setBusy(accountForm, true);
      try {
        const { error } = await sb.auth.updateUser({
          data: {
            newsletter_opt_in: next.newsletter,
            supporter_updates_opt_in: next.supporterUpdates,
            account_locked_preview: next.accountLocked
          }
        });
        if (error) throw error;

        // Sync newsletter preference to EmailOctopus
        if (next.newsletter && emailOctopusCfg.enabled && emailOctopusCfg.listId) {
          try {
            await fetch(emailOctopusCfg.edgeFunctionUrl || '/api/emailoctopus-subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: session.user.email,
                name: session.user.user_metadata?.display_name || '',
                listId: emailOctopusCfg.listId
              })
            });
          } catch (eoErr) {
            console.debug('EmailOctopus account sync failed silently', eoErr);
          }
        }

        localStorage.setItem('avery-account-settings', JSON.stringify(next));
        let msg = 'Settings saved.';
        if (next.newsletter && (!emailOctopusCfg.enabled || !emailOctopusCfg.listId)) {
          msg += ' EmailOctopus is still waiting for its list connection.';
        }
        setMessage(messageBox, msg, 'info');
      } catch (err) {
        setMessage(messageBox, err.message || 'Unable to save settings.', 'error');
      } finally {
        setBusy(accountForm, false);
      }
    });

    await loadOwnerDashboard();
    await loadUserInbox(session);

    if (signOutButton) {
      signOutButton.addEventListener('click', async function () {
        await sb.auth.signOut();
        window.location.href = paths.login;
      });
    }
  }
  async function loadUserInbox(session) {
    var inboxSection = document.getElementById('user-inbox-section');
    var inboxList = document.getElementById('user-inbox-list');
    if (!inboxSection || !inboxList || !sb) return;
    try {
      var userId = session && session.user ? session.user.id : '';
      if (!userId) return;
      var resp = await sb.from('owner_messages')
        .select('*')
        .eq('recipient_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (resp.error) throw resp.error;
      var rows = resp.data || [];
      if (rows.length === 0) {
        inboxList.innerHTML = '<div class="empty-state">No messages yet.</div>';
        inboxSection.classList.remove('hidden');
        return;
      }
      inboxSection.classList.remove('hidden');
      inboxList.innerHTML = rows.map(function (row) {
        var dateStr = row.created_at ? new Date(row.created_at).toLocaleString() : '';
        var s = (row.subject || 'No subject').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var b = (row.body || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var sender = (row.sender_email || 'Avery Logic Works').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var html = '<div class="data-item">'
          + '<strong>' + s + '</strong>'
          + '<div class="data-meta">From: ' + sender + ' \u00b7 ' + dateStr + '</div>'
          + '<p>' + b + '</p>';
        if (row.reply) {
          var r = (row.reply).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          html += '<div class="data-meta" style="border-left:2px solid #58a6ff;padding-left:8px;margin-top:8px;"><strong>Your reply:</strong> ' + r + '</div>';
        } else {
          html += '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">'
            + '<textarea placeholder="Type your reply..." style="flex:1;min-height:60px;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:inherit;font-size:.9rem;resize:vertical;" data-user-reply="' + row.id + '"></textarea>'
            + '<button class="button primary small" data-user-reply-btn="' + row.id + '" style="align-self:flex-start;">Send Reply</button>'
            + '</div>';
        }
        html += '</div>';
        return html;
      }).join('');

      inboxList.querySelectorAll('[data-user-reply-btn]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-user-reply-btn');
          var textarea = inboxList.querySelector('[data-user-reply="' + id + '"]');
          var replyText = textarea ? textarea.value.trim() : '';
          if (!replyText) { alert('Please type a reply first.'); return; }
          btn.disabled = true;
          btn.textContent = 'Sending...';
          try {
            var sessionData = await sb.auth.getSession();
            var sess = sessionData && sessionData.data ? sessionData.data.session : null;
            var baseUrl = String(supabaseCfg.url || '').replace(/\/+$/, '');
            var patchResp = await fetch(baseUrl + '/rest/v1/owner_messages?id=eq.' + id, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseCfg.publishableKey || '',
                'Authorization': 'Bearer ' + (sess ? sess.access_token : ''),
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                reply: replyText,
                replied_at: new Date().toISOString()
              })
            });
            if (!patchResp.ok) throw new Error('Update failed: ' + patchResp.status);
            btn.textContent = 'Reply Sent!';
            btn.style.backgroundColor = '#3fb950';
            setTimeout(function () { loadUserInbox(session); }, 1000);
          } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Send Reply';
            alert('Failed to send reply: ' + (err.message || err));
          }
        });
      });
    } catch (err) {
      if (inboxList) {
        inboxList.innerHTML = '<div class="empty-state">Inbox is not available yet.</div>';
        inboxSection.classList.remove('hidden');
      }
    }
  }

  hydrateAccountPage();

  if (searchParams.has('check-email')) {
    setMessage(document.getElementById('login-message'), 'Check your email to confirm your account, then return here to sign in.', 'info');
  }
  if (searchParams.has('reset')) {
    setMessage(document.getElementById('reset-message'), 'Use the reset link from your email on this page to choose a new password.', 'info');
  }

  const heroVideo = document.querySelector('.hero-card.media-card video');
  if (heroVideo) {
    heroVideo.preload = 'auto';
    heroVideo.setAttribute('fetchpriority', 'high');
    heroVideo.load();
    const tryPlay = function () {
      const p = heroVideo.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };
    heroVideo.addEventListener('loadeddata', tryPlay, { once: true });
    window.addEventListener('pageshow', tryPlay, { once: true });
    setTimeout(tryPlay, 50);
  }

  updateNavAuth();
  updateAuthCtas();
  if (sb) {
    sb.auth.onAuthStateChange(() => {
      updateNavAuth();
      updateAuthCtas();
    });
  }
})();
