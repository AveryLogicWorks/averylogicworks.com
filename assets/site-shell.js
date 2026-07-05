(function () {
  'use strict';

  var YOUTUBE_URL = 'https://www.youtube.com/watch?v=IakQBx4rgks';

  var NAV_ITEMS = [
    { label: 'Home', href: 'index.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>' },
    { label: 'Command Nexus', href: 'command-nexus.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h6v6H9z"/></svg>' },
    { label: 'Founder', href: 'founder.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>' },
    { label: 'Themis', href: 'themis.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M5 8l7-5 7 5M4 12h16M6 16l6 4 6-4"/></svg>' },
    { label: 'Buyable Programs', href: 'programs.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7l-8-4-8 4 8 4 8-4zM4 7v10l8 4 8-4V7"/></svg>' },
    { label: 'Feedback', href: 'feedback.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' },
    { label: 'Support', href: 'support.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4M12 17h.01"/></svg>' },
  ];

  var AUTH_ITEMS = [
    { label: 'Sign in', href: 'login.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>', authOnly: false },
    { label: 'Sign up', href: 'signup.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6"/></svg>', authOnly: false },
  ];

  function getCurrentPage() {
    return (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }

  function buildSidebarHTML() {
    var current = getCurrentPage();

    var html = '<div class="sidebar" id="alw-sidebar">';
    html += '<button class="sidebar-toggle" id="alw-sidebar-toggle" aria-label="Toggle sidebar">&#x2039;</button>';
    html += '<div class="sidebar-header">';
    html += '<a class="sidebar-brand" href="index.html">';
    html += '<img src="assets/favicon.svg" alt="Avery Logic Works" />';
    html += '<span>Avery Logic Works&trade;</span>';
    html += '</a>';
    html += '</div>';
    html += '<nav class="sidebar-nav">';
    html += '<div class="sidebar-section-label">Navigation</div>';
    NAV_ITEMS.forEach(function (item) {
      var active = isActive(item.href, current);
      html += '<a class="sidebar-item' + (active ? ' active' : '') + '" href="' + item.href + '">';
      html += '<span class="sidebar-icon">' + item.icon + '</span>';
      html += '<span>' + item.label + '</span>';
      html += '</a>';
    });
    html += '<div class="sidebar-divider"></div>';
    html += '<div class="sidebar-section-label">Account</div>';
    html += '<div id="alw-auth-items">';
    AUTH_ITEMS.forEach(function (item) {
      var active = isActive(item.href, current);
      html += '<a class="sidebar-item' + (active ? ' active' : '') + '" href="' + item.href + '" data-auth-nav="' + item.label.toLowerCase().replace(/\s/g, '-') + '">';
      html += '<span class="sidebar-icon">' + item.icon + '</span>';
      html += '<span>' + item.label + '</span>';
      html += '</a>';
    });
    html += '</div>';
    html += '<div class="sidebar-divider"></div>';
    html += '<a class="sidebar-item sidebar-donate" href="index.html#donation-options"><span class="sidebar-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></span><span>Donate</span></a>';
    html += '<div class="sidebar-divider"></div>';
    html += '<a class="sidebar-item" href="' + YOUTUBE_URL + '" target="_blank" rel="noopener noreferrer"><span class="sidebar-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.42a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg></span><span>YouTube</span></a>';
    html += '</nav>';
    html += '<div class="sidebar-footer"><button class="theme-toggle" id="alw-theme-toggle" aria-label="Toggle theme"><span class="theme-icon" id="alw-theme-icon">&#9790;</span><span id="alw-theme-label">Dark mode</span></button></div>';
    html += '</div><div class="sidebar-overlay" id="alw-sidebar-overlay"></div>';
    return html;
  }

  function isActive(href, current) {
    var normalized = href.split('/').pop().toLowerCase();
    if (normalized === current) return true;
    if (current === 'index.html' && href === 'index.html') return true;
    if (href.indexOf('#') !== -1) {
      var parts = href.split('#');
      if (parts[0] === current || (parts[0] === '' && current === 'index.html')) return false;
    }
    return false;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('alw-theme', theme);
    var icon = document.getElementById('alw-theme-icon');
    var label = document.getElementById('alw-theme-label');
    if (icon && label) {
      if (theme === 'light') { icon.textContent = '\u2600'; label.textContent = 'Light mode'; }
      else { icon.textContent = '\u263E'; label.textContent = 'Dark mode'; }
    }
  }

  function toggleTheme() { applyTheme((document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark'); }

  function toggleSidebar() {
    var sidebar = document.getElementById('alw-sidebar');
    var main = document.querySelector('.main-content');
    if (!sidebar) return;
    var isMobile = window.innerWidth <= 768;
    if (isMobile) { var isOpen = sidebar.classList.toggle('open'); document.body.classList.toggle('sidebar-open', isOpen); }
    else { var collapsed = sidebar.classList.toggle('collapsed'); if (main) main.classList.toggle('sidebar-collapsed', collapsed); localStorage.setItem('alw-sidebar-collapsed', collapsed ? '1' : '0'); var toggleBtn = document.getElementById('alw-sidebar-toggle'); if (toggleBtn) toggleBtn.textContent = collapsed ? '\u203A' : '\u2039'; }
  }

  function closeMobileSidebar() { var sidebar = document.getElementById('alw-sidebar'); if (sidebar) sidebar.classList.remove('open'); document.body.classList.remove('sidebar-open'); }

  function injectShell() {
    if (document.getElementById('alw-sidebar')) return;
    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildSidebarHTML();
    var sidebar = wrapper.querySelector('.sidebar');
    var overlay = wrapper.querySelector('.sidebar-overlay');
    document.body.insertBefore(sidebar, document.body.firstChild);
    document.body.insertBefore(overlay, sidebar.nextSibling);
    var main = document.querySelector('main');
    if (main && !main.classList.contains('main-content')) main.classList.add('main-content');
    var collapsed = localStorage.getItem('alw-sidebar-collapsed') === '1';
    if (collapsed && window.innerWidth > 768) { sidebar.classList.add('collapsed'); if (main) main.classList.add('sidebar-collapsed'); var tb = document.getElementById('alw-sidebar-toggle'); if (tb) tb.textContent = '\u203A'; }
    var mobileToggle = document.createElement('button');
    mobileToggle.className = 'mobile-nav-toggle'; mobileToggle.id = 'alw-mobile-toggle'; mobileToggle.setAttribute('aria-label', 'Open menu'); mobileToggle.innerHTML = '&#9776;';
    mobileToggle.addEventListener('click', function () { var sb = document.getElementById('alw-sidebar'); if (sb) { var isOpen = sb.classList.toggle('open'); document.body.classList.toggle('sidebar-open', isOpen); } });
    document.body.insertBefore(mobileToggle, sidebar);
    var toggleBtn = document.getElementById('alw-sidebar-toggle'); if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);
    var overlayEl = document.getElementById('alw-sidebar-overlay'); if (overlayEl) overlayEl.addEventListener('click', closeMobileSidebar);
    var themeToggleBtn = document.getElementById('alw-theme-toggle'); if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    applyTheme(localStorage.getItem('alw-theme') || 'dark');
    removeOldNav();
  }

  function removeOldNav() {
    document.querySelectorAll('.site-nav, .site-header, nav.site-nav, nav:not(.sidebar-nav)').forEach(function (nav) {
      if (nav.id === 'alw-sidebar' || nav.classList.contains('sidebar-nav')) return;
      if (nav.closest('.sidebar')) return;
      nav.remove();
    });
  }

  async function updateAuthNav() {
    var cfg = window.AVERY_CONFIG || {};
    var supabaseCfg = cfg.supabase || {};
    var sb = null;
    if (supabaseCfg.url && supabaseCfg.publishableKey && window.supabase) { try { sb = window.supabase.createClient(supabaseCfg.url, supabaseCfg.publishableKey); } catch (e) { sb = null; } }
    var authContainer = document.getElementById('alw-auth-items');
    if (!authContainer) return;
    var session = sb ? (await sb.auth.getSession())?.data?.session : null;
    if (session) {
      authContainer.innerHTML = '';
      var paths = (cfg.paths || {});
      var accountHref = paths.account || 'account.html';
      var accountItem = document.createElement('a');
      accountItem.className = 'sidebar-item'; accountItem.href = accountHref;
      accountItem.innerHTML = '<span class="sidebar-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span><span>Account</span>';
      if (isActive(accountHref, getCurrentPage())) accountItem.classList.add('active');
      authContainer.appendChild(accountItem);
      var signOutItem = document.createElement('button');
      signOutItem.className = 'sidebar-item'; signOutItem.style.cssText = 'background:none;border:none;width:100%;cursor:pointer;font:inherit;text-align:left;';
      signOutItem.innerHTML = '<span class="sidebar-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg></span><span>Log out</span>';
      signOutItem.addEventListener('click', async function () { if (sb) await sb.auth.signOut(); window.location.href = paths.login || 'login.html'; });
      authContainer.appendChild(signOutItem);
    }
  }

  function injectCommandNexusPromoBoxes() {
    if (getCurrentPage() !== 'command-nexus.html') return;
    document.querySelectorAll('[data-cn-link]').forEach(function (link) {
      if (link.getAttribute('data-promo-ui-added') === '1') return;
      link.setAttribute('data-promo-ui-added', '1');
      var box = document.createElement('div');
      box.style.cssText = 'margin:.75rem 0 1rem;padding:1rem;border:1px solid rgba(125,211,252,.28);border-radius:16px;background:rgba(125,211,252,.08);display:grid;gap:.65rem;';
      box.innerHTML = '<label style="font-weight:800;display:block;">Promo code</label><div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;"><input type="text" placeholder="Enter promo code" autocomplete="off" style="flex:1;min-width:160px;padding:.78rem 1rem;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.18);color:inherit;font:inherit;text-transform:uppercase;"><button type="button" class="button">Apply code</button></div><p class="soft" style="margin:0;font-size:.86rem;">New customers can use BACK25 for 25% off one purchase of any one product.</p><p data-msg style="margin:0;font-size:.88rem;font-weight:800;"></p>';
      var input = box.querySelector('input');
      var btn = box.querySelector('button');
      var msg = box.querySelector('[data-msg]');
      btn.addEventListener('click', function () {
        var code = String(input.value || '').trim().toUpperCase();
        input.value = code;
        if (code === 'BACK25') { msg.textContent = 'BACK25 applied: 25% off for new customers.'; msg.style.color = 'var(--accent)'; link.setAttribute('data-promo-applied', 'BACK25'); }
        else { msg.textContent = code ? 'That promo code is not valid.' : 'Enter BACK25 to apply the new-customer discount.'; msg.style.color = '#facc15'; link.removeAttribute('data-promo-applied'); }
      });
      link.parentNode.insertBefore(box, link);
    });
  }

  function init() {
    injectShell();
    updateAuthNav();
    setTimeout(injectCommandNexusPromoBoxes, 100);
    setTimeout(injectCommandNexusPromoBoxes, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();