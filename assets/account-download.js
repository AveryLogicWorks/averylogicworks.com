(function () {
  'use strict';
  var product = new URLSearchParams(location.search).get('product') || 'command-nexus';
  var names = {'command-nexus':'Command Nexus', speakeasy:'SpeakEasy', quadrahydra:'QuadraHydra'};
  var message = document.getElementById('download-message');
  var button = document.getElementById('secure-download');
  var login = document.getElementById('download-login');
  login.href = 'login.html?next=' + encodeURIComponent('secure-download.html?product=' + encodeURIComponent(product));
  if (!Object.prototype.hasOwnProperty.call(names, product)) {
    message.textContent = 'Unknown product. Please return to the programs page.'; return;
  }
  button.textContent = 'Download ' + names[product];
  var sb = window._averySupabase;
  async function check() {
    button.disabled = true;
    try {
      if (!sb) throw Error('Account service unavailable. Please reload or contact support.');
      var result = await sb.auth.getSession();
      var session = result.data && result.data.session;
      if (!session || session.user.is_anonymous) {
        message.textContent = 'Sign in with your account to download ' + names[product] + '.'; return null;
      }
      message.textContent = 'Signed in as ' + session.user.email + '. Ready to request your download.';
      button.disabled = false;
      return session;
    } catch (error) { message.textContent = error.message; return null; }
  }
  button.addEventListener('click', async function () {
    var session = await check();
    if (!session) return;
    // Native streaming download: no 400 MB browser-memory buffer, no token in URL.
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = window.AVERY_CONFIG.supabase.url.replace(/\/$/, '') + '/functions/v1/account-download?product=' + product;
    var token = document.createElement('input');
    token.type = 'hidden'; token.name = 'access_token'; token.value = session.access_token;
    form.appendChild(token); document.body.appendChild(form); form.submit(); form.remove();
    message.textContent = 'Download requested. The server will verify and record your account before sending the file.';
  });
  if (sb) sb.auth.onAuthStateChange(function () { setTimeout(check, 0); });
  check();
})();
