(function () {
  'use strict';

  if (!/vault-m7q4k2\.html$/i.test(window.location.pathname)) return;

  const cfg = window.AVERY_CONFIG || {};
  const sbCfg = cfg.supabase || {};
  const state = { payload: null, modal: null };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(value) {
    if (!value) return 'Never';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }
  function setStat(name, value) {
    document.querySelectorAll('[data-admin-stat="' + name + '"]').forEach(function (el) {
      el.textContent = String(value == null ? 0 : value);
    });
  }
  function empty(text) { return '<div class="empty-state">' + esc(text) + '</div>'; }
  function badge(text, cls) { return '<span class="vault-self-badge ' + (cls || 'unknown') + '">' + esc(text) + '</span>'; }

  function ensureStyles() {
    if (document.getElementById('alw-vault-enterprise-style')) return;
    const style = document.createElement('style');
    style.id = 'alw-vault-enterprise-style';
    style.textContent = `
      .alw-vault-status{margin:0 0 18px;padding:14px 16px;border:1px solid rgba(88,166,255,.25);border-radius:14px;background:rgba(88,166,255,.07);display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
      .alw-vault-status strong{font-size:.95rem}.alw-vault-status span{color:var(--muted);font-size:.86rem}
      .alw-account-row{cursor:pointer;transition:.15s;border-color,.15s background}.alw-account-row:hover{border-color:rgba(88,166,255,.4);background:rgba(88,166,255,.06)}
      .alw-account-head{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}.alw-account-email{font-weight:800;word-break:break-all}
      .alw-account-tags{display:flex;gap:6px;flex-wrap:wrap}.alw-mini{font-size:.8rem;color:var(--muted)}
      .alw-vault-modal{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.72);display:none;align-items:flex-start;justify-content:center;padding:36px 16px;overflow:auto}
      .alw-vault-modal.show{display:flex}.alw-vault-modal-card{width:min(920px,100%);background:#101923;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.55)}
      [data-theme="light"] .alw-vault-modal-card{background:#fff;color:#18202b}.alw-vault-modal-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.alw-vault-modal-head h3{margin:0}
      .alw-vault-close{border:1px solid var(--line);background:var(--surface);color:inherit;border-radius:10px;padding:7px 12px;cursor:pointer}.alw-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.alw-detail{padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
      .alw-detail strong{display:block;margin-bottom:4px}.alw-detail-wide{grid-column:1/-1}.alw-record-list{display:grid;gap:8px;margin-top:8px}.alw-record{padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.03)}
      .alw-clickable-metric{cursor:pointer}.alw-clickable-metric:hover{outline:1px solid rgba(88,166,255,.35)}
      .alw-risk-panel{margin-top:18px}.alw-risk-high{border-color:rgba(248,81,73,.35)!important}.alw-download-id{font-weight:800}.alw-shared{color:#d29922}
      @media(max-width:720px){.alw-detail-grid{grid-template-columns:1fr}.alw-detail-wide{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (state.modal) return state.modal;
    const modal = document.createElement('div');
    modal.className = 'alw-vault-modal';
    modal.innerHTML = '<div class="alw-vault-modal-card"><div class="alw-vault-modal-head"><div><div class="tag">Account intelligence</div><h3 id="alw-modal-title">Details</h3></div><button class="alw-vault-close" type="button">Close</button></div><div id="alw-modal-body"></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('.alw-vault-close').addEventListener('click', function () { modal.classList.remove('show'); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.remove('show'); });
    state.modal = modal;
    return modal;
  }

  function openModal(title, html) {
    const modal = ensureModal();
    modal.querySelector('#alw-modal-title').textContent = title;
    modal.querySelector('#alw-modal-body').innerHTML = html;
    modal.classList.add('show');
  }

  function accountDetail(account) {
    const trials = account.trials || [];
    const licenses = account.licenses || [];
    const contacts = account.contacts || [];
    const risks = account.risk_signals || [];
    return '<div class="alw-detail-grid">'
      + '<div class="alw-detail"><strong>Email</strong>' + esc(account.email || 'No email') + '</div>'
      + '<div class="alw-detail"><strong>Account type</strong>' + (account.is_owner ? 'Owner / administrator' : 'Customer') + (account.is_anonymous ? ' · Anonymous Auth' : ' · Email account') + '</div>'
      + '<div class="alw-detail"><strong>Display name</strong>' + esc(account.display_name || 'Not set') + '</div>'
      + '<div class="alw-detail"><strong>Email status</strong>' + (account.email_confirmed_at ? 'Confirmed' : 'Not confirmed') + '</div>'
      + '<div class="alw-detail"><strong>Created</strong>' + esc(fmtDate(account.account_created_at)) + '</div>'
      + '<div class="alw-detail"><strong>Last sign-in</strong>' + esc(fmtDate(account.last_sign_in_at)) + '</div>'
      + '<div class="alw-detail"><strong>Mailing list</strong>' + (account.newsletter_opt_in ? 'Subscribed' : 'Not subscribed') + '</div>'
      + '<div class="alw-detail"><strong>Supporter updates</strong>' + (account.supporter_updates_opt_in ? 'Subscribed' : 'Not subscribed') + '</div>'
      + '<div class="alw-detail"><strong>Recorded logins</strong>' + esc(account.login_count || 0) + '</div>'
      + '<div class="alw-detail"><strong>Recorded events</strong>' + esc(account.event_count || 0) + '</div>'
      + '<div class="alw-detail"><strong>Last seen IP</strong>' + esc(account.last_seen_ip || 'Unavailable') + '</div>'
      + '<div class="alw-detail"><strong>Risk / support</strong>' + esc(account.risk_level || 'normal') + ' · ' + esc(account.support_status || 'none') + '</div>'
      + '<div class="alw-detail alw-detail-wide"><strong>Trials (' + trials.length + ')</strong>' + renderTrialRecords(trials) + '</div>'
      + '<div class="alw-detail alw-detail-wide"><strong>Licenses (' + licenses.length + ')</strong>' + renderLicenseRecords(licenses) + '</div>'
      + '<div class="alw-detail alw-detail-wide"><strong>Support / feedback (' + contacts.length + ')</strong>' + renderContactRecords(contacts) + '</div>'
      + '<div class="alw-detail alw-detail-wide"><strong>Risk signals (' + risks.length + ')</strong>' + renderRiskRecords(risks) + '</div>'
      + (account.owner_note ? '<div class="alw-detail alw-detail-wide"><strong>Owner note</strong>' + esc(account.owner_note) + '</div>' : '')
      + '</div>';
  }

  function renderTrialRecords(rows) {
    if (!rows.length) return '<div class="alw-mini">No trial records.</div>';
    return '<div class="alw-record-list">' + rows.map(function (r) {
      return '<div class="alw-record"><strong>' + esc(r.product_slug || 'Product') + '</strong><div class="alw-mini">Claimed ' + esc(fmtDate(r.claimed_at)) + ' · expires ' + esc(fmtDate(r.expires_at)) + '</div><div class="alw-mini">Device: ' + esc(r.device_hash ? 'bound' : 'not bound') + '</div></div>';
    }).join('') + '</div>';
  }
  function renderLicenseRecords(rows) {
    if (!rows.length) return '<div class="alw-mini">No paid license records.</div>';
    return '<div class="alw-record-list">' + rows.map(function (r) {
      return '<div class="alw-record"><strong>' + esc(r.product_slug || 'Product') + '</strong> ' + badge(r.status || 'unknown', r.status === 'active' ? 'owner' : 'unknown') + '<div class="alw-mini">Key hint: ' + esc(r.key_hint || 'Unavailable') + ' · device limit ' + esc(r.device_limit == null ? 'n/a' : r.device_limit) + '</div></div>';
    }).join('') + '</div>';
  }
  function renderContactRecords(rows) {
    if (!rows.length) return '<div class="alw-mini">No support, bug, or feedback records.</div>';
    return '<div class="alw-record-list">' + rows.map(function (r) {
      return '<div class="alw-record"><strong>' + esc((r.contact_type || 'contact').toUpperCase()) + ': ' + esc(r.subject || 'No subject') + '</strong><div class="alw-mini">' + esc(fmtDate(r.created_at)) + ' · ' + esc(r.status || 'new') + '</div><div>' + esc(r.message || '') + '</div></div>';
    }).join('') + '</div>';
  }
  function renderRiskRecords(rows) {
    if (!rows.length) return '<div class="alw-mini">No risk signals attached to this account.</div>';
    return '<div class="alw-record-list">' + rows.map(function (r) {
      return '<div class="alw-record ' + ((r.severity === 'high' || r.severity === 'critical') ? 'alw-risk-high' : '') + '"><strong>' + esc(r.signal_type || 'Risk signal') + '</strong> ' + badge(r.severity || 'medium', 'threat') + '<div class="alw-mini">' + esc(fmtDate(r.created_at)) + ' · ' + esc(r.status || 'open') + '</div></div>';
    }).join('') + '</div>';
  }

  function renderAccounts(payload) {
    const list = document.getElementById('user-directory-list');
    if (!list) return;
    const people = payload.people || [];
    if (!people.length) { list.innerHTML = empty('No Auth accounts exist.'); return; }
    list.innerHTML = people.map(function (p) {
      const status = p.is_owner ? badge('OWNER', 'owner') : badge('CUSTOMER', 'customer');
      const auth = p.is_anonymous ? badge('ANONYMOUS AUTH', 'unknown') : badge('EMAIL ACCOUNT', 'you');
      const risk = (p.risk_signals || []).length ? badge((p.risk_signals || []).length + ' RISK', 'threat') : '';
      return '<div class="data-item alw-account-row" data-alw-account="' + esc(p.user_id) + '"><div class="alw-account-head"><div><div class="alw-account-email">' + esc(p.email || 'No email') + '</div><div class="alw-mini">' + esc(p.display_name || 'No display name') + '</div></div><div class="alw-account-tags">' + status + auth + risk + '</div></div><div class="data-meta">Created ' + esc(fmtDate(p.account_created_at)) + ' · last sign-in ' + esc(fmtDate(p.last_sign_in_at)) + '</div><div class="data-meta">Mailing: ' + (p.newsletter_opt_in ? 'yes' : 'no') + ' · supporter updates: ' + (p.supporter_updates_opt_in ? 'yes' : 'no') + ' · trials: ' + (p.trials || []).length + ' · licenses: ' + (p.licenses || []).length + '</div></div>';
    }).join('');
    list.querySelectorAll('[data-alw-account]').forEach(function (row) {
      row.addEventListener('click', function () {
        const p = people.find(function (item) { return item.user_id === row.getAttribute('data-alw-account'); });
        if (p) openModal(p.email || 'Account', accountDetail(p));
      });
    });
  }

  function renderTraffic(payload) {
    const pages = document.getElementById('traffic-pages-list');
    const refs = document.getElementById('traffic-referrers-list');
    const traffic = payload.traffic || {};
    if (pages) pages.innerHTML = (traffic.top_pages || []).length ? traffic.top_pages.map(function (r) { return '<div class="data-item"><strong>' + esc(r.label) + '</strong><div class="data-meta">' + esc(r.count) + ' customer visit' + (Number(r.count) === 1 ? '' : 's') + '</div></div>'; }).join('') : empty('No customer page activity recorded in the last 30 days. Owner traffic is excluded.');
    if (refs) refs.innerHTML = (traffic.top_referrers || []).length ? traffic.top_referrers.map(function (r) { return '<div class="data-item"><strong>' + esc(r.label) + '</strong><div class="data-meta">' + esc(r.count) + ' referral' + (Number(r.count) === 1 ? '' : 's') + '</div></div>'; }).join('') : empty('No external customer referrers recorded in the last 30 days.');
    setStat('unique_visitors_30d', traffic.unique_visitors_30d || 0);
  }

  function identityHtml(identity) {
    if (!identity) return '<span class="alw-download-id">Unknown visitor</span>';
    if (identity.kind === 'account' || identity.kind === 'resolved_account') return '<span class="alw-download-id">' + esc(identity.email || 'Account') + '</span> ' + badge(identity.kind === 'resolved_account' ? 'RESOLVED FROM TOKEN' : 'ACCOUNT', 'customer');
    if (identity.kind === 'owner_account' || identity.kind === 'resolved_owner') return '<span class="alw-download-id">' + esc(identity.email || 'Owner') + '</span> ' + badge('OWNER', 'owner');
    if (identity.kind === 'shared_token') return '<span class="alw-download-id alw-shared">Shared browser token</span> ' + badge((identity.linked_accounts || []).length + ' ACCOUNTS', 'threat');
    return '<span class="alw-download-id">Anonymous visitor</span> ' + badge('NO ACCOUNT LINK', 'unknown');
  }

  function renderSecurity(payload) {
    const list = document.getElementById('security-event-list');
    if (!list) return;
    const rows = payload.security || [];
    if (!rows.length) {
      list.innerHTML = empty('No customer security warnings are currently recorded. Owner testing/activity is excluded.');
      return;
    }
    list.innerHTML = rows.map(function (r) {
      return '<div class="data-item"><strong>' + esc(r.event_type || 'security_event') + '</strong> ' + badge(r.severity || 'warning', 'threat') + '<div class="data-meta">' + identityHtml(r.identity) + '</div><div class="data-meta">' + esc(fmtDate(r.created_at)) + ' · ' + esc(r.page_path || '/') + '</div></div>';
    }).join('');
  }

  function addIntelligencePanels(payload) {
    let anchor = document.getElementById('traffic-referrers-list');
    if (!anchor) return;
    const grid = anchor.closest('.admin-grid');
    if (!grid || document.getElementById('alw-vault-enterprise-panels')) return;
    const wrap = document.createElement('div');
    wrap.id = 'alw-vault-enterprise-panels';
    wrap.className = 'admin-grid alw-risk-panel';
    wrap.innerHTML = '<div class="policy-shell"><span class="tag">Resolved downloads</span><h3>Account-linked download intelligence</h3><div class="data-list" id="alw-download-list"></div></div><div class="policy-shell"><span class="tag alt">Trial risk</span><h3>Potential circumvention signals</h3><div class="data-list" id="alw-risk-list"></div></div>';
    grid.insertAdjacentElement('afterend', wrap);
    renderDownloads(payload);
    renderRisk(payload);
  }

  function renderDownloads(payload) {
    const list = document.getElementById('alw-download-list');
    if (!list) return;
    const rows = payload.downloads || [];
    if (!rows.length) { list.innerHTML = empty('No product downloads recorded yet.'); return; }
    list.innerHTML = rows.slice(0,30).map(function (r) {
      const linked = r.identity && r.identity.kind === 'shared_token' ? '<div class="data-meta">Linked accounts: ' + esc((r.identity.linked_accounts || []).map(function (a) { return a.email; }).join(', ')) + '</div>' : '';
      return '<div class="data-item"><strong>' + esc(r.event_type || 'download') + '</strong><div class="data-meta">' + identityHtml(r.identity) + '</div>' + linked + '<div class="data-meta">' + esc(fmtDate(r.created_at)) + ' · token ' + esc(r.visitor_token || 'none') + '</div></div>';
    }).join('');
  }

  function renderRisk(payload) {
    const list = document.getElementById('alw-risk-list');
    if (!list) return;
    const rows = payload.risk_signals || [];
    if (!rows.length) { list.innerHTML = empty('No trial-circumvention signals recorded.'); return; }
    list.innerHTML = rows.map(function (r) {
      return '<div class="data-item ' + ((r.severity === 'high' || r.severity === 'critical') ? 'alw-risk-high' : '') + '"><strong>' + esc(r.signal_type || 'risk') + '</strong> ' + badge(r.severity || 'medium', 'threat') + '<div class="data-meta">' + esc(r.user_email || 'No direct account') + ' · ' + esc(r.product_slug || 'No product') + '</div><div class="data-meta">' + esc(fmtDate(r.created_at)) + ' · ' + esc(r.status || 'open') + '</div></div>';
    }).join('');
  }

  function wireMetricList(name, title, rows) {
    const metric = document.querySelector('[data-admin-stat="' + name + '"]');
    if (!metric || !metric.parentElement) return;
    metric.parentElement.classList.add('alw-clickable-metric');
    metric.parentElement.onclick = function () {
      const html = rows.length ? '<div class="alw-record-list">' + rows.map(function (r) {
        return '<div class="alw-record"><strong>' + esc(r.email || 'No email') + '</strong><div class="alw-mini">' + esc(r.display_name || 'No display name') + ' · ' + (r.is_owner ? 'owner' : 'customer') + '</div></div>';
      }).join('') + '</div>' : empty('No accounts in this list.');
      openModal(title, html);
    };
  }

  function addStatus(payload) {
    if (document.getElementById('alw-vault-status')) return;
    const target = document.querySelector('.snapshot-grid') || document.querySelector('.metric-grid');
    if (!target || !target.parentElement) return;
    const s = payload.account_summary || {};
    const bar = document.createElement('div');
    bar.id = 'alw-vault-status';
    bar.className = 'alw-vault-status';
    bar.innerHTML = '<div><strong>Enterprise data source active</strong><br><span>Auth accounts, customer analytics, licensing, contact intake, and risk intelligence are being resolved server-side.</span></div><div>' + badge((s.total || 0) + ' ACCOUNTS', 'you') + ' ' + badge((s.customers || 0) + ' CUSTOMERS', 'customer') + ' ' + badge((s.owners || 0) + ' OWNERS', 'owner') + ' ' + badge((s.anonymous_auth || 0) + ' ANON AUTH', 'unknown') + '</div>';
    target.parentElement.insertBefore(bar, target);
  }

  function apply(payload) {
    state.payload = payload;
    const core = payload.core || {};
    const acct = payload.account_summary || {};
    setStat('accounts_total', acct.total != null ? acct.total : core.accounts_total);
    setStat('accounts_unconfirmed', acct.unconfirmed || 0);
    setStat('accounts_attention', acct.needs_attention || 0);
    setStat('newsletter_opt_ins', core.newsletter_opt_ins || 0);
    setStat('supporter_updates_opt_ins', core.supporter_updates_opt_ins || 0);
    setStat('visits_24h', core.visits_24h || 0);
    setStat('visits_30d', core.visits_30d || 0);
    setStat('visits_all_time', core.visits_all_time || 0);
    setStat('logins_30d', core.logins_30d || 0);
    setStat('signups_30d', core.signups_30d || 0);
    renderAccounts(payload);
    renderTraffic(payload);
    renderSecurity(payload);
    addIntelligencePanels(payload);
    addStatus(payload);
    wireMetricList('newsletter_opt_ins', 'Mailing list accounts', payload.mailing_list || []);
    wireMetricList('supporter_updates_opt_ins', 'Supporter-update accounts', payload.supporter_list || []);

    const totalMetric = document.querySelector('[data-admin-stat="accounts_total"]');
    if (totalMetric && totalMetric.parentElement) {
      totalMetric.parentElement.classList.add('alw-clickable-metric');
      const label = totalMetric.parentElement.querySelector('span');
      if (label) label.textContent = 'Total accounts · ' + (acct.customers || 0) + ' customer / ' + (acct.owners || 0) + ' owner';
      totalMetric.parentElement.onclick = function () { openModal('All accounts', '<div class="alw-record-list">' + (payload.people || []).map(function (p) { return '<div class="alw-record alw-account-row" data-modal-account="' + esc(p.user_id) + '"><strong>' + esc(p.email || 'No email') + '</strong><div class="alw-mini">' + (p.is_owner ? 'Owner' : 'Customer') + ' · ' + (p.is_anonymous ? 'anonymous auth' : 'email account') + '</div></div>'; }).join('') + '</div>'); };
    }

    const mailMetric = document.querySelector('[data-admin-stat="newsletter_opt_ins"]');
    if (mailMetric && mailMetric.parentElement) {
      const label = mailMetric.parentElement.querySelector('span');
      if (label) label.textContent = 'Mailing list · ' + (core.customer_newsletter_opt_ins || 0) + ' customer';
    }
    const supMetric = document.querySelector('[data-admin-stat="supporter_updates_opt_ins"]');
    if (supMetric && supMetric.parentElement) {
      const label = supMetric.parentElement.querySelector('span');
      if (label) label.textContent = 'Supporter emails · ' + (core.customer_supporter_updates_opt_ins || 0) + ' customer';
    }
  }

  async function load() {
    ensureStyles();
    let client = window._averyVaultSupabase || null;
    for (let i = 0; i < 30 && !client; i += 1) {
      await new Promise(function (resolve) { setTimeout(resolve, 150); });
      client = window._averyVaultSupabase || null;
    }
    if (!client) return;
    try {
      const sessionResult = await client.auth.getSession();
      const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
      if (!session) return;
      const base = String(sbCfg.url || '').replace(/\/+$/, '');
      const response = await fetch(base + '/functions/v1/owner-vault-summary', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + session.access_token,
          'apikey': sbCfg.publishableKey || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ source: 'vault-enterprise.js', build: 'enterprise-v15' })
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.error || ('Vault service returned ' + response.status));
      apply(payload);
      window.setTimeout(function () { apply(payload); }, 2500);
    } catch (err) {
      const pages = document.getElementById('traffic-pages-list');
      const refs = document.getElementById('traffic-referrers-list');
      if (pages && /Loading/i.test(pages.textContent || '')) pages.innerHTML = empty('Traffic intelligence could not load: ' + (err.message || 'unknown error'));
      if (refs && /Loading/i.test(refs.textContent || '')) refs.innerHTML = empty('Discovery data could not load: ' + (err.message || 'unknown error'));
      console.error('Vault enterprise layer failed', err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
