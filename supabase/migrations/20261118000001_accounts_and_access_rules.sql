-- =====================================================================
-- INTERNOVA: real accounts and access rules
-- =====================================================================
-- Run this once in the Supabase SQL editor (it is safe to run again).
-- It was written against the schema snapshot taken on 2026-11-18 and has
-- NOT been run against the live project by its author. See the checks at
-- the bottom of this file for what to verify afterwards.
--
-- What it does
--   1. Profile rows: every auth user gets a row in public.users, created
--      by a trigger. The account type (student or company) is fixed at
--      sign-up and cannot be changed from the browser afterwards.
--   2. Removes the unused plain-text `password` column from public.users.
--      Passwords belong to Supabase Auth only.
--   3. Table privileges: the `authenticated` role had no privileges on
--      users, messages or saved_internships, so every request failed even
--      with a valid session. Grants are now explicit and minimal.
--   4. Row level security: one clear set of policies per table, replacing
--      the overlapping ones.
--   5. Integrity: no duplicate applications or saves, valid statuses,
--      deleting a listing removes its applications and saves.
--   6. Drops the broken get_recommendations() function (it referenced
--      columns that do not exist; matching is done in the app).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Profile row for every account
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_type text := case when new.raw_user_meta_data ->> 'type' = 'company' then 'company' else 'user' end;
  company_name text := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'company', '')), 200), '');
begin
  insert into public.users (id, email, name, type, profile)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), 120), ''), split_part(new.email, '@', 1)),
    account_type,
    case when account_type = 'company' and company_name is not null
         then jsonb_build_object('company', company_name)
         else '{}'::jsonb end
  )
  -- Never block a sign-up because a profile row (or its email) already exists.
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts created before this trigger existed.
insert into public.users (id, email, name, type, profile)
select u.id,
       lower(u.email),
       coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)),
       case when u.raw_user_meta_data ->> 'type' = 'company' then 'company' else 'user' end,
       '{}'::jsonb
from auth.users u
where u.email is not null
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. No passwords outside Supabase Auth
-- ---------------------------------------------------------------------
alter table public.users drop column if exists password;

-- ---------------------------------------------------------------------
-- 3. Table privileges (row level security below decides which rows)
-- ---------------------------------------------------------------------
revoke all on public.users, public.applications, public.saved_internships,
              public.messages, public.internships, public.kv_store_cb26aef8
  from anon, authenticated;

-- Anyone may browse listings.
grant select on public.internships to anon, authenticated;
grant insert, update, delete on public.internships to authenticated;

-- Own profile only. `type`, `email` and `id` are not updatable from the client.
grant select on public.users to authenticated;
grant update (name, profile) on public.users to authenticated;

grant select, insert on public.applications to authenticated;
grant update (status) on public.applications to authenticated;

grant select, insert, delete on public.saved_internships to authenticated;

grant select, insert on public.messages to authenticated;
grant update (read) on public.messages to authenticated;

-- ---------------------------------------------------------------------
-- 4. Row level security
-- ---------------------------------------------------------------------
alter table public.users             enable row level security;
alter table public.internships       enable row level security;
alter table public.applications      enable row level security;
alter table public.saved_internships enable row level security;
alter table public.messages          enable row level security;

-- Helper: is the caller a company account? SECURITY DEFINER so it can be used
-- inside policies without recursing into the policies on public.users.
create or replace function public.is_company()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and type = 'company');
$$;
revoke all on function public.is_company() from public, anon;
grant execute on function public.is_company() to authenticated;

create or replace function public.is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and type = 'user');
$$;
revoke all on function public.is_student() from public, anon;
grant execute on function public.is_student() to authenticated;

-- users ----------------------------------------------------------------
drop policy if exists "Users can insert their own record" on public.users;
drop policy if exists "Users can view their own profile" on public.users;
drop policy if exists "Users can update their own profile" on public.users;
drop policy if exists users_select_own on public.users;
drop policy if exists users_update_own on public.users;

create policy users_select_own on public.users
  for select to authenticated using (id = auth.uid());
create policy users_update_own on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- No insert or delete policy: rows are created by the sign-up trigger only.

-- internships ----------------------------------------------------------
drop policy if exists public_can_read_internships on public.internships;
drop policy if exists company_can_insert_internships on public.internships;
drop policy if exists company_can_update_internships on public.internships;
drop policy if exists internships_select_all on public.internships;
drop policy if exists internships_insert_own on public.internships;
drop policy if exists internships_update_own on public.internships;
drop policy if exists internships_delete_own on public.internships;

create policy internships_select_all on public.internships
  for select to anon, authenticated using (true);
create policy internships_insert_own on public.internships
  for insert to authenticated with check (company_id = auth.uid() and public.is_company());
create policy internships_update_own on public.internships
  for update to authenticated using (company_id = auth.uid()) with check (company_id = auth.uid());
create policy internships_delete_own on public.internships
  for delete to authenticated using (company_id = auth.uid());

-- applications ---------------------------------------------------------
drop policy if exists student_apply_insert on public.applications;
drop policy if exists student_view_own_apps on public.applications;
drop policy if exists "Students can view their own applications" on public.applications;
drop policy if exists "Companies can view applications for their internships" on public.applications;
drop policy if exists "Students can create applications" on public.applications;
drop policy if exists "Companies can update applications for their internships" on public.applications;
drop policy if exists applications_select_student on public.applications;
drop policy if exists applications_select_company on public.applications;
drop policy if exists applications_insert_student on public.applications;
drop policy if exists applications_update_company on public.applications;

create policy applications_select_student on public.applications
  for select to authenticated using (student_id = auth.uid());

