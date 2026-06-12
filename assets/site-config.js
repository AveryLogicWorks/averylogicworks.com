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
    publishableKey: 'sb_publishable_TYosyp9VRS1S2DEXpNi8eQ_bhMTSFqO'
  },
  emailOctopus: {
    enabled: false,
    listId: ''
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
  stripeLinks: {
    oneTime: 'index.html#donation-options',
    monthly: 'index.html#donation-options',
    oneTime10: 'https://buy.stripe.com/8x25kwe3F5LX840d951RC06',
    oneTime25: 'https://buy.stripe.com/dRm3cobVx6Q14RO3yv1RC07',
    oneTime50: 'https://buy.stripe.com/5kQ3co1gTb6hckgfhd1RC08',
    oneTime100: 'https://buy.stripe.com/cNidR2gbN7U5bgc8SP1RC09',
    monthly10: 'https://buy.stripe.com/8x28wIgbN2zL2JG5GD1RC0a',
    monthly25: 'https://buy.stripe.com/fZu3co0cPb6h3NK2ur1RC0b',
    monthly50: 'https://buy.stripe.com/00waEQ4t5fmxdokc511RC0c',
    monthly100: 'https://buy.stripe.com/fZu28kbVx3DP5VS7OL1RC0d',
    serviceStarter20: 'https://buy.stripe.com/dRm4gs4t52zLckgb0X1RC03',
    serviceStandard50: 'https://buy.stripe.com/dRm8wIe3F2zL4ROd951RC04',
    serviceExpanded100: 'https://buy.stripe.com/3cIfZaf7J2zLac8glh1RC05',
    commandNexusTrial: 'https://buy.stripe.com/5kQ00c3p1fmxbgc0mj1RC0e',
    commandNexusProMonthly: 'https://buy.stripe.com/9B6cMYgbNgqB0By8SP1RC0f',
    commandNexusProYearly: 'https://buy.stripe.com/4gM7sEf7Jfmxdoked91RC0g',
    commandNexusBusinessMonthly: 'https://buy.stripe.com/fZu3co1gT5LX9842ur1RC0h',
    commandNexusBusinessYearly: 'https://buy.stripe.com/dRm7sE9Np8Y9gAwed91RC0i',
    commandNexusUnlimitedMonthly: 'https://buy.stripe.com/7sYdR28Jl7U5fws2ur1RC0j',
    commandNexusUnlimitedYearly: 'https://buy.stripe.com/cNi5kw8Jl0rD2JG6KH1RC0k',
    // Early Access Alpha plans (monthly only). Set these to the new Stripe Payment Links.
    // The older commandNexus* links above are kept for reference/rollback and are no longer shown on the page.
    commandNexusProAlpha: '#',
    commandNexusBusinessAlpha: '#',
    commandNexusUnlimitedAlpha: '#',
    shop: '#',
    portal: '#'
  },
  founderImages: {
    main: 'assets/founder-photo.jpg',
    avatar: 'assets/founder-photo.jpg'
  }
};