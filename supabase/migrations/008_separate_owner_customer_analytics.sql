-- Keep raw telemetry intact while making customer-facing business metrics exclude owner activity.
-- Applied to production as migration 20260908132507 separate_owner_customer_analytics.

create or replace function public.owner_customer_analytics_snapshot(p_today_start timestamptz default (now() - interval '1 day'))
returns jsonb
language sql
security invoker
set search_path = ''
as $$
with owner_emails as (
  select lower(a.email) as email from public.site_admins a
),
owner_users as (
  select u.id, lower(u.email) as email
  from auth.users u
  where lower(coalesce(u.email,'')) in (select email from owner_emails)
),
owner_tokens as (
  select distinct e.visitor_token
  from public.site_events e
  where e.visitor_token is not null
    and (
      lower(coalesce(e.user_email,'')) in (select email from owner_emails)
      or e.user_id in (select id from owner_users)
    )
),
classified as (
  select e.*,
    (
      lower(coalesce(e.user_email,'')) in (select email from owner_emails)
      or e.user_id in (select id from owner_users)
      or (e.visitor_token is not null and e.visitor_token in (select visitor_token from owner_tokens))
    ) as is_owner
  from public.site_events e
),
customer as (select * from classified where not is_owner),
owner_activity as (select * from classified where is_owner),
customer_security as (
  select s.*
  from public.security_events s
  where not (
    lower(coalesce(s.user_email,'')) in (select email from owner_emails)
    or s.user_id in (select id from owner_users)
    or (s.visitor_token is not null and s.visitor_token in (select visitor_token from owner_tokens))
  )
),
customer_accounts as (
  select u.* from auth.users u
  where u.deleted_at is null
    and lower(coalesce(u.email,'')) not in (select email from owner_emails)
),
click_names(name) as (values
  ('homepage_visit'),('homepage_service_cta_click'),('homepage_donation_click'),('homepage_signup_click'),
  ('homepage_signin_click'),('homepage_founder_cta_click'),('homepage_support_cta_click'),('homepage_fit_cta_click'),
  ('command_nexus_download'),('trial_key_claimed'),('speakeasy_section_view'),('speakeasy_info_click'),
  ('speakeasy_trial_download'),('speakeasy_purchase_click'),('quadrahydra_section_view'),('quadrahydra_info_click'),
  ('quadrahydra_trial_download'),('quadrahydra_purchase_click')
),
click_counts as (
  select n.name, count(c.id)::bigint as count
  from click_names n left join customer c on c.event_type = n.name
  group by n.name
),
top_pages as (
  select coalesce(page_path,'/') as label, count(*)::bigint as count
  from customer_security
  where event_type='page_visit' and created_at >= now()-interval '30 days'
  group by coalesce(page_path,'/') order by count desc limit 12
),
top_referrers as (
  select referrer as label, count(*)::bigint as count
  from customer_security
  where event_type='page_visit' and created_at >= now()-interval '30 days' and nullif(referrer,'') is not null
  group by referrer order by count desc limit 12
)
select jsonb_build_object(
  'customer', jsonb_build_object(
    'visits_24h', (select count(*) from customer where event_type='page_visit' and created_at >= now()-interval '1 day'),
    'visits_30d', (select count(*) from customer where event_type='page_visit' and created_at >= now()-interval '30 days'),
    'visits_all_time', (select count(*) from customer where event_type='page_visit'),
    'logins_30d', (select count(*) from customer where event_type='login_success' and created_at >= now()-interval '30 days'),
    'logins_all_time', (select count(*) from customer where event_type='login_success'),
    'signups_30d', (select count(*) from customer where event_type='signup_submitted' and created_at >= now()-interval '30 days'),
    'signups_all_time', (select count(*) from customer where event_type='signup_submitted'),
    'accounts_total', (select count(*) from customer_accounts),
    'today_visits', (select count(*) from customer where event_type='page_visit' and created_at >= p_today_start),
    'downloads_30d', (select count(*) from customer where event_type in ('command_nexus_download','speakeasy_trial_download','quadrahydra_trial_download') and created_at >= now()-interval '30 days')
  ),
  'owner_activity', jsonb_build_object(
    'events_all_time', (select count(*) from owner_activity),
    'logins_all_time', (select count(*) from owner_activity where event_type='login_success'),
    'page_visits_all_time', (select count(*) from owner_activity where event_type='page_visit'),
    'vault_opens_all_time', (select count(*) from owner_activity where event_type='owner_vault_opened'),
    'events_30d', (select count(*) from owner_activity where created_at >= now()-interval '30 days')
  ),
  'clicks', coalesce((select jsonb_object_agg(name,count) from click_counts),'{}'::jsonb),
  'traffic', jsonb_build_object(
    'unique_visitors_30d', (select count(distinct coalesce(ip_hash,visitor_token)) from customer_security where event_type='page_visit' and created_at >= now()-interval '30 days' and coalesce(ip_hash,visitor_token) is not null),
    'top_pages', coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count)) from top_pages),'[]'::jsonb),
    'top_referrers', coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count)) from top_referrers),'[]'::jsonb)
  ),
  'owner_emails', coalesce((select jsonb_agg(email) from owner_emails),'[]'::jsonb)
);
$$;

revoke all on function public.owner_customer_analytics_snapshot(timestamptz) from public, anon, authenticated;
grant execute on function public.owner_customer_analytics_snapshot(timestamptz) to service_role;
