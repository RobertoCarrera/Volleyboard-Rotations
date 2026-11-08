# Google sign-in repair

## Cause and change

The previous Lambda proxy created an OAuth state cookie on the Lambda domain while Google returned to NoCodeBackend's domain. The callback could not read that cookie (`state_mismatch`).

Volleyboard now uses Auth.js Google OAuth and encrypted JWT sessions on its own HTTPS origin. NoCodeBackend remains the whiteboard database. Server functions verify the session and derive a SHA-256 owner key from the Google subject before accessing a fixed table; the browser cannot choose another owner, table or record id. Secrets are never placed in frontend code or localStorage.

## Production configuration

Google OAuth client: add `https://volleyboard.sincronia.agency/api/auth/callback/google` as an authorized redirect URI. Keep the previous callback during rollout.

Netlify server environment: `AUTH_ORIGIN`, `AUTH_SECRET` (random, at least 32 characters), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NCB_DATA_API_URL=https://eu-api.nocodebackend.com`, `NCB_INSTANCE`, `NCB_SECRET_KEY`. Restrict contexts to production; use Functions scope when supported. Never prefix secrets with `VITE_`, log their values, or commit `.env` files.

Netlify Personal does not support granular Functions-only scope. Its all-scopes variables are also available to production build processes. Deploying on that plan requires the owner's explicit acceptance of this access; the credentials must still stay out of the client bundle. Secrets Controller additionally requires explicit scopes and excludes post-processing, so `is_secret=true` must not be combined with `all`. Pro or higher supports Functions-only scope. See [Netlify function environment variables](https://docs.netlify.com/build/functions/environment-variables/) and [Secrets Controller](https://docs.netlify.com/build/environment-variables/secrets-controller/).

Additive database migration (applied 2026-11-08):

```sql
ALTER TABLE whiteboard_sets ADD COLUMN IF NOT EXISTS owner_key VARCHAR(64) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS whiteboard_sets_owner_key_unique ON whiteboard_sets (owner_key);
```

The existing `user_id` foreign key and NoCodeBackend policies remain intact. No existing rows are reassigned. The verified pre-rollout database contained no authenticated users or whiteboards to migrate. Google identity and sessions are managed by Auth.js; the NCB native auth tables are not used by this flow.

## Verification

1. `npm test`: 34 passing tests covering OAuth session/origin/CSRF validation, frontend contract, per-user board isolation and failure handling. Mounted React regressions also cover immediate navigation during autosave and failed initial hydration followed by retry.
2. `npm run build`: lint and production Vite bundle.
3. Production: Google sign-in, reload session, edit/save/reload the user's board, sign out, and verify private API rejects unauthenticated requests.

API responses must never be cached by the CDN or service worker. Hydration failures must not overwrite saved data. Test rows must be uniquely identified and removed after integration checks.

Pre-deployment checks completed: live scoped NoCodeBackend create/update/read and removal of the uniquely identified test row; both server functions bundled with esbuild; bundled CSRF response and unauthenticated-data rejection; source and static output scanned for the actual configured secret values without finding matches. A production build with synthetic credential sentinels also confirmed that those environment values are absent from every static output file. The full live Google callback/session flow must still be verified after production deployment.
