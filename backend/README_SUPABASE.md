SUPABASE BACKEND OPTION

This folder is here so you do not have to design the website-side data model from zero later.

Recommended use
- Use Supabase Auth for sign-up, sign-in, and password reset emails.
- Use the profiles table for newsletter/supporter toggles and lock status.
- Use the supporter_events table later if you want to reconcile Stripe supporters against accounts.

Minimal live architecture
- Static HTML site for public pages
- Supabase Auth for login/reset/account
- Stripe Payment Links or Checkout for support and recurring support
- Optional Stripe customer portal for monthly supporters later

You can ignore this folder until you are ready.
