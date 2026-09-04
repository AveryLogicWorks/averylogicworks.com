-- Allow the public Speakeasy funnel events through the direct-insert fallback.

drop policy if exists "Public safe event inserts" on public.site_events;
create policy "Public safe event inserts"
  on public.site_events for insert
  to anon, authenticated
  with check (
    (user_id is null or user_id = (select auth.uid()))
    and (
      user_email is null
      or lower(user_email) = lower(coalesce((select (auth.jwt() ->> 'email')), ''))
    )
    and event_type = any (array[
      'page_visit',
      'homepage_visit',
      'homepage_service_cta_click',
      'homepage_donation_click',
      'homepage_signup_click',
      'homepage_signin_click',
      'homepage_founder_cta_click',
      'homepage_support_cta_click',
      'homepage_fit_cta_click',
      'command_nexus_download',
      'trial_key_claimed',
      'speakeasy_section_view',
      'speakeasy_info_click',
      'speakeasy_trial_download',
      'speakeasy_purchase_click',
      'public_feedback_submitted',
      'signup_submitted',
      'login_success'
    ])
  );
