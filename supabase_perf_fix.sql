-- =====================================================================
-- PERFORMANCE FIX — read policies were doing pointless joins per row
--
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run. It changes NO permissions — only how they're evaluated.
--
-- The problem
-- -----------
-- can_view_subject(sid) ignores its argument entirely; its whole body is
-- `select auth.uid() is not null`. But the SELECT policies were calling it
-- as can_view_subject(subject_of_chapter(chapter_id)), so for EVERY row
-- Postgres ran a 3-table join (chapters→topics→lectures) and then threw the
-- result away. On a subject with a few hundred questions that is hundreds of
-- wasted joins on every page load.
--
-- The fix
-- -------
-- Call the check directly. `(select auth.uid())` is wrapped in a scalar
-- subquery so Postgres evaluates it once per statement instead of per row —
-- the standard Supabase RLS optimisation.
--
-- Permissions are IDENTICAL before and after: any signed-in user can read
-- all curriculum content, exactly as before. Write policies are untouched.
-- =====================================================================

-- ---- READ policies: no joins, no per-row function calls ----
drop policy if exists lectures_read on lectures;
create policy lectures_read on lectures for select
  using ( (select auth.uid()) is not null );

drop policy if exists topics_read on topics;
create policy topics_read on topics for select
  using ( (select auth.uid()) is not null );

drop policy if exists chapters_read on chapters;
create policy chapters_read on chapters for select
  using ( (select auth.uid()) is not null );

drop policy if exists questions_read on questions;
create policy questions_read on questions for select
  using ( (select auth.uid()) is not null );

drop policy if exists subjects_read on subjects;
create policy subjects_read on subjects for select
  using ( (select auth.uid()) is not null );

-- ---- Indexes the tree queries actually sort on ----
-- The client orders every level by (position, created_at); without these the
-- planner sorts each nested group on the fly.
create index if not exists idx_lectures_subject_pos on lectures(subject_id, position);
create index if not exists idx_topics_lecture_pos   on topics(lecture_id, position);
create index if not exists idx_chapters_topic_pos   on chapters(topic_id, position);
create index if not exists idx_questions_chapter_pos on questions(chapter_id, position);

-- Refresh planner statistics so the new indexes get used immediately.
analyze lectures;
analyze topics;
analyze chapters;
analyze questions;
