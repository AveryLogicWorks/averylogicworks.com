window.AVERY_CONFIG = {
  founderName: 'Chad Avery Harris',
  supportEmail: 'Averylogicworks@gmail.com',
  billingEmail: 'Averylogicworks@gmail.com',
  serviceEmail: 'Averylogicworks@gmail.com',
  primaryAdminEmail: 'adminaverylogicworks@gmail.com',
  ownerEmails: [
    'adminaverylogicworks@gmail.com',
    'averylogicworks@gmail.com'
  ],
  publicPaths: {
    feedback: 'feedback.html',
    serviceIntake: 'service-intake.html'
  },
  githubRepo: {
    fullName: 'AveryLogicWorks/averylogicworks.com',
    branch: 'main',
    editBase: 'https://github.com/AveryLogicWorks/averylogicworks.com/edit/main/'
  },
  supabase: {
    url: 'https://esoiezxddkqlmvsgscqw.supabase.co',
    publishableKey: 'sb_publishable_TYosyp9VRS1S2DEXpNi8eQ_bhMTSFqO',
    trialKeyEdgeFunction: 'https://esoiezxddkqlmvsgscqw.supabase.co/functions/v1/generate-trial-key',
    telemetryEdgeFunction: 'https://esoiezxddkqlmvsgscqw.supabase.co/functions/v1/site-telemetry',
    serviceRequestEdgeFunction: 'https://esoiezxddkqlmvsgscqw.supabase.co/functions/v1/service-request-notify'
  },
  emailOctopus: {
    enabled: true,
    listId: '4cd7acee-230c-11f1-ae61-93533fe48a6e',
    edgeFunctionUrl: 'https://esoiezxddkqlmvsgscqw.supabase.co/functions/v1/emailoctopus-subscribe'
  },
  // BACK25 was a temporary recovery promotion after early checkout issues.
  // It expired July 31, 2026 and is intentionally disabled.
  promo: {
    enabled: false,
    code: 'BACK25',
    percentOff: 25,
    label: 'Expired recovery promotion',
    reason: 'Customer recovery offer after early site checkout issues',
    expiresOn: '2026-07-31',
    firstPurchaseOnly: true
  },
  // Public Command Nexus pricing is currently the Full stage.
  commandNexusStage: 'full',
  commandNexus: {
    downloadUrl: 'https://github.com/AveryLogicWorks/Command-Nexus/releases/download/v0.2.0/CommandNexus.exe'
  },
  paths: {
    home: 'index.html',
    login: 'login.html',
    signup: 'signup.html',
    signupSuccess: 'signup-success.html',
    account: 'account.html',
    confirmNotice: 'login.html?check-email=1',
    resetRedirect: 'login.html?reset=1'
  },
  paypalLinks: {
    oneTime: 'index.html#donation-options',
    monthly: 'index.html#donation-options',
    oneTime10: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=10&item_name=Avery+Logic+Works+Donation&currency_code=USD',
    oneTime25: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=25&item_name=Avery+Logic+Works+Donation&currency_code=USD',
    oneTime50: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=50&item_name=Avery+Logic+Works+Donation&currency_code=USD',
    oneTime100: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=100&item_name=Avery+Logic+Works+Donation&currency_code=USD',
    monthly10: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=10&p3=1&t3=M&item_name=Avery+Logic+Works+Monthly+Support&currency_code=USD',
    monthly25: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=25&p3=1&t3=M&item_name=Avery+Logic+Works+Monthly+Support&currency_code=USD',
    monthly50: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=50&p3=1&t3=M&item_name=Avery+Logic+Works+Monthly+Support&currency_code=USD',
    monthly100: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=100&p3=1&t3=M&item_name=Avery+Logic+Works+Monthly+Support&currency_code=USD',
    serviceStarter20: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=20&item_name=Starter+Build&currency_code=USD',
    serviceStandard50: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=50&item_name=Standard+Build&currency_code=USD',
    serviceExpanded100: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=100&item_name=Expanded+Build&currency_code=USD',
    commandNexusTrial: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=10&item_name=Command+Nexus+15-Day+Extended+Evaluation&currency_code=USD',
    commandNexusProMonthly: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=30&p3=1&t3=M&item_name=Command+Nexus+Pro+Monthly&currency_code=USD',
    commandNexusProYearly: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=324&p3=1&t3=Y&item_name=Command+Nexus+Pro+Yearly&currency_code=USD',
    commandNexusBusinessMonthly: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=50&p3=1&t3=M&item_name=Command+Nexus+Business+Monthly&currency_code=USD',
    commandNexusBusinessYearly: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=552&p3=1&t3=Y&item_name=Command+Nexus+Business+Yearly&currency_code=USD',
    commandNexusUnlimitedMonthly: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=80&p3=1&t3=M&item_name=Command+Nexus+Unlimited+Monthly&currency_code=USD',
    commandNexusUnlimitedYearly: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=900&p3=1&t3=Y&item_name=Command+Nexus+Unlimited+Yearly&currency_code=USD',
    // Historical stage links retained for backward compatibility with hidden stage blocks.
    commandNexusProAlpha: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=10&p3=1&t3=M&item_name=Command+Nexus+Pro+Alpha&currency_code=USD',
    commandNexusBusinessAlpha: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=30&p3=1&t3=M&item_name=Command+Nexus+Business+Alpha&currency_code=USD',
    commandNexusUnlimitedAlpha: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=50&p3=1&t3=M&item_name=Command+Nexus+Unlimited+Alpha&currency_code=USD',
    commandNexusTrialBeta: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=5&item_name=Command+Nexus+Beta+Trial&currency_code=USD',
    commandNexusProBeta: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=20&p3=1&t3=M&item_name=Command+Nexus+Pro+Beta&currency_code=USD',
    commandNexusBusinessBeta: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=40&p3=1&t3=M&item_name=Command+Nexus+Business+Beta&currency_code=USD',
    commandNexusUnlimitedBeta: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a3=60&p3=1&t3=M&item_name=Command+Nexus+Unlimited+Beta&currency_code=USD',
    shop: '#',
    portal: '#'
  },
  founderImages: {
    main: 'assets/founder-photo.jpg',
    avatar: 'assets/founder-photo.jpg'
  }
};

// The Vault is intentionally kept off the public site shell. Load its owner-only
// enterprise data layer only on the hidden Vault route after the page is parsed.
(function () {
  if (!/vault-m7q4k2\.html$/i.test(window.location.pathname)) return;
  function loadVaultLayer() {
    if (document.querySelector('script[data-alw-vault-enterprise]')) return;
    var script = document.createElement('script');
    script.src = 'assets/vault-enterprise.js?v=20260908-2';
    script.defer = true;
    script.setAttribute('data-alw-vault-enterprise', '1');
    document.head.appendChild(script);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadVaultLayer);
  else loadVaultLayer();
})();
