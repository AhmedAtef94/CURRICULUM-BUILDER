-- =====================================================================
-- ELKHETA CURRICULUM PLAN — Supabase Schema
-- =====================================================================
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New query → Run
-- It creates: roles, tables, permissions (RLS), and auto-profile signup.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) ROLES (الأدوار)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('super_admin', 'admin', 'editor', 'viewer');
  end if;
end$$;


-- ---------------------------------------------------------------------
-- 2) PROFILES (بيانات اليوزر + دوره)
--    Extends the built-in auth.users table.
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  role       user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new user signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'viewer'                       -- everyone starts as viewer; super_admin promotes them
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ---------------------------------------------------------------------
-- 3) SUBJECTS (المواد)
-- ---------------------------------------------------------------------
create table if not exists subjects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text default '#facc15',
  grade      text,                          -- J4..S3 (school year)
  term       text,                          -- T1 | T2 | ALL
  position   int  default 0,
  created_at timestamptz not null default now()
);
-- add the columns for databases created before grade/term existed:
alter table subjects add column if not exists grade text;
alter table subjects add column if not exists term  text;


-- ---------------------------------------------------------------------
-- 4) USER_SUBJECTS (ربط عضو الفريق بمواده)
--    Which editor is assigned to which subject.
-- ---------------------------------------------------------------------
create table if not exists user_subjects (
  user_id    uuid references profiles(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  primary key (user_id, subject_id)
);


-- ---------------------------------------------------------------------
-- 5) CONTENT TREE (المحتوى الهرمي)
--    subject → lectures → topics → chapters → questions
-- ---------------------------------------------------------------------
create table if not exists lectures (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  title      text not null,
  position   int  default 0,
  collapsed  boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists topics (
  id         uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references lectures(id) on delete cascade,
  title      text not null,
  position   int  default 0,
  collapsed  boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists chapters (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references topics(id) on delete cascade,
  title      text not null,
  start_time text default '',
  end_time   text default '',
  position   int  default 0,
  collapsed  boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id         uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  type       text not null check (type in ('essay', 'mcq')),
  q          text not null,                 -- question text
  img        text default '',               -- Storage URL (not base64)
  a          text default '',               -- essay: model answer
  options    jsonb default '[]'::jsonb,      -- mcq: ["A","B","C","D"]
  correct    text default '',               -- mcq: 'A' | 'B' | 'C' | 'D'
  position   int  default 0,
  created_at timestamptz not null default now()
);

-- Helpful indexes for the tree lookups.
create index if not exists idx_lectures_subject on lectures(subject_id);
create index if not exists idx_topics_lecture  on topics(lecture_id);
create index if not exists idx_chapters_topic  on chapters(topic_id);
create index if not exists idx_questions_chapter on questions(chapter_id);


-- =====================================================================
-- 6) PERMISSION HELPERS (دوال الصلاحيات)
--    SECURITY DEFINER so they can read profiles without RLS recursion.
-- =====================================================================
create or replace function my_role()
returns user_role
language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

create or replace function is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(my_role() = 'super_admin', false) $$;

-- admin or super_admin → full content access on ALL subjects
create or replace function is_content_manager()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(my_role() in ('super_admin', 'admin'), false) $$;

-- Can this user EDIT content of a given subject?
--   super_admin/admin → any subject; editor → only assigned subjects.
create or replace function can_edit_subject(sid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    is_content_manager()
    or exists (
      select 1 from user_subjects us
      where us.user_id = auth.uid()
        and us.subject_id = sid
        and my_role() = 'editor'
    );
$$;

-- Everyone signed-in can READ every subject (viewers included).
-- If you want editors to ONLY SEE their own subjects, change this to
-- `can_edit_subject(sid)` in the SELECT policies below.
create or replace function can_view_subject(sid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select auth.uid() is not null $$;

-- Resolve the owning subject_id from any node in the tree.
create or replace function subject_of_lecture(lid uuid)
returns uuid language sql stable security definer set search_path = public
as $$ select subject_id from lectures where id = lid $$;

create or replace function subject_of_topic(tid uuid)
returns uuid language sql stable security definer set search_path = public
as $$ select l.subject_id from topics t join lectures l on l.id = t.lecture_id where t.id = tid $$;

create or replace function subject_of_chapter(cid uuid)
returns uuid language sql stable security definer set search_path = public
as $$
  select l.subject_id
  from chapters c
  join topics t on t.id = c.topic_id
  join lectures l on l.id = t.lecture_id
  where c.id = cid
$$;

create or replace function subject_of_question(qid uuid)
returns uuid language sql stable security definer set search_path = public
as $$
  select l.subject_id
  from questions q
  join chapters c on c.id = q.chapter_id
  join topics t on t.id = c.topic_id
  join lectures l on l.id = t.lecture_id
  where q.id = qid
$$;


-- =====================================================================
-- 7) ENABLE RLS + POLICIES
-- =====================================================================
alter table profiles      enable row level security;
alter table subjects      enable row level security;
alter table user_subjects enable row level security;
alter table lectures      enable row level security;
alter table topics        enable row level security;
alter table chapters      enable row level security;
alter table questions     enable row level security;

-- ---- PROFILES ----
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select
  using ( id = auth.uid() or is_content_manager() );  -- see self; managers see everyone

drop policy if exists profiles_super_write on profiles;
create policy profiles_super_write on profiles for update
  using ( is_super_admin() ) with check ( is_super_admin() );  -- only super_admin changes roles

-- ---- SUBJECTS ----
drop policy if exists subjects_read on subjects;
create policy subjects_read on subjects for select
  using ( can_view_subject(id) );

drop policy if exists subjects_write on subjects;
create policy subjects_write on subjects for all
  using ( is_content_manager() ) with check ( is_content_manager() );  -- create/rename/delete subjects

-- ---- USER_SUBJECTS (assignments) ----
drop policy if exists user_subjects_read on user_subjects;
create policy user_subjects_read on user_subjects for select
  using ( user_id = auth.uid() or is_content_manager() );

drop policy if exists user_subjects_write on user_subjects;
create policy user_subjects_write on user_subjects for all
  using ( is_super_admin() ) with check ( is_super_admin() );  -- only super_admin assigns subjects

-- ---- LECTURES ----
-- NOTE on the *_read policies below: can_view_subject() ignores its argument
-- (every signed-in user may read all content), so they check auth.uid()
-- directly. Passing subject_of_chapter(...) & co. would make Postgres run a
-- multi-table join for every single row and then discard the result.
-- If you ever restrict reads per subject, switch these to
-- can_edit_subject(<subject id>) — and expect them to cost more.
drop policy if exists lectures_read on lectures;
create policy lectures_read on lectures for select
  using ( (select auth.uid()) is not null );
drop policy if exists lectures_write on lectures;
create policy lectures_write on lectures for all
  using ( can_edit_subject(subject_id) ) with check ( can_edit_subject(subject_id) );

-- ---- TOPICS ----
drop policy if exists topics_read on topics;
create policy topics_read on topics for select
  using ( (select auth.uid()) is not null );
drop policy if exists topics_write on topics;
create policy topics_write on topics for all
  using ( can_edit_subject(subject_of_lecture(lecture_id)) )
  with check ( can_edit_subject(subject_of_lecture(lecture_id)) );

-- ---- CHAPTERS ----
drop policy if exists chapters_read on chapters;
create policy chapters_read on chapters for select
  using ( (select auth.uid()) is not null );
drop policy if exists chapters_write on chapters;
create policy chapters_write on chapters for all
  using ( can_edit_subject(subject_of_topic(topic_id)) )
  with check ( can_edit_subject(subject_of_topic(topic_id)) );

-- ---- QUESTIONS ----
drop policy if exists questions_read on questions;
create policy questions_read on questions for select
  using ( (select auth.uid()) is not null );
drop policy if exists questions_write on questions;
create policy questions_write on questions for all
  using ( can_edit_subject(subject_of_chapter(chapter_id)) )
  with check ( can_edit_subject(subject_of_chapter(chapter_id)) );


-- =====================================================================
-- 8) STORAGE for question images (بدل الـ Base64)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

drop policy if exists qimg_read on storage.objects;
create policy qimg_read on storage.objects for select
  using ( bucket_id = 'question-images' );  -- public read (also lets the Consumer Team load images)

drop policy if exists qimg_write on storage.objects;
create policy qimg_write on storage.objects for insert
  with check ( bucket_id = 'question-images' and auth.uid() is not null );


-- =====================================================================
-- 9) BOOTSTRAP YOUR FIRST SUPER ADMIN (اعمل نفسك سوبر أدمن)
-- =====================================================================
-- STEP A: In the app (or Supabase → Authentication → Users) create your
--         account with ahmedatef31100@gmail.com first.
-- STEP B: Then run the line below ONCE to promote yourself:
--
--   update profiles set role = 'super_admin' where email = 'ahmedatef31100@gmail.com';
--
-- After that, you manage everyone else from inside the app.
-- =====================================================================
