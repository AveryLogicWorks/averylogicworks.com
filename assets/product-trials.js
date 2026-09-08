(function () {
  'use strict';

  var cachedClient = null;

  function config() {
    return window.AVERY_CONFIG || {};
  }

  function client() {
    if (cachedClient) return cachedClient;
    var cfg = config().supabase || {};
    if (!window.supabase || !cfg.url || !cfg.publishableKey) return null;
    cachedClient = window.supabase.createClient(cfg.url, cfg.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return cachedClient;
  }

  function visitorToken() {
    var key = 'avery-visitor-token';
    try {
      var token = localStorage.getItem(key);
      if (!token) {
        token = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(key, token);
      }
      return token;
    } catch (e) {
      return null;
    }
  }

  function loginFor(anchor) {
    var next = 'programs.html' + (anchor || '');
    window.location.href = 'login.html?next=' + encodeURIComponent(next);
  }

  async function claim(productSlug, anchor) {
    var sb = client();
    if (!sb) throw new Error('Trial sign-in is temporarily unavailable.');

    var sessionResult = await sb.auth.getSession();
    var session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
    if (!session) {
      loginFor(anchor);
      return null;
    }

    var cfg = config();
    var endpoint = cfg.supabase && cfg.supabase.trialKeyEdgeFunction;
    if (!endpoint) throw new Error('Trial-key service is not configured.');

    var response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token,
        'apikey': cfg.supabase.publishableKey
      },
      body: JSON.stringify({
        product_slug: productSlug,
        visitor_token: visitorToken()
      })
    });
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.error || 'Could not issue your trial key.');
    return payload;
  }

  function startDownload(url, filename) {
    if (!url) throw new Error('Trial download is not configured.');
    var link = document.createElement('a');
    link.href = url;
    if (filename) link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function formatResult(productName, payload) {
    if (!payload) return '';
    var expiry = payload.expires_at ? new Date(payload.expires_at).toLocaleString() : '';
    var action = payload.restarted ? ' restarted' : '';
    return productName + ' trial' + action + '. Key: ' + payload.key + (expiry ? ' · expires ' + expiry : '') + '. Save this key. It belongs to your signed-in account and may be bound to the computer that first activates it.';
  }

  async function claimAndDownload(options) {
    options = options || {};
    var payload = await claim(options.productSlug, options.anchor);
    if (!payload) return null;
    if (options.feedback) options.feedback.textContent = formatResult(options.productName || options.productSlug, payload);
    startDownload(options.downloadUrl, options.filename);
    return payload;
  }

  window.AveryProductTrials = {
    claim: claim,
    claimAndDownload: claimAndDownload,
    startDownload: startDownload,
    formatResult: formatResult
  };
})();
