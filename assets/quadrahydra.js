/* QuadraHydra purchase/trial consent and account-bound trial claim. */
(function () {
  'use strict';
  var agree = document.getElementById('qh-agree');
  if (!agree) return;
  var download = document.getElementById('qh-download');
  var buy = document.getElementById('qh-buy');
  var checkout = document.getElementById('qh-checkout');
  var feedback = document.getElementById('qh-feedback');
  var version = 'QH-TERMS-2026-09-08';

  function accepted() {
    if (!agree.checked) {
      feedback.textContent = 'Please review the terms and check the agreement box first.';
      agree.focus();
      return false;
    }
    var record = { product: 'QuadraHydra', terms: version, accepted_utc: new Date().toISOString() };
    document.getElementById('qh-order-agreement').value = JSON.stringify(record);
    try { localStorage.setItem('alw.quadrahydra.agreement', JSON.stringify(record)); } catch (error) { /* Checkout works without browser storage. */ }
    return true;
  }

  agree.addEventListener('change', function () {
    download.disabled = buy.disabled = !agree.checked;
    feedback.textContent = agree.checked
      ? 'Terms accepted. Sign in to claim the evaluation or continue to PayPal for a one-computer license.'
      : 'Review the terms and check the agreement box before trial or purchase.';
  });

  download.addEventListener('click', async function () {
    if (!accepted()) return;
    if (!window.AveryProductTrials) {
      feedback.textContent = 'Trial access is temporarily unavailable. Please reload the page.';
      return;
    }
    download.disabled = true;
    feedback.textContent = 'Checking your account and issuing your QuadraHydra trial entitlement...';
    try {
      var url = download.getAttribute('data-managed-download-url') || 'downloads/QuadraHydra-1.0.3-Windows.zip';
      var payload = await window.AveryProductTrials.claimAndDownload({
        productSlug: 'quadrahydra',
        productName: 'QuadraHydra',
        anchor: '#quadrahydra-purchase',
        downloadUrl: url,
        filename: 'QuadraHydra-1.0.3-Windows.zip',
        feedback: feedback
      });
      if (payload) {
        feedback.textContent = 'QuadraHydra trial issued to your account. Save the displayed key with the trial package. Expires ' + new Date(payload.expires_at).toLocaleString() + '.';
      }
    } catch (error) {
      feedback.textContent = error && error.message ? error.message : 'Unable to issue the trial.';
    } finally {
      download.disabled = !agree.checked;
    }
  });

  checkout.addEventListener('submit', function (event) {
    if (!accepted()) event.preventDefault();
  });
})();
