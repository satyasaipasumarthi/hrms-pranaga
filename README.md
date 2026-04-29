# PraNaga HRMS Portal

PraNaga HRMS is a role-based Human Resource Management portal built with React, TypeScript, Vite, Tailwind CSS, and Supabase.

The system is designed to support day-to-day people operations for PraNaga, including attendance tracking, leave management, payroll visibility, performance review visibility, employee directory access, recruitment visibility, recognition through kudos, and admin-led access control.

## Overview

This portal has two major responsibilities:

1. HRMS operations for different user roles:
   - `employee`
   - `manager`
   - `hr`
   - `admin`
2. Role-based access enforcement using backend-driven permissions from Supabase.

The frontend does not rely only on hidden buttons. Access is resolved from backend role data and enforced through:

- Supabase authentication
- profile-based role resolution
- `role_permissions`
- `module_access`
- route guards in the React app
- backend data-scope filtering

## Tech Stack

- Frontend: React 18, TypeScript, Vite
- Styling: Tailwind CSS, custom design system, Framer Motion
- State/Auth: Zustand
- Routing: React Router
- Backend: Supabase
- Data/Auth/Functions: Supabase Postgres, Auth, Edge Functions
- Testing: Vitest
- Deployment: Vercel for frontend, Supabase for backend services

## Current Application Routes

Defined in [src/App.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/App.tsx):

- `/login`
- `/`
- `/attendance`
- `/leave`
- `/payroll`
- `/performance`
- `/employees`
- `/recruitment`
- `/team`
- `/wall-of-fame`
- `/access-control`
- `/settings`

All protected routes pass through [src/components/layout/ProtectedRoute.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/components/layout/ProtectedRoute.tsx).

## Core Architecture

### 1. Authentication and Access Context

The main auth and access state is handled in [src/hooks/useAuth.ts](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/hooks/useAuth.ts).

Responsibilities:

- sign in with Supabase Auth
- initialize session on app load
- hydrate user context from backend profile data
- build permission map from backend permissions
- expose `user`, `permissions`, `homePath`, and loading state

### 2. Roles and Permissions

Role definitions and fallback permissions are defined in [src/lib/roles.ts](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/lib/roles.ts).

Permission resolution helpers are in [src/lib/permissions.ts](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/lib/permissions.ts).

Important behavior:

- backend `role_permissions` is the primary source of truth
- frontend role definitions act as fallback defaults if backend permission tables are missing
- module visibility and actions are resolved per module and per action:
  - `view`
  - `create`
  - `update`
  - `delete`
  - `approve`

Supported data scopes:

- `none`
- `own`
- `team`
- `organization`
- `all`

### 3. Data Access Layer

Most backend reads and writes are handled in [src/lib/hrms-api.ts](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/lib/hrms-api.ts).

This file handles:

- auth access context resolution
- profile loading
- attendance reads/writes
- leave reads/writes
- payroll reads
- performance reads
- kudos reads/writes
- employee directory reads
- access grant actions
- edge function calls

### 4. Layout

The shared app shell is built from:

- [src/components/layout/MainLayout.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/components/layout/MainLayout.tsx)
- [src/components/layout/Topbar.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/components/layout/Topbar.tsx)
- sidebar layout components

The topbar includes:

- greeting
- live clock
- global attendance controls:
  - `Check In`
  - `Pause / Resume`
  - `Check Out`
- notification bell
- role badge
- user avatar

## Functional Modules

### Dashboard

File: [src/pages/Dashboard.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Dashboard.tsx)

Purpose:

- provides a role-aware overview of visible attendance, leave, kudos, and workforce data
- adapts metrics based on the user’s permitted scope

Examples:

- employee sees own-relevant summary
- manager sees team-oriented summary
- HR sees organization-level summary
- admin sees full-system summary

### Attendance

Files:

- [src/pages/Attendance.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Attendance.tsx)
- [src/hooks/useAttendanceActions.ts](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/hooks/useAttendanceActions.ts)
- [src/lib/attendance.ts](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/lib/attendance.ts)
- [src/lib/hrms-api.ts](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/lib/hrms-api.ts)

Core behavior:

- one attendance row per employee per business day
- `Check In` creates the day’s active row
- `Pause` stores pause start time
- `Resume` continues timing and excludes paused duration
- `Check Out` updates the same daily row
- final status is calculated from worked hours excluding pause duration

Attendance status rules:

- less than `3 hours` = `Absent`
- `3 hours` to less than `5 hours` = `Half Day`
- `5 hours` or more = `Full Day`

Attendance supports:

- current schema path
- legacy schema compatibility
- stale shift recovery
- duplicate cleanup support
- pause/resume fields when available in Supabase

### Leave

