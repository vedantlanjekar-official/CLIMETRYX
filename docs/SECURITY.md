# Security

- The publishable Supabase key is the only browser credential. `SUPABASE_SECRET_KEY` is read on the server for the cron route.
- Client modules are tested so they do not reference the service client or the secret key name.
- Workspace mutations go through server actions. The proxy checks `getUser()` before protected routes when Supabase is configured.
- Row-level security is enabled for every `public` table in the migration. Financial tables and reports use a narrower role list.
- Uploads reject executable extensions, oversized files, and archive paths that escape the folder. Files are not executed.
- Logs pass objects through a redaction helper for key names that look like secrets.
- Rate limits on sign-in, preview, geocoding, and submission are in-memory and apply to one server process only.
- The cron route requires `Authorization: Bearer <CRON_SECRET>` and does nothing useful until the secret and service key exist.
- The score must not be used to approve or reject credit automatically. Geography-only refusal is outside the product rules.

RLS behaviour was not executed against a database in this run. The migration text is covered by a static test. Apply the migration and add a live cross-organization test before production use.
