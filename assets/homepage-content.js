(function () {
  const cfg = window.AVERY_CONFIG || {};
  const supabaseCfg = cfg.supabase || {};

  function applyContent(content) {
    if (!content || typeof content !== 'object') return;

    const eyebrow = document.querySelector('.hero .eyebrow');
    const headline = document.getElementById('hero-title');
    const subhead = document.querySelector('.hero .hero-subhead');
    const note = document.querySelector('.hero .hero-note');
    const primaryCta = document.querySelector('.hero .cta-row a[href="#services"]');
    const secondaryCta = document.querySelector('.hero .cta-row a[href="#good-fit"]');
    const founderCta = document.querySelector('.hero .cta-row a[href="founder.html"]');

    if (eyebrow && content.eyebrow) eyebrow.textContent = content.eyebrow;
    if (headline && content.headline) headline.textContent = content.headline;
    if (subhead && content.subhead) subhead.textContent = content.subhead;
    if (note && content.note) note.textContent = content.note;
    if (primaryCta && content.primary_cta) primaryCta.textContent = content.primary_cta;
    if (secondaryCta && content.secondary_cta) secondaryCta.textContent = content.secondary_cta;
    if (founderCta && content.founder_cta) founderCta.textContent = content.founder_cta;
  }

  async function loadHomepageContent() {
    if (!window.supabase || !supabaseCfg.url || !supabaseCfg.publishableKey) return;

    try {
      const sb = window.supabase.createClient(supabaseCfg.url, supabaseCfg.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      const response = await sb.from('site_content').select('content').eq('key', 'homepage_content').maybeSingle();
      if (response.error) throw response.error;
      if (response.data && response.data.content) {
        applyContent(response.data.content);
      }
    } catch (err) {
      console.debug('homepage content overrides unavailable', err?.message || err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadHomepageContent, { once: true });
  } else {
    loadHomepageContent();
  }
})();
