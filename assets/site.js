(function () {
  const cfg = window.AVERY_CONFIG || {};
  const stripe = (cfg.stripeLinks || {});
  const founderImages = (cfg.founderImages || {});
  const supabaseCfg = cfg.supabase || {};
  const emailOctopusCfg = cfg.emailOctopus || {};
  const paths = Object.assign({
    home: 'index.html',
    login: 'login.html',
    signup: 'signup.html',
    account: 'account.html',
    confirmNotice: 'login.html?check-email=1',
    resetRedirect: 'login.html?reset=1'
  }, cfg.paths || {});
  const fallbacks = {
    main: 'assets/founder-main-placeholder.svg',
    avatar: 'assets/founder-avatar-placeholder.svg'
  };

  function absoluteUrl(path) {
    return new URL(path, window.location.href).toString();
  }


  function getEmailOctopusFunctionUrl() {
    if (!supabaseCfg.url || !emailOctopusCfg.functionName) return '';
    return supabaseCfg.url.replace(/\/$/, '') + '/functions/v1/' + emailOctopusCfg.functionName;
  }

  async function subscribeNewsletterViaFunction(payload) {
    if (!emailOctopusCfg.enabled || !emailOctopusCfg.listId || !emailOctopusCfg.functionName) {
      return { ok: false, skipped: true, reason: 'not-configured' };
    }
    const fnUrl = getEmailOctopusFunctionUrl();
    if (!fnUrl) return { ok: false, skipped: true, reason: 'missing-function-url' };

    try {
      const response = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseCfg.publishableKey || ''
        },
        body: JSON.stringify({
          email: payload.email,
          name: payload.displayName || '',
          listId: emailOctopusCfg.listId,
          source: 'website-signup'
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false, error: data?.error || 'newsletter-subscribe-failed' };
      }
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err?.message || 'newsletter-subscribe-failed' };
    }
  }

  async function trackEvent(eventType, payload) {
    if (!sb || !eventType) return;
    try {
      const sessionData = await sb.auth.getSession();
      const session = sessionData?.data?.session || null;
      await sb.from('site_events').insert({
        event_type: eventType,
        page_path: window.location.pathname || '/',
        visitor_token: getVisitorToken(),
        user_id: session?.user?.id || null,
        user_email: payload?.email || session?.user?.email || null,
        metadata: payload || {}
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

  let sb = null;
  if (window.supabase && supabaseCfg.url && supabaseCfg.publishableKey) {
    try {
      sb = window.supabase.createClient(supabaseCfg.url, supabaseCfg.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } catch (err) {
      console.error('Supabase init failed', err);
    }
  }

  maybeTrackVisit();

  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const messageBox = document.getElementById('signup-message');
      clearMessage(messageBox);
      const displayName = signupForm.querySelector('[name="displayName"]').value.trim();
      const email = signupForm.querySelector('[name="email"]').value.trim();
      const password = signupForm.querySelector('[name="password"]').value;
      const newsletter = signupForm.querySelector('[name="newsletter"]').checked;
      const supporterUpdates = signupForm.querySelector('[name="supporterUpdates"]').checked;
      const acceptedTerms = signupForm.querySelector('[name="acceptedTerms"]').checked;

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
        const { error } = await sb.auth.signUp({
          email: email,
          password: password,
          options: {
            emailRedirectTo: absoluteUrl(paths.login),
            data: {
              display_name: displayName,
              newsletter_opt_in: newsletter,
              supporter_updates_opt_in: supporterUpdates,
              accepted_terms: true,
              signup_source: 'website'
            }
          }
        });
        if (error) throw error;

        localStorage.setItem('avery-account-settings', JSON.stringify({
          newsletter: newsletter,
          supporterUpdates: supporterUpdates,
          accountLocked: false
        }));
        trackEvent('signup_submitted', {
          email: email,
          display_name: displayName,
          newsletter_opt_in: newsletter,
          supporter_updates_opt_in: supporterUpdates
        });

        let newsletterState = 'not-requested';
        if (newsletter) {
          const newsletterResult = await subscribeNewsletterViaFunction({
            email: email,
            displayName: displayName
          });
          newsletterState = newsletterResult.ok ? 'subscribed' : (newsletterResult.skipped ? 'saved-only' : 'pending');
          trackEvent('newsletter_attempt', {
            email: email,
            status: newsletterState,
            detail: newsletterResult.error || newsletterResult.reason || null
          });
        }

        let msg = 'Account created. Check your email to confirm your address, then sign in.';
        if (newsletter && newsletterState === 'subscribed') {
          msg += ' You were also added to the newsletter list.';
        } else if (newsletter && newsletterState === 'saved-only') {
          msg += ' Newsletter preference was saved, but the EmailOctopus function still needs to be deployed.';
        } else if (newsletter && newsletterState === 'pending') {
          msg += ' Newsletter preference was saved, but the newsletter connection still needs one final backend step.';
        }
        setMessage(messageBox, msg, 'info');
        signupForm.reset();
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
      setBusy(loginForm, true);
      try {
        const { error } = await sb.auth.signInWithPassword({ email: email, password: password });
        if (error) throw error;
        trackEvent('login_success', { email: email });
        window.location.href = paths.account;
      } catch (err) {
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

    if (signOutButton) {
      signOutButton.addEventListener('click', async function () {
        await sb.auth.signOut();
        window.location.href = paths.login;
      });
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
})();