File: [src/pages/Leave.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Leave.tsx)

Behavior:

- employees can apply leave for themselves
- managers can view and approve team leave
- HR can apply leave and approve organization leave
- admin can manage leave across the system

### Payroll

File: [src/pages/Payroll.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Payroll.tsx)

Behavior:

- employees see only their own payroll
- managers see only their own payroll data
- HR and admin can view broader payroll visibility according to backend permissions
- payslip download depends on valid public PDF URLs in Supabase data

### Performance

File: [src/pages/Performance.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Performance.tsx)

Behavior:

- shows performance review visibility by access scope
- employee sees own performance
- manager sees team performance
- HR/admin can view wider scopes when permitted

### Employees

File: [src/pages/Employees.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Employees.tsx)

Behavior:

- shows personnel directory
- includes:
  - name
  - email
  - department
  - reporting manager
  - role
- admin can see an additional `Delete User` action column
- current logged-in admin is protected from self-delete

### Recruitment

File: [src/pages/Recruitment.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Recruitment.tsx)

Behavior:

- HR and admin can access recruitment pipeline visibility
- managers and employees are blocked unless permissions are expanded

### Team

File: [src/pages/Team.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Team.tsx)

Behavior:

- team-centric profile visibility for roles that have access

### Wall of Fame

File: [src/pages/WallOfFame.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/WallOfFame.tsx)

Behavior:

- shows visible kudos feed
- admin, manager, and HR can create kudos when backend permission rows allow it
- employee can view the feed and own dashboard kudos but does not create kudos unless permissions are changed

### Access Control

File: [src/pages/AccessControl.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/AccessControl.tsx)

Purpose:

- admin-only role onboarding and invitation control
- assigns:
  - `employee`
  - `manager`
  - `hr`
- captures:
  - name
  - email
  - role
  - department
  - reporting manager

Important:

- admin role is not granted from this UI
- admin creation is intentionally handled through backend/manual profile updates

### Settings

File: [src/pages/Settings.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Settings.tsx)

Behavior:

- admin-only system configuration area

## Role Model

Roles supported by the app:

- `employee`
- `manager`
- `hr`
- `admin`

### Role Summary

#### Employee

- own attendance
- own leave
- own payroll
- own performance
- wall of fame view

#### Manager

- team dashboard
- team attendance visibility
- team leave approvals
- team performance visibility
- own payroll
- wall of fame access
- can give kudos to organization when backend permission is configured

#### HR

- organization attendance
- organization leave and leave approvals
- organization payroll visibility
- organization performance visibility
- employees directory
- recruitment
- wall of fame
- can give kudos to organization

#### Admin

- full-system route access
- full-system data scope
- access control
- settings
- employees delete action
- admin-led user lifecycle operations

## Reporting Manager Model

Reporting manager support is implemented with:

- `public.reporting_managers`
- `profiles.reporting_manager_id`
- `access_grants.reporting_manager_id`

Setup SQL:

- [supabase/reporting-manager-setup.sql](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/supabase/reporting-manager-setup.sql)

Current seeded reporting manager names:

- `Raviteja`
- `Darshan`
- `Sindhuja`
- `Sai Nithya`
- `Satya Sai`

## Supabase Schema and SQL Support Files

### Primary SQL / Setup Files

- [supabase/access-control-go-live.sql](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/supabase/access-control-go-live.sql)
  - creates role/module access tables
  - creates access grants table
  - seeds access-control module data
  - enables required RLS policies

- [supabase/reporting-manager-setup.sql](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/supabase/reporting-manager-setup.sql)
  - creates reporting manager table
  - links profiles and access grants to reporting managers

- [supabase/attendance-cleanup.sql](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/supabase/attendance-cleanup.sql)
  - cleans duplicate legacy/current attendance rows
  - preserves a backup table before cleanup

- [supabase/attendance-pause-fields.sql](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/supabase/attendance-pause-fields.sql)
  - adds pause/resume attendance fields:
    - `is_paused`
    - `pause_start_time`
    - `total_paused_duration`

- [supabase/kudos-leave-permission-fix.sql](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/supabase/kudos-leave-permission-fix.sql)
  - updates specific live permission rows for kudos and leave

### Edge Functions

- [supabase/functions/admin-invite-user/index.ts](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/supabase/functions/admin-invite-user/index.ts)
  - admin-only invite flow
  - creates or updates access grant records
  - sends user invitation flow through Supabase Auth

- [supabase/functions/admin-delete-user/index.ts](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/supabase/functions/admin-delete-user/index.ts)
  - admin-only delete flow
  - removes user from auth and related portal records
  - prevents deleting the currently logged-in admin

Supabase function config:

