(function () {
  'use strict';

  var HEADER_ID = 'alw-enterprise-header';
  var CSS_ID = 'alw-enterprise-css';
  var ownerOnlyPages = new Set(['vault-m7q4k2.html', 'owner-content-m7q4k2.html']);

  function currentPage() {
    return String(window.location.pathname || '/').split('/').filter(Boolean).pop() || 'index.html';
  }

  function loadEnterpriseCss() {
    if (document.getElementById(CSS_ID)) return;
    var link = document.createElement('link');
    link.id = CSS_ID;
    link.rel = 'stylesheet';
    link.href = 'assets/enterprise.css';
    document.head.appendChild(link);
  }

  function productLink(href, title, description) {
    return '<a href="' + href + '"><strong>' + title + '</strong><span>' + description + '</span></a>';
  }

  function injectHeader() {
    if (ownerOnlyPages.has(currentPage()) || document.getElementById(HEADER_ID)) return;

    var header = document.createElement('header');
    header.id = HEADER_ID;
    header.setAttribute('role', 'banner');
    header.innerHTML = ''
      + '<div class="alw-enterprise-header-inner">'
      +   '<a class="alw-enterprise-brand" href="index.html" aria-label="Avery Logic Works home">'
      +     '<img src="assets/favicon.svg" alt="" aria-hidden="true">'
      +     '<span class="alw-enterprise-brand-copy"><strong>Avery Logic Works</strong><span>Software · AI · Systems</span></span>'
      +   '</a>'
      +   '<nav class="alw-enterprise-nav nav-links" aria-label="Primary navigation">'
      +     '<details class="alw-products-menu">'
      +       '<summary>Products</summary>'
      +       '<div class="alw-products-panel">'
      +         productLink('programs.html', 'One-Time Software', 'Focused Windows programs with one-purchase licensing.')
      +         productLink('software-subscriptions.html', 'Software Subscriptions', 'Recurring-access software and actively supported platforms.')
      +         productLink('command-nexus.html', 'Command Nexus', 'AI orchestration, governance, and local-first control.')
      +         productLink('themis.html', 'Themis', 'Legal-information and structured reasoning tools.')
      +       '</div>'
      +     '</details>'
      +     '<a href="service-intake.html">Custom Software</a>'
      +     '<a href="founder.html">Company</a>'
      +     '<a href="support.html">Support</a>'
      +     '<a href="login.html" data-auth-state="login">Sign in</a>'
      +     '<a class="alw-signup" href="signup.html">Create account</a>'
      +   '</nav>'
      +   '<div class="alw-mobile-nav-wrap">'
      +     '<details class="alw-mobile-nav">'
      +       '<summary aria-label="Open navigation">&#9776;</summary>'
      +       '<nav class="alw-mobile-panel" aria-label="Mobile navigation">'
      +         '<div class="group-label">Products</div>'
      +         '<a href="programs.html">One-Time Software</a>'
      +         '<a href="software-subscriptions.html">Software Subscriptions</a>'
      +         '<a href="command-nexus.html">Command Nexus</a>'
      +         '<a href="themis.html">Themis</a>'
      +         '<div class="group-label">Business</div>'
      +         '<a href="service-intake.html">Custom Software</a>'
      +         '<a href="founder.html">Company</a>'
      +         '<a href="support.html">Support &amp; Feedback</a>'
      +         '<div class="group-label">Account</div>'
      +         '<a href="login.html">Sign in</a>'
      +         '<a href="signup.html">Create account</a>'
      +       '</nav>'
      +     '</details>'
      +   '</div>'
      + '</div>';

    document.body.insertBefore(header, document.body.firstChild);

    document.addEventListener('click', function (event) {
      document.querySelectorAll('.alw-products-menu[open], .alw-mobile-nav[open]').forEach(function (details) {
        if (!details.contains(event.target)) details.removeAttribute('open');
      });
    });
  }

  function loadContactBridge() {
    if (!document.querySelector('#support-form,#bug-report-form,#feedback-form')) return;
    if (document.querySelector('script[data-alw-contact-bridge]')) return;
    var script = document.createElement('script');
    script.src = 'assets/customer-contact.js';
    script.defer = true;
    script.setAttribute('data-alw-contact-bridge', '1');
    document.head.appendChild(script);
  }

  function safeRun() {
    try { loadEnterpriseCss(); } catch (e) { console.error('Enterprise styles failed', e); }
    try { injectHeader(); } catch (e) { console.error('Enterprise navigation failed', e); }
    try { loadContactBridge(); } catch (e) { console.error('Contact form bridge failed', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeRun);
  } else {
    safeRun();
  }
})();
