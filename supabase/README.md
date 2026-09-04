# Supabase database changes

Database changes are reviewed in source control before they are applied to the
production Supabase project. `security/phase1_hardening.sql` is the first
conservative hardening pass and deliberately avoids changing the active Slotta
booking policies.

The project did not previously contain Supabase migration history. A complete
schema baseline should be generated after the production schema is hardened and
verified, so future changes can use timestamped migrations consistently.
