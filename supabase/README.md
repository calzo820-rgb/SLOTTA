# Supabase database changes

Database changes are reviewed in source control before they are applied to the
production Supabase project. `security/phase1_hardening.sql` is the first
conservative hardening pass and deliberately avoids changing the active Slotta
booking policies.

The repository now includes the Supabase CLI configuration. Generated database
types should remain local while this repository is public; the generated file is
excluded through `.gitignore` to avoid publishing the complete production schema.

The production project currently has no recorded migrations. The initial schema
baseline must therefore be created once with an authenticated Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref avyacwqvprmtmibghacv
npx supabase db pull initial_remote_schema
```

`db pull` prompts for the database password, writes the complete remote schema
to `supabase/migrations/`, and records the baseline as already applied remotely.
Review the generated SQL before committing it. Never export production data or
commit database passwords, service-role keys, user records, or seed data copied
from production.

After the baseline exists, make every schema change through a new migration and
verify it locally before applying it remotely.