create policy applications_select_company on public.applications
  for select to authenticated using (
    exists (select 1 from public.internships i
            where i.id = applications.internship_id and i.company_id = auth.uid())
  );

-- A student applies as themselves, always starting at "Applied", and cannot
-- attach the application to a company that does not own the listing.
create policy applications_insert_student on public.applications
  for insert to authenticated with check (
    student_id = auth.uid()
    and public.is_student()
    and status = 'Applied'
    and applications.company_id is not distinct from
        (select i.company_id from public.internships i where i.id = applications.internship_id)
  );

-- Only the company that owns the listing may change the status.
create policy applications_update_company on public.applications
  for update to authenticated
  using (
    exists (select 1 from public.internships i
            where i.id = applications.internship_id and i.company_id = auth.uid())
  )
  with check (
    exists (select 1 from public.internships i
            where i.id = applications.internship_id and i.company_id = auth.uid())
  );

-- saved_internships ----------------------------------------------------
drop policy if exists saved_insert on public.saved_internships;
drop policy if exists saved_select on public.saved_internships;
drop policy if exists saved_delete on public.saved_internships;

create policy saved_select on public.saved_internships
  for select to authenticated using (student_id = auth.uid());
create policy saved_insert on public.saved_internships
  for insert to authenticated with check (student_id = auth.uid());
create policy saved_delete on public.saved_internships
  for delete to authenticated using (student_id = auth.uid());

-- messages (addressed by email; the caller's email comes from their token) --
drop policy if exists "Users can view messages sent to or from them" on public.messages;
drop policy if exists "Users can send messages" on public.messages;
drop policy if exists "Users can update their own received messages" on public.messages;
drop policy if exists messages_select_own on public.messages;
drop policy if exists messages_insert_as_self on public.messages;
drop policy if exists messages_update_received on public.messages;

create policy messages_select_own on public.messages
  for select to authenticated using (
    lower(recipient) = lower(auth.jwt() ->> 'email') or lower(sender) = lower(auth.jwt() ->> 'email')
  );
create policy messages_insert_as_self on public.messages
  for insert to authenticated with check (lower(sender) = lower(auth.jwt() ->> 'email'));
create policy messages_update_received on public.messages
  for update to authenticated
  using (lower(recipient) = lower(auth.jwt() ->> 'email'))
  with check (lower(recipient) = lower(auth.jwt() ->> 'email'));

-- ---------------------------------------------------------------------
-- 5. Integrity
-- ---------------------------------------------------------------------
-- One application and one save per student per listing.
create unique index if not exists applications_student_internship_key
  on public.applications (student_id, internship_id);
create unique index if not exists saved_internships_student_internship_key
  on public.saved_internships (student_id, internship_id);

create index if not exists applications_internship_id_idx on public.applications (internship_id);
create index if not exists internships_company_id_idx on public.internships (company_id);
create index if not exists internships_created_at_idx on public.internships (created_at desc);
create index if not exists messages_recipient_idx on public.messages (lower(recipient));
create index if not exists messages_sender_idx on public.messages (lower(sender));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'applications_status_check') then
    alter table public.applications
      add constraint applications_status_check
      check (status in ('Applied', 'Under Review', 'Rejected', 'Accepted')) not valid;
  end if;
end $$;

-- Deleting a listing removes its applications and saves (it used to be blocked).
alter table public.applications drop constraint if exists applications_internship_id_fkey;
alter table public.applications
  add constraint applications_internship_id_fkey
  foreign key (internship_id) references public.internships (id) on delete cascade;

alter table public.saved_internships drop constraint if exists saved_internships_internship_id_fkey;
alter table public.saved_internships
  add constraint saved_internships_internship_id_fkey
  foreign key (internship_id) references public.internships (id) on delete cascade;

-- Deleting an account removes its profile row and what hangs off it.
alter table public.applications drop constraint if exists applications_student_id_fkey;
alter table public.applications
  add constraint applications_student_id_fkey
  foreign key (student_id) references public.users (id) on delete cascade;

alter table public.applications drop constraint if exists applications_company_id_fkey;
alter table public.applications
  add constraint applications_company_id_fkey
  foreign key (company_id) references public.users (id) on delete set null;

alter table public.saved_internships drop constraint if exists saved_internships_student_id_fkey;
alter table public.saved_internships
  add constraint saved_internships_student_id_fkey
  foreign key (student_id) references public.users (id) on delete cascade;

-- ---------------------------------------------------------------------
-- 6. Remove the broken recommendation function
-- ---------------------------------------------------------------------
drop function if exists public.get_recommendations(text[], integer, integer);

commit;

-- =====================================================================
-- AFTER RUNNING: checks to do yourself
-- =====================================================================
-- a) Every auth user has a profile row (expect 0):
--      select count(*) from auth.users u
--      left join public.users p on p.id = u.id where p.id is null;
--
-- b) Advisors: Dashboard -> Advisors -> Security. Expect no "RLS disabled"
--    and no "policy exists but RLS disabled" findings for these tables.
--
-- c) In the app, with two real accounts (one student, one company):
--      - company posts a listing; student sees it, applies, saves it
--      - company sees the applicant, accepts; student sees the new status
--      - company messages the student; student sees it and the unread count
--      - a second student account cannot see the first student's
--        applications, saved items or messages
--
-- d) Authentication -> URL Configuration: add your site URL (and
--    http://localhost:3000 for development) to "Redirect URLs", otherwise
--    the confirmation link in the sign-up email will not return to the app.
--
-- e) If you deploy the parse-resume function again
--    (supabase functions deploy parse-resume), it now requires a signed-in user.
