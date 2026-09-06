# Account download cutover

Do not publish the frontend before the private downloads are ready.

1. Create a private Supabase Storage bucket `software-downloads` using the Storage API. Do not grant direct object SELECT or signed-link generation to clients. Upload the verified existing files named in `supabase/functions/account-download/handler.mjs`. Nexus is approximately 418 MB; verify the plan's per-file limit before upload. Keep checksums identical.
2. Apply `downloads_tracking.sql`. Audit inserts use service role only. Deploy `account-download` with gateway JWT verification **disabled**, because a native browser download POST carries the access token in the request body. The handler itself verifies EVERY request with Auth `/user`, rejects anonymous accounts, and never accepts a user ID from the client. Do not log request bodies or Authorization headers.
3. Test a real signed-in download for all three products, verify exact hashes, and verify the server audit. Test logged-out, expired-token, anonymous-user and raw URL requests. Requests without credentials must receive 401. Native POST delivery avoids buffering the Nexus executable in browser memory.
4. Remove the two software ZIPs from the Render published directory only after private copies are verified. Retire public GitHub release delivery of Nexus. Public repository history also contains the ZIPs: removing current files alone does not close raw GitHub/history access. Restrict or migrate their hosting repositories with owner approval, preserving the website deployment's authorized access. Do not rewrite history or delete the release without a verified private copy.
5. Publish the account download links and verify the previous public URLs no longer return program bytes, including CDN/cache paths. Checksums and legal documents can remain public. Audit all catalog URLs as well as HTML links.

The current branch does not remove public binaries, change repository visibility, or claim historical copies are revoked. Until step 4 is complete the protection is incomplete.

Deploy `paypal-health` with gateway JWT verification enabled; the handler also verifies the current user and membership in `site_admins`. The dashboard check confirms live PayPal API authentication only, never charges money, and does not establish checkout/capture/webhook/key-delivery correctness.
