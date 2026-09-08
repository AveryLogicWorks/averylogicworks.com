(function () {
  'use strict';

  var formIds = new Set(['support-form', 'bug-report-form', 'feedback-form']);

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

  function messageBox(id, text, tone) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'form-message' + (text ? ' show' : '') + (tone ? ' ' + tone : '');
  }

  async function authToken() {
    try {
      var sb = window._averySupabase;
      if (!sb || !sb.auth) return '';
      var result = await sb.auth.getSession();
      return result && result.data && result.data.session ? result.data.session.access_token || '' : '';
    } catch (e) {
      return '';
    }
  }

  function field(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function endpoint() {
    var cfg = window.AVERY_CONFIG || {};
    var sb = cfg.supabase || {};
    var base = String(sb.url || '').replace(/\/+$/, '');
    return base ? base + '/functions/v1/customer-contact' : '';
  }

  async function post(payload) {
    var url = endpoint();
    if (!url) throw new Error('Contact service is not configured.');
    var cfg = window.AVERY_CONFIG || {};
    var sbCfg = cfg.supabase || {};
    var token = await authToken();
    var headers = { 'Content-Type': 'application/json' };
    if (sbCfg.publishableKey) headers.apikey = sbCfg.publishableKey;
    if (token) headers.Authorization = 'Bearer ' + token;
    var response = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(payload) });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'Your message could not be saved.');
    return data;
  }

  async function supportSubmit(form) {
    var button = document.getElementById('support-submit-button');
    if (!form.reportValidity()) return;
    if (button) button.disabled = true;
    messageBox('support-message', 'Sending your request...', 'info');
    try {
      await post({
        contact_type: 'support',
        name: field('supportName'),
        email: field('supportEmail'),
        category: field('supportCategory'),
        subject: field('supportSubject'),
        message: field('supportMessage'),
        visitor_token: visitorToken(),
        page_path: window.location.pathname || '/support.html'
      });
      form.reset();
      messageBox('support-message', 'Your support request was received. Avery Logic Works can now review it in the owner backend.', 'info');
    } catch (err) {
      messageBox('support-message', err.message || 'Your support request could not be saved right now.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function feedbackSubmit(form) {
    var button = document.getElementById('feedback-submit-button');
    if (!form.reportValidity()) return;
    if (button) button.disabled = true;
    messageBox('feedback-message', 'Sending your feedback...', 'info');
    try {
      await post({
        contact_type: 'feedback',
        name: field('feedbackName'),
        email: field('feedbackEmail'),
        rating: Number(field('feedbackRating') || 0),
        subject: field('feedbackTarget') || 'General feedback',
        message: field('feedbackComment'),
        visitor_token: visitorToken(),
        page_path: window.location.pathname || '/feedback.html',
        metadata: { target_page: field('feedbackTarget') || 'General feedback' }
      });
      form.reset();
      messageBox('feedback-message', 'Your feedback has been received. Thank you for taking the time to share it.', 'info');
    } catch (err) {
      messageBox('feedback-message', err.message || 'Your feedback could not be saved right now.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function bugSubmit(form) {
    var button = document.getElementById('bug-submit-button');
    if (!form.reportValidity()) return;
    if (button) button.disabled = true;
    messageBox('bug-message', 'Sending your report...', 'info');
    try {
      var description = field('bugDescription');
      var steps = field('bugSteps');
      await post({
        contact_type: 'bug',
        name: field('bugName'),
        email: field('bugEmail'),
        category: field('bugType'),
        product: field('bugProduct'),
        severity: field('bugSeverity') || 'low',
        subject: field('bugTitle'),
        message: description,
        visitor_token: visitorToken(),
        page_path: window.location.pathname || '/bug-report.html',
        metadata: { steps_to_reproduce: steps || null }
      });
      var shell = document.getElementById('bug-form-shell');
      var success = document.getElementById('bug-success');
      if (shell && success) {
        shell.style.display = 'none';
        success.classList.add('show');
      } else {
        form.reset();
        messageBox('bug-message', 'Your bug report was received.', 'info');
      }
    } catch (err) {
      messageBox('bug-message', err.message || 'Your bug report could not be saved right now.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement) || !formIds.has(form.id)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (form.id === 'support-form') supportSubmit(form);
    else if (form.id === 'feedback-form') feedbackSubmit(form);
    else if (form.id === 'bug-report-form') bugSubmit(form);
  }, true);
})();
