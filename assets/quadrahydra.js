/* QuadraHydra purchase/trial consent. No payment verification or key issuance in the browser. */
(function () {
  'use strict';
  var agree = document.getElementById('qh-agree');
  if (!agree) return;
  var download = document.getElementById('qh-download');
  var buy = document.getElementById('qh-buy');
  var checkout = document.getElementById('qh-checkout');
  var feedback = document.getElementById('qh-feedback');
  var version = 'QH-TERMS-2026-09-03';
  function accepted() {
    if (!agree.checked) {
      feedback.textContent = 'Please review the terms and check the agreement box first.';
      agree.focus();
      return false;
    }
    var record = {product: 'QuadraHydra', terms: version, accepted_utc: new Date().toISOString()};
    document.getElementById('qh-order-agreement').value = JSON.stringify(record);
    try { localStorage.setItem('alw.quadrahydra.agreement', JSON.stringify(record)); } catch (error) { /* Checkout works without browser storage. */ }
    return true;
  }
  agree.addEventListener('change', function () {
    download.disabled = buy.disabled = !agree.checked;
    feedback.textContent = agree.checked ? 'Choose the free trial or continue to PayPal.' : 'Read the terms and check the agreement box to download or purchase.';
  });
  download.addEventListener('click', function () {
    if (!accepted()) return;
    var link = document.createElement('a');
    link.href = download.getAttribute('data-managed-download-url') || 'downloads/QuadraHydra-1.0.3-Windows.zip';
    link.download = 'QuadraHydra-1.0.3-Windows.zip';
    document.body.appendChild(link); link.click(); link.remove();
    feedback.textContent = 'Download started. Extract all files and open QuadraHydra.exe. The 72-hour trial starts when you click Start Trial inside the app.';
  });
  checkout.addEventListener('submit', function (event) {
    if (!accepted()) event.preventDefault();
  });
})();
