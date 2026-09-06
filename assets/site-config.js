window.AVERY_CONFIG = {
  founderName: 'Chad Avery Harris',
  supportEmail: 'Averylogicworks@gmail.com',
  billingEmail: 'Averylogicworks@gmail.com',
  serviceEmail: 'Averylogicworks@gmail.com',
  ownerEmails: [
    'adminaverylogicworks@gmail.com'
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
  // Customer recovery promo after the site checkout issues.
  // BACK25 is for a customer's first purchase only and is intended to be temporary.
  // One-time purchase links use the discounted amount directly.
  // Subscription links use a discounted first billing period, then renew at the normal price.
  promo: {
    enabled: true,
    code: 'BACK25',
    percentOff: 25,
    label: '25% off your first purchase',
    reason: 'Customer recovery offer after early site checkout issues',
    expiresOn: '2026-07-31',
    firstPurchaseOnly: true
  },
  // Command Nexus pricing stage shown on command-nexus.html: 'alpha' (live now), 'beta', or 'full'.
  // Flip this to roll prices forward once the matching PayPal links below are filled in.
  commandNexusStage: 'full',
  commandNexus: {
    downloadUrl: 'secure-download.html?product=command-nexus'
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
    serviceStarter20: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=15&item_name=Starter+Build+BACK25+First+Purchase+Promo&currency_code=USD',
    serviceStandard50: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=37.50&item_name=Standard+Build+BACK25+First+Purchase+Promo&currency_code=USD',
    serviceExpanded100: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=75&item_name=Expanded+Build+BACK25+First+Purchase+Promo&currency_code=USD',
    commandNexusTrial: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=7.50&item_name=Command+Nexus+15-Day+Trial+BACK25+First+Purchase+Promo&currency_code=USD',
    commandNexusProMonthly: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a1=22.50&p1=1&t1=M&a3=30&p3=1&t3=M&item_name=Command+Nexus+Pro+Monthly+BACK25+First+Month+Promo&currency_code=USD',
    commandNexusProYearly: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a1=243&p1=1&t1=Y&a3=324&p3=1&t3=Y&item_name=Command+Nexus+Pro+Yearly+BACK25+First+Year+Promo&currency_code=USD',
    commandNexusBusinessMonthly: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a1=37.50&p1=1&t1=M&a3=50&p3=1&t3=M&item_name=Command+Nexus+Business+Monthly+BACK25+First+Month+Promo&currency_code=USD',
    commandNexusBusinessYearly: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a1=414&p1=1&t1=Y&a3=552&p3=1&t3=Y&item_name=Command+Nexus+Business+Yearly+BACK25+First+Year+Promo&currency_code=USD',
    commandNexusUnlimitedMonthly: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a1=60&p1=1&t1=M&a3=80&p3=1&t3=M&item_name=Command+Nexus+Unlimited+Monthly+BACK25+First+Month+Promo&currency_code=USD',
    commandNexusUnlimitedYearly: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a1=675&p1=1&t1=Y&a3=900&p3=1&t3=Y&item_name=Command+Nexus+Unlimited+Yearly+BACK25+First+Year+Promo&currency_code=USD',
    // Alpha stage (live now). Monthly only.
    commandNexusProAlpha: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a1=7.50&p1=1&t1=M&a3=10&p3=1&t3=M&item_name=Command+Nexus+Pro+Alpha+BACK25+First+Month+Promo&currency_code=USD',
    commandNexusBusinessAlpha: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a1=22.50&p1=1&t1=M&a3=30&p3=1&t3=M&item_name=Command+Nexus+Business+Alpha+BACK25+First+Month+Promo&currency_code=USD',
    commandNexusUnlimitedAlpha: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a1=37.50&p1=1&t1=M&a3=50&p3=1&t3=M&item_name=Command+Nexus+Unlimited+Alpha+BACK25+First+Month+Promo&currency_code=USD',
    // Beta stage (built for the future, hidden until commandNexusStage = 'beta').
    commandNexusTrialBeta: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=AveryLogicWorks@gmail.com&amount=3.75&item_name=Command+Nexus+Beta+Trial+BACK25+First+Purchase+Promo&currency_code=USD',
    commandNexusProBeta: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a1=15&p1=1&t1=M&a3=20&p3=1&t3=M&item_name=Command+Nexus+Pro+Beta+BACK25+First+Month+Promo&currency_code=USD',
    commandNexusBusinessBeta: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a1=30&p1=1&t1=M&a3=40&p3=1&t3=M&item_name=Command+Nexus+Business+Beta+BACK25+First+Month+Promo&currency_code=USD',
    commandNexusUnlimitedBeta: 'https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=AveryLogicWorks@gmail.com&a1=45&p1=1&t1=M&a3=60&p3=1&t3=M&item_name=Command+Nexus+Unlimited+Beta+BACK25+First+Month+Promo&currency_code=USD',
    // Full Release stage reuses the existing commandNexus* monthly/yearly links above.
    shop: '#',
    portal: '#'
  },
  founderImages: {
    main: 'assets/founder-photo.jpg',
    avatar: 'assets/founder-photo.jpg'
  }
};
