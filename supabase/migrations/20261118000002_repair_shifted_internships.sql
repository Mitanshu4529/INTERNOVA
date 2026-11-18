-- Repairs internship listings that were imported with their columns shifted.
--
-- In the affected rows:
--   company     holds the apply link        (should be the company name)
--   location    holds the company name      (should be the city)
--   description holds the city              (should be a description)
--   duration    holds a logo image link     (should be the duration)
--   stipend     holds "Actively hiring"     (not a stipend)
--
-- A row is treated as shifted only when BOTH company and duration are web
-- links; correctly imported rows are not touched. This is the same rule the
-- app already applies when it reads listings (repairShiftedRow in
-- src/utils/liveApi.ts), so the app keeps working before and after.
--
-- Safe to run more than once: the second run finds nothing left to repair.
-- The original rows are copied to public.internships_backup_20261118 first.
-- To undo, see the block at the bottom of this file.

begin;

-- 1. Keep a copy of every row that is about to change.
create table if not exists public.internships_backup_20261118
  (like public.internships);

-- The copy is for you only: nobody can read it through the app or the API.
alter table public.internships_backup_20261118 enable row level security;
revoke all on public.internships_backup_20261118 from anon, authenticated;

insert into public.internships_backup_20261118
select i.*
from public.internships i
where i.company  ~* '^\s*https?://'
  and i.duration ~* '^\s*https?://'
  and not exists (
    select 1 from public.internships_backup_20261118 b where b.id = i.id
  );

-- 2. Put the columns back. (The right-hand sides all read the old values.)
update public.internships
set source      = coalesce(nullif(btrim(source), ''), btrim(company)),
    company     = location,
    location    = description,
    description = null,
    duration    = null,
    stipend     = case when stipend ~* 'actively hiring' then null else stipend end
where company  ~* '^\s*https?://'
  and duration ~* '^\s*https?://';

commit;

-- 3. Check the result. Expected: shifted_rows_left = 0, and backed_up equal to
--    the number of rows the update reported (about 3,260).
select
  (select count(*) from public.internships
    where company ~* '^\s*https?://' and duration ~* '^\s*https?://') as shifted_rows_left,
  (select count(*) from public.internships_backup_20261118)           as backed_up;


-- ---------------------------------------------------------------------------
-- OPTIONAL: use one spelling for Bangalore. Not needed for matching (the app
-- treats both spellings as the same city); it only makes the data consistent.
-- These rows are not in the backup. Remove the two dashes to run it.
-- ---------------------------------------------------------------------------
-- update public.internships
-- set location = regexp_replace(location, '\mBangalore\M', 'Bengaluru', 'gi')
-- where location ~* '\mBangalore\M';


-- ---------------------------------------------------------------------------
-- UNDO: puts the repaired rows back exactly as they were. Remove the dashes
-- to run it.
-- ---------------------------------------------------------------------------
-- update public.internships i
-- set company = b.company, location = b.location, description = b.description,
--     duration = b.duration, stipend = b.stipend, source = b.source
-- from public.internships_backup_20261118 b
-- where b.id = i.id;

-- When you are satisfied and no longer need the copy:
-- drop table public.internships_backup_20261118;
