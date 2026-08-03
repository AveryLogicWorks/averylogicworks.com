(function () {
  'use strict';

  var MENU_ID = 'alw-emergency-dropdown-nav';
  var STYLE_ID = 'alw-emergency-dropdown-style';

  var NAV_ITEMS = [
    ['Home', 'index.html'],
    ['Command Nexus', 'command-nexus.html'],
    ['Free trial', 'command-nexus.html#free-trial'],
    ['Pricing', 'command-nexus.html#pricing'],
    ['Command Nexus info', 'command-nexus-info.html'],
    ['Buyable Programs', 'programs.html'],
    ['Founder', 'founder.html'],
    ['Themis', 'themis.html'],
    ['Report Bugs & Share Suggestions', 'bug-report.html'],
    ['Feedback', 'feedback.html'],
    ['Support', 'support.html'],
    ['Sign in', 'login.html'],
    ['Sign up', 'signup.html']
  ];

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .alw-emergency-menu{position:fixed;top:14px;right:14px;z-index:2147483647;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
      .alw-emergency-menu summary{list-style:none;display:inline-flex;align-items:center;gap:.5rem;height:52px;padding:0 20px 0 14px;border-radius:14px;border:2px solid rgba(125,211,252,.4);background:linear-gradient(135deg,rgba(5,7,13,.98),rgba(10,20,35,.98));color:#f7f9ff;box-shadow:0 8px 30px rgba(0,0,0,.5),0 0 20px rgba(125,211,252,.15);cursor:pointer;font-size:1.5rem;font-weight:900;line-height:1;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;}
      .alw-emergency-menu summary:hover{transform:translateY(-1px);border-color:rgba(125,211,252,.7);box-shadow:0 10px 36px rgba(0,0,0,.55),0 0 28px rgba(125,211,252,.25);}
      .alw-emergency-menu summary .menu-label{font-size:1rem;font-weight:800;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.03em;text-transform:uppercase;}
      .alw-emergency-menu summary::-webkit-details-marker{display:none;}
      .alw-emergency-menu-panel{width:min(280px,calc(100vw - 28px));max-height:calc(100vh - 86px);overflow:auto;margin-top:.6rem;padding:.75rem;border:1px solid rgba(255,255,255,.18);border-radius:18px;background:rgba(5,7,13,.98);box-shadow:0 18px 60px rgba(0,0,0,.45);display:grid;gap:.35rem;position:absolute;right:0;top:100%;}
      .alw-emergency-menu-panel a{display:block;padding:.72rem .85rem;border-radius:12px;color:#f7f9ff;text-decoration:none;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-weight:750;}
      .alw-emergency-menu-panel a:hover,.alw-emergency-menu-panel a:focus-visible{background:rgba(125,211,252,.14);outline:none;}
      .mobile-nav-toggle{display:grid!important;position:fixed!important;top:14px!important;right:14px!important;left:auto!important;z-index:2147483646!important;}
      .sidebar-toggle{display:block!important;visibility:visible!important;opacity:1!important;}
    `;
    document.head.appendChild(style);
  }

  function injectDropdown() {
    if (document.getElementById(MENU_ID)) return;
    addStyle();
    var details = document.createElement('details');
    details.id = MENU_ID;
    details.className = 'alw-emergency-menu';
    var summary = document.createElement('summary');
    summary.setAttribute('aria-label', 'Open site menu');
    summary.title = 'Menu';
    summary.innerHTML = '&#9776;<span class="menu-label">Menu</span>';
    var nav = document.createElement('nav');
    nav.className = 'alw-emergency-menu-panel';
    nav.setAttribute('aria-label', 'Site navigation');
    NAV_ITEMS.forEach(function (item) {
      var a = document.createElement('a');
      a.href = item[1];
      a.textContent = item[0];
      nav.appendChild(a);
    });
    details.appendChild(summary);
    details.appendChild(nav);
    document.body.insertBefore(details, document.body.firstChild);
  }

  function safeRun() {
    try { injectDropdown(); } catch (e) { console.error('Emergency menu failed', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeRun);
  } else {
    safeRun();
  }
})();
