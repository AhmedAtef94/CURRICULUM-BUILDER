-- =====================================================================
-- PERMISSIONS FIX — users may now only see the subjects assigned to them
--
-- Run once: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run. Run this AFTER supabase_perf_fix.sql (it replaces the
-- read policies that file created).
--
-- BEHAVIOUR CHANGE — read this before running
-- -------------------------------------------
--   super_admin / admin : sees and edits every subject      (unchanged)
--   editor              : sees ONLY assigned subjects, and can edit those
--   viewer              : sees every subject, read-only     (unchanged)
--
-- Previously EVERY signed-in user could read EVERY subject — editors
-- included — because can_view_subject() ignored its argument and only
-- checked "is anyone logged in?". Restricting editors is the fix.
--
-- ⚠️ Existing editors with no assignments will see an empty subjects page
-- until a super_admin assigns them something. That is the intended
-- behaviour, but it looks like data disappeared — assign before or right
-- after running this.
--
-- HOW IT STAYS FAST
-- -----------------
-- Checking "which subject does this question belong to?" used to mean a
-- 3-table join for every single row. Instead each level now carries its own
-- subject_id, filled automatically by a trigger, so every policy is one
-- indexed comparison.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Make the visibility check actually check something
-- ---------------------------------------------------------------------
-- Only `editor` is scoped to assignments. Managers own everything; viewers
-- keep read-only access to the whole curriculum.
create or replace function can_view_subject(sid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when is_content_manager() then true
    when my_role() = 'editor' then exists (
      select 1 from user_subjects us
      where us.user_id = (select auth.uid()) and us.subject_id = sid
    )
    else (select auth.uid()) is not null
  end;
$$;

-- Same shape, wrapped auth.uid() so it is evaluated once per statement.
create or replace function can_edit_subject(sid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select is_content_manager()
      or exists (
        select 1 from user_subjects us
        where us.user_id = (select auth.uid())
          and us.subject_id = sid
          and my_role() = 'editor'
      );
$$;

-- ---------------------------------------------------------------------
-- 2) Carry subject_id down the tree so policies never need a join
-- ---------------------------------------------------------------------
alter table topics    add column if not exists subject_id uuid references subjects(id) on delete cascade;
alter table chapters  add column if not exists subject_id uuid references subjects(id) on delete cascade;
alter table questions add column if not exists subject_id uuid references subjects(id) on delete cascade;

-- Backfill existing rows, top-down (each level feeds the next).
update topics t
   set subject_id = l.subject_id
  from lectures l
 where l.id = t.lecture_id
   and t.subject_id is distinct from l.subject_id;

update chapters c
   set subject_id = t.subject_id
  from topics t
 where t.id = c.topic_id
   and c.subject_id is distinct from t.subject_id;

update questions q
   set subject_id = c.subject_id
  from chapters c
 where c.id = q.chapter_id
   and q.subject_id is distinct from c.subject_id;

-- Keep it correct forever: the client never sends subject_id, the trigger
-- derives it from the parent on every insert and on any re-parenting.
create or replace function set_topic_subject() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select l.subject_id into new.subject_id from lectures l where l.id = new.lecture_id;
  return new;
end $$;

create or replace function set_chapter_subject() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select t.subject_id into new.subject_id from topics t where t.id = new.topic_id;
  return new;
end $$;

create or replace function set_question_subject() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select c.subject_id into new.subject_id from chapters c where c.id = new.chapter_id;
  return new;
end $$;

drop trigger if exists trg_topic_subject on topics;
create trigger trg_topic_subject before insert or update of lecture_id on topics
  for each row execute function set_topic_subject();

drop trigger if exists trg_chapter_subject on chapters;
create trigger trg_chapter_subject before insert or update of topic_id on chapters
  for each row execute function set_chapter_subject();

drop trigger if exists trg_question_subject on questions;
create trigger trg_question_subject before insert or update of chapter_id on questions
  for each row execute function set_question_subject();

create index if not exists idx_topics_subject    on topics(subject_id);
create index if not exists idx_chapters_subject  on chapters(subject_id);
create index if not exists idx_questions_subject on questions(subject_id);

-- ---------------------------------------------------------------------
-- 3) Policies — one indexed check per row, no joins
-- ---------------------------------------------------------------------
drop policy if exists subjects_read on subjects;
create policy subjects_read on subjects for select
  using ( can_view_subject(id) );

drop policy if exists lectures_read on lectures;
create policy lectures_read on lectures for select
  using ( can_view_subject(subject_id) );
drop policy if exists lectures_write on lectures;
create policy lectures_write on lectures for all
  using ( can_edit_subject(subject_id) ) with check ( can_edit_subject(subject_id) );

drop policy if exists topics_read on topics;
create policy topics_read on topics for select
  using ( can_view_subject(subject_id) );
drop policy if exists topics_write on topics;
create policy topics_write on topics for all
  using ( can_edit_subject(subject_id) ) with check ( can_edit_subject(subject_id) );

drop policy if exists chapters_read on chapters;
create policy chapters_read on chapters for select
  using ( can_view_subject(subject_id) );
drop policy if exists chapters_write on chapters;
create policy chapters_write on chapters for all
  using ( can_edit_subject(subject_id) ) with check ( can_edit_subject(subject_id) );

drop policy if exists questions_read on questions;
create policy questions_read on questions for select
  using ( can_view_subject(subject_id) );
drop policy if exists questions_write on questions;
create policy questions_write on questions for all
  using ( can_edit_subject(subject_id) ) with check ( can_edit_subject(subject_id) );

analyze topics;
analyze chapters;
analyze questions;

-- ---------------------------------------------------------------------
-- 4) Verify — every row must have a subject_id, or it becomes invisible
-- ---------------------------------------------------------------------
-- Each of these must return 0.
select 'topics missing subject_id'    as check, count(*) from topics    where subject_id is null
union all
select 'chapters missing subject_id',        count(*) from chapters  where subject_id is null
union all
select 'questions missing subject_id',       count(*) from questions where subject_id is null;
