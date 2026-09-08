(function () {
  'use strict';
  if (!/vault-m7q4k2\.html$/i.test(window.location.pathname)) return;

  function findAccountRow(email) {
    var needle = String(email || '').trim().toLowerCase();
    if (!needle) return null;
    return Array.from(document.querySelectorAll('#user-directory-list [data-alw-account]')).find(function (row) {
      return String(row.textContent || '').toLowerCase().includes(needle);
    }) || null;
  }

  function wire() {
    document.querySelectorAll('.alw-download-id').forEach(function (node) {
      if (node.getAttribute('data-account-link-ready') === '1') return;
      var value = String(node.textContent || '').trim();
      if (!value.includes('@')) return;
      node.setAttribute('data-account-link-ready', '1');
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.title = 'Open account details';
      node.style.cursor = 'pointer';
      node.style.textDecoration = 'underline';
      node.style.textUnderlineOffset = '3px';

      function openAccount() {
        var row = findAccountRow(value);
        if (row) row.click();
      }
      node.addEventListener('click', openAccount);
      node.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openAccount();
        }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
  window.setTimeout(wire, 1800);
  window.setTimeout(wire, 3500);
  new MutationObserver(wire).observe(document.documentElement, { childList: true, subtree: true });
})();
