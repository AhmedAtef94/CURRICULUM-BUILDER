-- =====================================================================
-- "ADDED BY" — record who created each lecture / topic / chapter / question
--
-- Run once: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run. Adds columns only; nothing is dropped or rewritten.
--
-- Two columns per table, on purpose:
--   created_by      uuid → the real audit trail, survives renames
--   created_by_name text → a snapshot of the name, for display
--
-- Why snapshot the name? The profiles_read policy only lets a user read
-- their OWN profile (managers see everyone). Without the snapshot an editor
-- would see "added by …" blank for everything a colleague created, because
-- they simply cannot read that colleague's row. The snapshot also keeps the
-- history readable after a user is deleted.
--
-- Trade-off: if someone later renames themselves, older rows keep the name
-- they had at the time. That is usually what you want in an audit trail.
-- =====================================================================

alter table lectures  add column if not exists created_by uuid references profiles(id) on delete set null;
alter table topics    add column if not exists created_by uuid references profiles(id) on delete set null;
alter table chapters  add column if not exists created_by uuid references profiles(id) on delete set null;
alter table questions add column if not exists created_by uuid references profiles(id) on delete set null;

alter table lectures  add column if not exists created_by_name text default '';
alter table topics    add column if not exists created_by_name text default '';
alter table chapters  add column if not exists created_by_name text default '';
alter table questions add column if not exists created_by_name text default '';

-- One function for all four tables — the column names are identical.
create or replace function set_created_by() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  if coalesce(new.created_by_name, '') = '' then
    select coalesce(nullif(p.full_name, ''), p.email, '')
      into new.created_by_name
      from profiles p
     where p.id = new.created_by;
  end if;
  return new;
end $$;

drop trigger if exists trg_lectures_created_by on lectures;
create trigger trg_lectures_created_by before insert on lectures
  for each row execute function set_created_by();

drop trigger if exists trg_topics_created_by on topics;
create trigger trg_topics_created_by before insert on topics
  for each row execute function set_created_by();

drop trigger if exists trg_chapters_created_by on chapters;
create trigger trg_chapters_created_by before insert on chapters
  for each row execute function set_created_by();

drop trigger if exists trg_questions_created_by on questions;
create trigger trg_questions_created_by before insert on questions
  for each row execute function set_created_by();

-- Rows that already existed keep an empty creator; the UI just omits the
-- "added by" line for them rather than inventing an author.
