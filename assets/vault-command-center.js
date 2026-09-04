/* Avery Logic Works enterprise owner command center */
(function () {
  'use strict';

  var cfg = window.AVERY_CONFIG || {};
  var supabaseCfg = cfg.supabase || {};
  var origin = window.location.origin;
  var client = null;
  var state = {
    pages: [], products: [], users: [], content: [], incidents: [], actions: [],
    selectedPage: '', selectedProduct: null, datasetRows: [], loaded: false
  };

  client = window._averyVaultSupabase || null;
  if (!client && window.supabase && supabaseCfg.url && supabaseCfg.publishableKey) {
    client = window.supabase.createClient(supabaseCfg.url, supabaseCfg.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  }

  function byId(id) { return document.getElementById(id); }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function setStatus(id, message, tone) {
    var node = byId(id); if (!node) return;
    node.textContent = message || '';
    node.className = 'command-status' + (tone ? ' ' + tone : '');
  }
  function money(cents, currency) {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(Number(cents || 0) / 100); }
    catch (_) { return '$' + (Number(cents || 0) / 100).toFixed(2); }
  }
  function downloadText(filename, content, type) {
    var blob = new Blob([content], { type: type || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function csvValue(value) {
    var text = value && typeof value === 'object' ? JSON.stringify(value) : String(value == null ? '' : value);
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function exportCsv(filename, rows) {
    if (!rows || !rows.length) return alert('There is no data to export.');
    var keys = Array.from(rows.reduce(function (set, row) {
      Object.keys(row || {}).forEach(function (key) { set.add(key); }); return set;
    }, new Set()));
    var csv = [keys.map(csvValue).join(',')].concat(rows.map(function (row) {
      return keys.map(function (key) { return csvValue(row[key]); }).join(',');
    })).join('\n');
    downloadText(filename, csv, 'text/csv;charset=utf-8');
  }
  function confirmAction(message) { return window.confirm(message); }

  document.querySelectorAll('[data-command-subtab]').forEach(function (button) {
    button.addEventListener('click', function () {
      document.querySelectorAll('[data-command-subtab]').forEach(function (item) { item.classList.remove('active'); });
      document.querySelectorAll('.command-panel').forEach(function (item) { item.classList.remove('active'); });
      button.classList.add('active');
      var panel = byId('command-panel-' + button.dataset.commandSubtab);
      if (panel) panel.classList.add('active');
    });
  });

  document.querySelectorAll('.vault-tab[data-tab="command"]').forEach(function (tab) {
    tab.addEventListener('click', function () { if (!state.loaded) loadCommandCenter(); });
  });

  async function requireOwner() {
    if (!client) throw new Error('Supabase is not available.');
    var sessionResponse = await client.auth.getSession();
    var session = sessionResponse && sessionResponse.data ? sessionResponse.data.session : null;
    if (!session) throw new Error('Owner sign-in is required.');
    var check = await client.from('site_admins').select('email').limit(1);
    if (check.error || !check.data || !check.data.length) throw new Error('This account is not authorized for owner controls.');
    return session;
  }

  async function loadCommandCenter() {
    setStatus('command-center-status', 'Loading owner tools and current website data…');
    try {
      await requireOwner();
      await Promise.all([loadPages(), loadProducts(), loadUsers(), loadSettings(), loadIncidents(), loadActionLog()]);
      state.loaded = true;
      updateKpis();
      setStatus('command-center-status', 'Command center ready.', 'ok');
    } catch (error) {
      setStatus('command-center-status', error.message || String(error), 'error');
    }
  }

  function updateKpis() {
    var published = state.content.filter(function (row) { return row.published; }).length;
    var drafts = state.content.filter(function (row) { return !row.published; }).length;
    var liveProducts = state.products.filter(function (row) { return row.published && ['live', 'trial'].includes(row.status); }).length;
    var openIncidents = state.incidents.filter(function (row) { return row.status !== 'resolved'; }).length;
    if (byId('command-kpi-pages')) byId('command-kpi-pages').textContent = state.pages.length;
    if (byId('command-kpi-products')) byId('command-kpi-products').textContent = liveProducts;
    if (byId('command-kpi-drafts')) byId('command-kpi-drafts').textContent = drafts;
    if (byId('command-kpi-incidents')) byId('command-kpi-incidents').textContent = openIncidents;
  }

  async function loadPages() {
    var pagesResp = await client.from('managed_pages').select('*').order('sort_order');
    if (pagesResp.error) throw pagesResp.error;
    var contentResp = await client.from('managed_page_content').select('*').order('updated_at', { ascending: false });
    if (contentResp.error) throw contentResp.error;
    state.pages = pagesResp.data || [];
    state.content = contentResp.data || [];
    var select = byId('command-page-select');
    if (select) {
      var selected = state.selectedPage || select.value || (state.pages[0] && state.pages[0].page_path) || '';
      select.innerHTML = state.pages.map(function (page) {
        return '<option value="' + escapeHtml(page.page_path) + '">' + escapeHtml(page.title) + '</option>';
      }).join('');
      select.value = selected;
      state.selectedPage = select.value;
    }
    renderPageChanges();
    updateKpis();
  }

  function loadPreview() {
    var select = byId('command-page-select'); var frame = byId('command-page-frame');
    if (!select || !frame || !select.value) return;
    state.selectedPage = select.value;
    frame.src = select.value + (select.value.includes('?') ? '&' : '?') + 'vault-editor=1&v=' + Date.now();
    renderPageChanges();
  }

  function startVisualPicker() {
    var frame = byId('command-page-frame');
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: 'alw-vault-editor-start' }, origin);
    setStatus('command-editor-status', 'Click any text, link, image, or section inside the preview.');
  }

  function previewSelectedChange() {
    var frame = byId('command-page-frame');
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage({
      type: 'alw-vault-editor-preview',
      selector: byId('command-content-selector').value,
      property: byId('command-content-property').value,
      value: byId('command-content-value').value
    }, origin);
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== origin || !event.data || event.data.type !== 'alw-vault-editor-selection') return;
    var data = event.data;
    byId('command-content-label').value = data.label || 'Page content';
    byId('command-content-selector').value = data.selector || '';
    byId('command-content-property').value = data.property || 'text';
    byId('command-content-value').value = data.value || '';
    setStatus('command-editor-status', 'Selected “' + (data.label || data.selector || 'page element') + '”. Edit the value, preview it, then save a draft or publish.');
  });

  async function saveContent(published) {
    var pagePath = byId('command-page-select').value;
    var selector = byId('command-content-selector').value.trim();
    var label = byId('command-content-label').value.trim();
    var property = byId('command-content-property').value;
    var value = byId('command-content-value').value;
    if (!pagePath || !selector || !label) return setStatus('command-editor-status', 'Choose an element from the preview first.', 'error');
    setStatus('command-editor-status', published ? 'Publishing change…' : 'Saving draft…');
    var result = await client.from('managed_page_content').upsert({
      page_path: pagePath, selector: selector, label: label, property: property, value: value, published: !!published
    }, { onConflict: 'page_path,selector,property' }).select().single();
    if (result.error) return setStatus('command-editor-status', result.error.message, 'error');
    setStatus('command-editor-status', published ? 'Published. The change is now live.' : 'Draft saved. It is not public yet.', 'ok');
    await loadPages();
    loadPreview();
  }

  function renderPageChanges() {
    var list = byId('command-page-change-list'); if (!list) return;
    var rows = state.content.filter(function (row) { return row.page_path === state.selectedPage; });
    if (!rows.length) { list.innerHTML = '<div class="editor-empty">No saved changes for this page yet.</div>'; return; }
    list.innerHTML = rows.map(function (row) {
      return '<div class="command-row" data-content-id="' + escapeHtml(row.id) + '"><div class="command-row-head"><div><strong>' + escapeHtml(row.label) + '</strong>'
        + '<div class="command-row-meta">Revision ' + Number(row.revision || 1) + ' · ' + escapeHtml(row.property) + ' · ' + escapeHtml(row.selector) + '</div></div>'
        + '<span class="command-pill ' + (row.published ? 'live' : 'draft') + '">' + (row.published ? 'Published' : 'Draft') + '</span></div>'
        + '<div class="command-row-meta">' + escapeHtml(String(row.value || '').slice(0, 180)) + '</div>'
        + '<div class="command-row-actions"><button class="quick-action" data-content-edit="' + escapeHtml(row.id) + '">Edit</button>'
        + '<button class="quick-action" data-content-toggle="' + escapeHtml(row.id) + '">' + (row.published ? 'Unpublish' : 'Publish') + '</button>'
        + '<button class="quick-action" data-content-revisions="' + escapeHtml(row.id) + '">History</button>'
        + '<button class="quick-action" data-content-delete="' + escapeHtml(row.id) + '">Remove override</button></div></div>';
    }).join('');
  }

  async function showRevisions(contentId) {
    var response = await client.from('content_revisions').select('*').eq('content_id', contentId).order('changed_at', { ascending: false }).limit(30);
    var list = byId('command-revision-list');
    if (response.error) { list.innerHTML = '<div class="editor-empty">' + escapeHtml(response.error.message) + '</div>'; return; }
    var rows = response.data || [];
    list.innerHTML = rows.length ? rows.map(function (row) {
      return '<div class="command-row"><strong>Revision ' + row.revision + '</strong><div class="command-row-meta">'
        + escapeHtml(new Date(row.changed_at).toLocaleString()) + ' · ' + (row.published ? 'Published' : 'Draft') + '</div>'
        + '<div class="command-row-meta">' + escapeHtml(String(row.value || '').slice(0, 180)) + '</div>'
        + '<button class="quick-action" data-revision-restore="' + row.id + '">Restore this version</button></div>';
    }).join('') : '<div class="editor-empty">No earlier versions are recorded yet.</div>';
  }

  async function loadProducts() {
    var response = await client.from('product_catalog').select('*').order('product_name');
    if (response.error) throw response.error;
    state.products = response.data || [];
    renderProducts();
    updateKpis();
  }

  function renderProducts() {
    var list = byId('command-product-list'); if (!list) return;
    list.innerHTML = state.products.length ? state.products.map(function (product) {
      return '<div class="command-row"><div class="command-row-head"><div><strong>' + escapeHtml(product.product_name) + '</strong>'
        + '<div class="command-row-meta">' + escapeHtml(product.slug) + ' · ' + money(product.price_cents, product.currency) + ' · '
        + Number(product.trial_days || 0) + '-day trial</div></div><span class="command-pill ' + escapeHtml(product.status) + '">' + escapeHtml(product.status) + '</span></div>'
        + '<p>' + escapeHtml(product.short_description) + '</p><div class="command-row-actions">'
        + '<button class="quick-action" data-product-edit="' + escapeHtml(product.slug) + '">Edit product</button>'
        + (product.info_url ? '<a class="quick-action" href="' + escapeHtml(product.info_url) + '" target="_blank" rel="noopener">Open page</a>' : '')
        + '</div></div>';
    }).join('') : '<div class="editor-empty">No products have been added.</div>';
  }

  function editProduct(slug) {
    var product = state.products.find(function (row) { return row.slug === slug; }) || {
      slug: '', product_name: '', short_description: '', full_description: '', status: 'draft', published: false,
      price_cents: 0, currency: 'USD', billing_model: 'one_time', trial_days: 0, version: '', release_channel: 'stable',
      info_url: '', purchase_url: '', download_url: '', support_url: 'support.html', terms_url: 'terms.html', privacy_url: 'privacy.html', featured: false
    };
    state.selectedProduct = product;
    Object.keys(product).forEach(function (key) {
      var input = byId('product-' + key.replace(/_/g, '-')); if (!input) return;
      if (input.type === 'checkbox') input.checked = !!product[key];
      else input.value = product[key] == null ? '' : product[key];
    });
    byId('product-slug').disabled = !!slug;
    setStatus('command-product-status', slug ? 'Editing ' + product.product_name + '.' : 'Creating a new product.');
  }

  async function saveProduct() {
    var slug = byId('product-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    var name = byId('product-product-name').value.trim();
    if (!slug || !name) return setStatus('command-product-status', 'A product name and short slug are required.', 'error');
    var record = {
      slug: slug, product_name: name,
      short_description: byId('product-short-description').value.trim(),
      full_description: byId('product-full-description').value.trim(),
      status: byId('product-status').value, published: byId('product-published').checked,
      price_cents: Math.round(Number(byId('product-price').value || 0) * 100),
      currency: byId('product-currency').value.trim().toUpperCase() || 'USD',
      billing_model: byId('product-billing-model').value,
      trial_days: Math.max(0, Number(byId('product-trial-days').value || 0)),
      version: byId('product-version').value.trim(), release_channel: byId('product-release-channel').value,
      info_url: byId('product-info-url').value.trim(), purchase_url: byId('product-purchase-url').value.trim(),
      download_url: byId('product-download-url').value.trim(), support_url: byId('product-support-url').value.trim(),
      terms_url: byId('product-terms-url').value.trim(), privacy_url: byId('product-privacy-url').value.trim(),
      featured: byId('product-featured').checked
    };
    if (record.published && !confirmAction('Publish these product details now?')) return;
    var result = await client.from('product_catalog').upsert(record).select().single();
    if (result.error) return setStatus('command-product-status', result.error.message, 'error');
    setStatus('command-product-status', 'Product saved.', 'ok');
    await loadProducts(); editProduct(result.data.slug);
  }

  async function loadUsers() {
    var response = await client.from('user_operator_profiles').select('user_id,email,display_name,account_created_at,last_sign_in_at,last_seen_ip,risk_level,needs_attention,support_status').order('account_created_at', { ascending: false }).limit(1000);
    if (response.error) throw response.error;
    state.users = response.data || [];
    renderBulkUsers();
  }

  function renderBulkUsers() {
    var list = byId('command-bulk-user-list'); if (!list) return;
    var query = (byId('command-bulk-user-search') && byId('command-bulk-user-search').value || '').toLowerCase();
    var rows = state.users.filter(function (user) {
      return !query || (user.email || '').toLowerCase().includes(query) || (user.display_name || '').toLowerCase().includes(query);
    });
    list.innerHTML = rows.length ? rows.map(function (user) {
      return '<label class="selection-row"><input type="checkbox" data-bulk-user="' + escapeHtml(user.user_id) + '"><span><strong>'
        + escapeHtml(user.display_name || user.email || 'Unnamed account') + '</strong><span class="command-row-meta" style="display:block;">'
        + escapeHtml(user.email || 'No email') + ' · ' + escapeHtml(user.risk_level) + ' · ' + escapeHtml(user.support_status)
        + (user.needs_attention ? ' · needs attention' : '') + '</span></span></label>';
    }).join('') : '<div class="editor-empty">No matching users.</div>';
    updateSelectedUserCount();
  }

  function selectedUserIds() {
    return Array.from(document.querySelectorAll('[data-bulk-user]:checked')).map(function (input) { return input.dataset.bulkUser; });
  }
  function updateSelectedUserCount() {
    if (byId('command-selected-user-count')) byId('command-selected-user-count').textContent = selectedUserIds().length + ' selected';
  }

  async function applyBulkUsers() {
    var ids = selectedUserIds();
    if (!ids.length) return setStatus('command-bulk-status', 'Select at least one user.', 'error');
    var risk = byId('command-bulk-risk').value || null;
    var support = byId('command-bulk-support').value || null;
    var attentionRaw = byId('command-bulk-attention').value;
    var attention = attentionRaw === '' ? null : attentionRaw === 'true';
    if (risk === null && support === null && attention === null) return setStatus('command-bulk-status', 'Choose at least one change.', 'error');
    if (!confirmAction('Apply these changes to ' + ids.length + ' selected user account' + (ids.length === 1 ? '' : 's') + '?')) return;
    var response = await client.rpc('owner_bulk_update_users', {
      target_user_ids: ids, new_risk_level: risk, new_support_status: support, new_needs_attention: attention
    });
    if (response.error) return setStatus('command-bulk-status', response.error.message, 'error');
    setStatus('command-bulk-status', 'Updated ' + Number(response.data || ids.length) + ' user records.', 'ok');
    await loadUsers(); await loadActionLog();
  }

  async function loadSettings() {
    var response = await client.from('platform_settings').select('*');
    if (response.error) throw response.error;
    var map = Object.fromEntries((response.data || []).map(function (row) { return [row.key, row.value || {}]; }));
    var banner = map.site_banner || {}; var maintenance = map.maintenance_mode || {}; var analytics = map.analytics || {};
    byId('setting-banner-enabled').checked = !!banner.enabled;
    byId('setting-banner-message').value = banner.message || '';
    byId('setting-banner-tone').value = banner.tone || 'info';
    byId('setting-maintenance-enabled').checked = !!maintenance.enabled;
    byId('setting-maintenance-message').value = maintenance.message || '';
    byId('setting-analytics-enabled').checked = analytics.enabled !== false;
  }

  async function saveSettings() {
    var maintenanceOn = byId('setting-maintenance-enabled').checked;
    if (maintenanceOn && !confirmAction('Turn on maintenance mode? Visitors will see a maintenance notice. The Vault will stay available.')) return;
    var rows = [
      { key: 'site_banner', value: { enabled: byId('setting-banner-enabled').checked, message: byId('setting-banner-message').value.trim(), tone: byId('setting-banner-tone').value }, description: 'Public announcement banner shown across the website.', public_read: true },
      { key: 'maintenance_mode', value: { enabled: maintenanceOn, message: byId('setting-maintenance-message').value.trim() }, description: 'Public maintenance notice. Owner Vault remains available.', public_read: true },
      { key: 'analytics', value: { enabled: byId('setting-analytics-enabled').checked }, description: 'Controls first-party website analytics collection.', public_read: true }
    ];
    var response = await client.from('platform_settings').upsert(rows);
    if (response.error) return setStatus('command-setting-status', response.error.message, 'error');
    setStatus('command-setting-status', 'Site controls saved.', 'ok'); await loadActionLog();
  }

  async function loadIncidents() {
    var response = await client.from('site_incidents').select('*').order('updated_at', { ascending: false }).limit(100);
    if (response.error) throw response.error;
    state.incidents = response.data || [];
    renderIncidents(); updateKpis();
  }

  function renderIncidents() {
    var list = byId('command-incident-list'); if (!list) return;
    list.innerHTML = state.incidents.length ? state.incidents.map(function (row) {
      return '<div class="command-row"><div class="command-row-head"><div><strong>' + escapeHtml(row.title) + '</strong>'
        + '<div class="command-row-meta">' + escapeHtml(row.affected_area || 'General') + ' · ' + escapeHtml(new Date(row.opened_at).toLocaleString()) + '</div></div>'
        + '<span class="command-pill ' + escapeHtml(row.status === 'resolved' ? 'resolved' : row.severity) + '">' + escapeHtml(row.status) + '</span></div>'
        + '<p>' + escapeHtml(row.description) + '</p><div class="command-row-actions">'
        + (row.status !== 'resolved' ? '<button class="quick-action" data-incident-status="' + escapeHtml(row.id) + '" data-status="monitoring">Mark monitoring</button><button class="quick-action" data-incident-status="' + escapeHtml(row.id) + '" data-status="resolved">Resolve</button>' : '')
        + '</div></div>';
    }).join('') : '<div class="editor-empty">No incidents are recorded.</div>';
  }

  async function createIncident() {
    var title = byId('incident-title').value.trim();
    if (!title) return setStatus('command-incident-status', 'Enter an incident title.', 'error');
    var record = {
      title: title, description: byId('incident-description').value.trim(), severity: byId('incident-severity').value,
      affected_area: byId('incident-area').value.trim(), status: 'open'
    };
    var response = await client.from('site_incidents').insert(record);
    if (response.error) return setStatus('command-incident-status', response.error.message, 'error');
    byId('incident-title').value = ''; byId('incident-description').value = ''; byId('incident-area').value = '';
    setStatus('command-incident-status', 'Incident recorded.', 'ok'); await loadIncidents(); await loadActionLog();
  }

  async function setIncidentStatus(id, status) {
    var patch = { status: status };
    if (status === 'resolved') patch.resolved_at = new Date().toISOString();
    var response = await client.from('site_incidents').update(patch).eq('id', id);
    if (response.error) return alert(response.error.message);
    await loadIncidents(); await loadActionLog();
  }

  async function loadActionLog() {
    var response = await client.from('owner_action_log').select('*').order('created_at', { ascending: false }).limit(100);
    if (response.error) throw response.error;
    state.actions = response.data || [];
    var list = byId('command-action-list'); if (!list) return;
    list.innerHTML = state.actions.length ? state.actions.map(function (row) {
      return '<div class="command-row"><strong>' + escapeHtml(row.summary || row.action) + '</strong>'
        + '<div class="command-row-meta">' + escapeHtml(row.actor_email || 'Owner') + ' · ' + escapeHtml(new Date(row.created_at).toLocaleString())
        + ' · ' + escapeHtml(row.entity_type) + (row.entity_id ? ' · ' + escapeHtml(row.entity_id) : '') + '</div></div>';
    }).join('') : '<div class="editor-empty">No owner changes are recorded yet.</div>';
  }

  var datasets = {
    users: { table: 'user_operator_profiles', columns: 'user_id,email,display_name,account_created_at,email_confirmed_at,last_sign_in_at,first_seen_ip,last_seen_ip,login_count,event_count,risk_level,needs_attention,support_status,owner_note,updated_at', order: 'updated_at' },
    traffic: { table: 'site_events', columns: 'id,event_type,page_path,visitor_token,user_id,user_email,metadata,created_at', order: 'created_at' },
    security: { table: 'security_events', columns: 'id,event_type,severity,page_path,user_email,attempted_email,ip_address,user_agent,referrer,metadata,created_at', order: 'created_at' },
    sales: { table: 'purchase_audit_log', columns: 'id,customer_email,customer_name,purchase_kind,purchase_category,payment_status,amount_cents,currency,source_page,visitor_token,summary,created_at', order: 'created_at' },
    licenses: { table: 'software_licenses', columns: 'id,product_slug,customer_user_id,customer_email,license_label,key_hint,status,seats,device_limit,issued_at,expires_at,owner_note,created_at,updated_at', order: 'updated_at' },
    trial_licenses: { table: 'trial_keys', columns: 'id,user_id,user_email,license_key,tier,claimed_at,expires_at,created_at', order: 'created_at' },
    inquiries: { table: 'enterprise_inquiries', columns: 'id,name,email,company,phone,team_size,use_case,use_case_examples,budget_range,timeline,status,owner_reply,replied_at,created_at', order: 'created_at' },
    requests: { table: 'service_requests', columns: 'request_id,customer_name,customer_email,subject,details,tier_key,tier_label,quoted_price_cents,status,ip_address,created_at,updated_at', order: 'created_at' },
    products: { table: 'product_catalog', columns: '*', order: 'updated_at' },
    content: { table: 'managed_page_content', columns: '*', order: 'updated_at' },
    changes: { table: 'owner_action_log', columns: '*', order: 'created_at' },
    incidents: { table: 'site_incidents', columns: '*', order: 'updated_at' }
  };

  async function loadDataset() {
    var key = byId('command-dataset-select').value; var config = datasets[key];
    if (!config) return;
    setStatus('command-dataset-status', 'Loading data…');
    var response = await client.from(config.table).select(config.columns).order(config.order, { ascending: false }).limit(1000);
    if (response.error) { state.datasetRows = []; renderDataset([]); return setStatus('command-dataset-status', response.error.message, 'error'); }
    state.datasetRows = response.data || []; renderDataset(state.datasetRows);
    setStatus('command-dataset-status', state.datasetRows.length + ' rows loaded.', 'ok');
  }

  function renderDataset(rows) {
    var table = byId('command-dataset-table'); if (!table) return;
    if (!rows.length) { table.innerHTML = '<tbody><tr><td>No rows found.</td></tr></tbody>'; return; }
    var keys = Array.from(rows.slice(0, 100).reduce(function (set, row) { Object.keys(row).forEach(function (key) { set.add(key); }); return set; }, new Set()));
    table.innerHTML = '<thead><tr>' + keys.map(function (key) { return '<th>' + escapeHtml(key) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + rows.map(function (row) { return '<tr>' + keys.map(function (key) {
        var value = row[key]; if (value && typeof value === 'object') value = JSON.stringify(value);
        return '<td>' + escapeHtml(String(value == null ? '' : value).slice(0, 500)) + '</td>';
      }).join('') + '</tr>'; }).join('') + '</tbody>';
  }

  function buildSearchIndex() {
    var items = [];
    state.pages.forEach(function (row) { items.push({ type: 'Page', title: row.title, detail: row.page_path, tab: 'website' }); });
    state.products.forEach(function (row) { items.push({ type: 'Product', title: row.product_name, detail: row.slug + ' · ' + row.status, tab: 'products', slug: row.slug }); });
    state.users.forEach(function (row) { items.push({ type: 'User', title: row.display_name || row.email, detail: row.email || '', tab: 'people' }); });
    state.incidents.forEach(function (row) { items.push({ type: 'Incident', title: row.title, detail: row.status + ' · ' + row.affected_area, tab: 'operations' }); });
    return items;
  }

  function runGlobalSearch() {
    var input = byId('command-global-search'); var results = byId('command-search-results');
    var query = (input.value || '').trim().toLowerCase();
    if (!query) { results.classList.remove('show'); results.innerHTML = ''; return; }
    var matches = buildSearchIndex().filter(function (item) {
      return (item.type + ' ' + item.title + ' ' + item.detail).toLowerCase().includes(query);
    }).slice(0, 30);
    results.innerHTML = matches.length ? matches.map(function (item, index) {
      return '<div class="search-result" data-search-index="' + index + '"><strong>' + escapeHtml(item.type + ': ' + item.title) + '</strong>'
        + '<div class="command-row-meta">' + escapeHtml(item.detail) + '</div></div>';
    }).join('') : '<div class="search-result">No matching pages, products, users, or incidents.</div>';
    results.classList.add('show'); results._matches = matches;
  }

  function openSearchResult(index) {
    var results = byId('command-search-results'); var item = results._matches && results._matches[index]; if (!item) return;
    var tab = document.querySelector('[data-command-subtab="' + item.tab + '"]'); if (tab) tab.click();
    if (item.tab === 'website') { byId('command-page-select').value = item.detail; loadPreview(); }
    if (item.slug) editProduct(item.slug);
    results.classList.remove('show');
  }

  byId('command-page-select')?.addEventListener('change', loadPreview);
  byId('command-load-preview')?.addEventListener('click', loadPreview);
  byId('command-start-picker')?.addEventListener('click', startVisualPicker);
  byId('command-preview-change')?.addEventListener('click', previewSelectedChange);
  byId('command-save-draft')?.addEventListener('click', function () { saveContent(false); });
  byId('command-publish-change')?.addEventListener('click', function () { saveContent(true); });
  byId('command-refresh-all')?.addEventListener('click', loadCommandCenter);
  byId('command-new-product')?.addEventListener('click', function () { editProduct(''); });
  byId('command-save-product')?.addEventListener('click', saveProduct);
  byId('command-bulk-user-search')?.addEventListener('input', renderBulkUsers);
  byId('command-bulk-user-list')?.addEventListener('change', updateSelectedUserCount);
  byId('command-select-all-users')?.addEventListener('click', function () {
    document.querySelectorAll('[data-bulk-user]').forEach(function (input) { input.checked = true; }); updateSelectedUserCount();
  });
  byId('command-clear-users')?.addEventListener('click', function () {
    document.querySelectorAll('[data-bulk-user]').forEach(function (input) { input.checked = false; }); updateSelectedUserCount();
  });
  byId('command-apply-bulk-users')?.addEventListener('click', applyBulkUsers);
  byId('command-export-users')?.addEventListener('click', function () {
    var ids = selectedUserIds(); var rows = ids.length ? state.users.filter(function (user) { return ids.includes(user.user_id); }) : state.users;
    exportCsv('avery-users-' + new Date().toISOString().slice(0, 10) + '.csv', rows);
  });
  byId('command-save-settings')?.addEventListener('click', saveSettings);
  byId('command-create-incident')?.addEventListener('click', createIncident);
  byId('command-load-dataset')?.addEventListener('click', loadDataset);
  byId('command-export-dataset')?.addEventListener('click', function () {
    exportCsv('avery-' + byId('command-dataset-select').value + '-' + new Date().toISOString().slice(0, 10) + '.csv', state.datasetRows);
  });
  byId('command-global-search')?.addEventListener('input', runGlobalSearch);
  byId('command-search-results')?.addEventListener('click', function (event) {
    var row = event.target.closest('[data-search-index]'); if (row) openSearchResult(Number(row.dataset.searchIndex));
  });

  byId('command-product-list')?.addEventListener('click', function (event) {
    var button = event.target.closest('[data-product-edit]'); if (button) editProduct(button.dataset.productEdit);
  });

  byId('command-page-change-list')?.addEventListener('click', async function (event) {
    var edit = event.target.closest('[data-content-edit]');
    var toggle = event.target.closest('[data-content-toggle]');
    var revisions = event.target.closest('[data-content-revisions]');
    var remove = event.target.closest('[data-content-delete]');
    var id = (edit || toggle || revisions || remove)?.getAttribute(edit ? 'data-content-edit' : toggle ? 'data-content-toggle' : revisions ? 'data-content-revisions' : 'data-content-delete');
    var row = state.content.find(function (item) { return item.id === id; }); if (!row) return;
    if (edit) {
      byId('command-content-label').value = row.label; byId('command-content-selector').value = row.selector;
      byId('command-content-property').value = row.property; byId('command-content-value').value = row.value;
      setStatus('command-editor-status', 'Editing ' + row.label + '.');
    }
    if (toggle) {
      if (!confirmAction((row.published ? 'Unpublish' : 'Publish') + ' “' + row.label + '”?')) return;
      var result = await client.from('managed_page_content').update({ published: !row.published }).eq('id', row.id);
      if (result.error) alert(result.error.message); else { await loadPages(); loadPreview(); }
    }
    if (revisions) showRevisions(row.id);
    if (remove) {
      if (!confirmAction('Remove this page override? The original page content will return. A historical revision will be retained.')) return;
      var deleted = await client.from('managed_page_content').delete().eq('id', row.id);
      if (deleted.error) alert(deleted.error.message); else { await loadPages(); loadPreview(); }
    }
  });

  byId('command-revision-list')?.addEventListener('click', async function (event) {
    var button = event.target.closest('[data-revision-restore]'); if (!button) return;
    if (!confirmAction('Restore this earlier version? The current version will remain in history.')) return;
    var response = await client.rpc('owner_restore_content_revision', { revision_id: Number(button.dataset.revisionRestore) });
    if (response.error) alert(response.error.message); else { await loadPages(); loadPreview(); showRevisions(response.data); }
  });

  byId('command-incident-list')?.addEventListener('click', function (event) {
    var button = event.target.closest('[data-incident-status]'); if (button) setIncidentStatus(button.dataset.incidentStatus, button.dataset.status);
  });

  document.addEventListener('click', function (event) {
    if (!event.target.closest('.command-search-wrap')) byId('command-search-results')?.classList.remove('show');
  });
}());