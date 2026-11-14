alter table public.tester_leads
  add column email text,
  add column contact_methods text[] not null default '{}',
  alter column phone drop not null;

alter table public.tester_leads
  add constraint tester_leads_contact_methods_allowed
  check (contact_methods <@ array['email', 'whatsapp', 'sms', 'call']::text[]);

comment on column public.tester_leads.contact_methods is
  'Selected contact channels. Empty for leads created before this preference was collected.';
