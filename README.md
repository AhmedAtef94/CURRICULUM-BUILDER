# Curriculum Builder

A role-based web app to plan and manage educational curricula — organize
**subjects → lectures → topics → chapters → questions**, assign subjects to
team members, and control who can view or edit what.

**Live app:** https://ahmedatef94.github.io/CURRICULUM-BUILDER/

## Features

- Hierarchical curriculum: subjects, lectures, topics, chapters, and questions (essay & MCQ, with images)
- Role-based access — super admin, admin, editor, viewer
- Per-editor subject assignments (editors only see subjects assigned to them)
- Tracks who added each item and when
- Arabic (RTL) interface

## Tech

- **Frontend:** React + Vite (deployed on GitHub Pages)
- **Backend:** Supabase (Postgres, Auth, Row-Level Security, Storage, Edge Functions)

## Project layout

| Path | What it is |
|------|-----------|
| `elkheta-react/` | The React app (the deployed site) |
| `supabase/functions/create-user/` | Edge Function for admin user management |
| `supabase_schema.sql` | Database schema, roles, and RLS policies |
| `supabase_*_fix.sql` | Incremental migrations (permissions, performance, audit) |

## Develop

```bash
cd elkheta-react
npm install
npm run dev
```

## Deploy

Pushing to `main` builds and publishes to GitHub Pages automatically.
See [DEPLOY.md](DEPLOY.md) for the one-time setup.