- [supabase/config.toml](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/supabase/config.toml)

Current functions configured:

- `admin-invite-user`
- `admin-delete-user`

## Invite Flow

1. Admin opens `Access Control`
2. Admin enters user details
3. Admin selects role
4. Admin optionally selects reporting manager
5. App calls `admin-invite-user`
6. Supabase Auth sends invite email
7. User opens invite link
8. User completes password setup / login flow
9. Access is resolved from backend profile + permissions

Important operational note:

- Vercel deployment does not deploy Supabase Edge Functions
- Edge Functions must be deployed separately with the Supabase CLI

## Delete User Flow

1. Admin opens `Employees`
2. Admin clicks `Delete User`
3. Frontend calls `admin-delete-user`
4. Edge Function validates admin role
5. Edge Function deletes linked records and auth user
6. Employee list refreshes

## Auth and Redirect Notes

Supabase Auth URL configuration must be correct in production:

- `Site URL` should be the live app URL
- `Redirect URLs` should include the live domain
- if invite or recovery links point to localhost, Supabase URL configuration is outdated

This project also includes recovery/invite redirect handling in the frontend login flow.

## Local Development

### Prerequisites

- Node.js
- npm
- Supabase project access

### Install

```bash
npm install
```

### Start dev server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Run tests

```bash
npm run test
```

## Frontend Deployment

Frontend is intended for Vercel deployment.

SPA routing support is configured in [vercel.json](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/vercel.json):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/"
    }
  ]
}
```

Important:

- GitHub push triggers Vercel deployment only if the correct repo and branch are connected in Vercel
- Supabase SQL changes and Edge Function deploys are separate from Vercel frontend deployment

## Supabase Operations Checklist

When setting up a fresh environment, confirm these items:

1. run access-control SQL
2. run reporting-manager setup SQL
3. run attendance pause fields SQL if pause/resume is required
4. run permission fix SQL if live permission rows need syncing
5. deploy `admin-invite-user`
6. deploy `admin-delete-user`
7. verify Supabase Auth `Site URL`
8. verify Supabase Auth `Redirect URLs`

## Common Commands

Deploy admin invite function:

```bash
npx supabase functions deploy admin-invite-user
```

Deploy admin delete function:

```bash
npx supabase functions deploy admin-delete-user
```

Set invite redirect:

```bash
npx supabase secrets set INVITE_REDIRECT_URL=https://YOUR_DOMAIN/login
```

## Troubleshooting Notes

### Invite email not arriving

Usually caused by:

- default Supabase SMTP limitations
- missing custom SMTP provider
- rate limits

### Invite or recovery link opens localhost

Usually caused by:

- old Supabase Auth `Site URL`
- missing live redirect URL
- old invite/recovery email generated before the fix

### Pause / Resume fails

Usually caused by:

- `attendance-pause-fields.sql` not yet run in Supabase

### Employees page shows `Not assigned` for reporting manager

Check:

- `profiles.reporting_manager_id`
- `reporting_managers`
- whether the latest frontend build is running

### Delete User fails

Check:

- `admin-delete-user` function is deployed
- function config exists in `supabase/config.toml`
- user is logged in as admin

## Key Source Files

### Frontend

- [src/App.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/App.tsx)
- [src/hooks/useAuth.ts](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/hooks/useAuth.ts)
- [src/lib/hrms-api.ts](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/lib/hrms-api.ts)
- [src/lib/permissions.ts](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/lib/permissions.ts)
- [src/lib/roles.ts](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/lib/roles.ts)
- [src/components/layout/MainLayout.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/components/layout/MainLayout.tsx)
- [src/components/layout/Topbar.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/components/layout/Topbar.tsx)

### Pages

- [src/pages/Dashboard.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Dashboard.tsx)
- [src/pages/Attendance.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Attendance.tsx)
- [src/pages/Leave.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Leave.tsx)
- [src/pages/Payroll.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Payroll.tsx)
- [src/pages/Performance.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Performance.tsx)
- [src/pages/Employees.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Employees.tsx)
- [src/pages/Recruitment.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Recruitment.tsx)
- [src/pages/Team.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Team.tsx)
- [src/pages/WallOfFame.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/WallOfFame.tsx)
- [src/pages/AccessControl.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/AccessControl.tsx)
- [src/pages/Settings.tsx](/C:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/Settings.tsx)

## Summary

PraNaga HRMS is a backend-driven, role-aware HRMS portal with:

- module-level route protection
- backend-scoped visibility
- admin-controlled onboarding
- attendance with pause/resume
- leave workflows
- payroll and performance visibility
- employee directory and user deletion
- recruitment access
- organization-wide recognition via kudos

This README is intended to serve as the main system documentation for the current portal state.
