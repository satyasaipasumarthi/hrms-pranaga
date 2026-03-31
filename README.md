# PraNaga HRMS

## Admin Access Control

The admin invite flow is wired into the app through the admin-only `Access Control` page.

- Route: `/access-control`
- Page: [src/pages/AccessControl.tsx](/c:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/pages/AccessControl.tsx)
- Client API: [src/lib/hrms-api.ts](/c:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/src/lib/hrms-api.ts)
- Edge Function: [supabase/functions/admin-invite-user/index.ts](/c:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/supabase/functions/admin-invite-user/index.ts)

Admin can grant only:

- `employee`
- `manager`
- `hr`

Admin access itself is intentionally not granted from this page.

## How Invites Work

1. Admin opens `Access Control`.
2. Admin enters `name`, `email`, `role`, `department`, and optionally a manager for employee invites.
3. The app calls the `admin-invite-user` Supabase Edge Function.
4. The function verifies that the caller is an admin.
5. Supabase Auth sends an invite email for new users.
6. The function upserts the backend profile with the selected role data.
7. The function records the action in `access_grants`.
8. After the invited user accepts the email and logs in, access is allocated from backend role data.

## Backend Role Allocation

The invited user does not choose their own role.

Access comes from backend state:

- `profiles.role`
- `role_permissions`
- `module_access`

That means:

- `employee` gets own-scope access
- `manager` gets team-scope access where configured
- `hr` gets organization-scope access
- `admin` remains unchanged

## Supabase Setup For Live

Run the focused SQL in:

- [supabase/access-control-go-live.sql](/c:/Users/MEGHAVATH%20CHARAN/Downloads/pranaga-nexus-7c1302fc-main%20(1)/pranaga-nexus-7c1302fc-main/supabase/access-control-go-live.sql)

Deploy the Edge Function:

```bash
supabase functions deploy admin-invite-user
```

Set the custom redirect secret:

```bash
supabase secrets set INVITE_REDIRECT_URL=https://YOUR_LIVE_DOMAIN/login
```

Important:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Supabase Edge Functions.
- Only `INVITE_REDIRECT_URL` needs to be set manually here.

## Auth URL Configuration

In Supabase Auth:

- set `Site URL` to your app root URL
- add your live app URL to `Redirect URLs`
- keep Email auth enabled
- configure SMTP if you want branded production invite emails

## Go-Live Checklist

Before going live, verify:

- admin sees `Access Control` in the sidebar
- admin can invite `employee`, `manager`, and `hr`
- invited user receives the Supabase invite email
- invite link opens the real app URL, not localhost
- login resolves the correct backend role
- sidebar and route access match the assigned role
- direct URL access is still protected
