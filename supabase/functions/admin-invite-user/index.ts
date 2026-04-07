import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedRoles = new Set(["employee", "manager", "hr"]);

const isMissingResourceError = (error: { code?: string | null; message?: string | null } | null | undefined) => {
  if (!error) {
    return false;
  }

  const haystack = [error.code, error.message].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes("does not exist") || haystack.includes("could not find") || error.code === "42P01" || error.code === "42703" || error.code === "PGRST204";
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const resolveInviteRedirectUrl = (request: Request) => {
  const configuredUrl = Deno.env.get("INVITE_REDIRECT_URL")?.trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  const originHeader = request.headers.get("origin")?.trim();
  if (!originHeader) {
    return undefined;
  }

  try {
    return new URL("/login", originHeader).toString();
  } catch {
    return undefined;
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Supabase environment variables are not configured." }, 500);
  }

  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization header." }, 401);
  }

  try {
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user: callerUser },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !callerUser) {
      return jsonResponse({ error: "You must be signed in to grant access." }, 401);
    }

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (callerProfileError) {
      throw callerProfileError;
    }

    if (!callerProfile || callerProfile.role !== "admin") {
      return jsonResponse({ error: "Only administrators can grant access." }, 403);
    }

    const payload = (await request.json()) as {
      email?: string;
      name?: string;
      role?: string;
      department?: string | null;
      reportingManagerId?: string | null;
    };

    const email = payload.email?.trim().toLowerCase();
    const name = payload.name?.trim();
    const role = payload.role?.trim().toLowerCase();
    const department = payload.department?.trim() || "Operations";
    const reportingManagerId = payload.reportingManagerId?.trim() || null;

    if (!email || !name || !role) {
      return jsonResponse({ error: "Name, email, and role are required." }, 400);
    }

    if (!allowedRoles.has(role)) {
      return jsonResponse({ error: "Only employee, manager, and hr roles can be granted from this page." }, 400);
    }

    let normalizedManagerId: string | null = null;
    let normalizedReportingManagerId: string | null = null;
    let reportingManagerName: string | null = null;

    if (role === "employee" && reportingManagerId) {
      const { data: reportingManager, error: reportingManagerError } = await adminClient
        .from("reporting_managers")
        .select("id, name, profile_id, is_active")
        .eq("id", reportingManagerId)
        .maybeSingle();

      if (reportingManagerError && !isMissingResourceError(reportingManagerError)) {
        throw reportingManagerError;
      }

      if (!reportingManagerError && (!reportingManager || reportingManager.is_active !== true)) {
        return jsonResponse({ error: "The selected reporting manager is invalid or inactive." }, 400);
      }

      if (reportingManager) {
        normalizedReportingManagerId = reportingManager.id;
        reportingManagerName = reportingManager.name;
        normalizedManagerId = reportingManager.profile_id ?? null;
      } else {
        const { data: legacyManagerProfile, error: legacyManagerError } = await adminClient
          .from("profiles")
          .select("id, name, role, is_active")
          .eq("id", reportingManagerId)
          .maybeSingle();

        if (legacyManagerError) {
          throw legacyManagerError;
        }

        if (!legacyManagerProfile || legacyManagerProfile.role !== "manager" || legacyManagerProfile.is_active !== true) {
          return jsonResponse({ error: "The selected reporting manager is invalid or inactive." }, 400);
        }

        normalizedManagerId = legacyManagerProfile.id;
        reportingManagerName = legacyManagerProfile.name;
      }
    }

    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("email", email)
      .maybeSingle();

    if (existingProfileError) {
      throw existingProfileError;
    }

    if (existingProfile?.role === "admin") {
      return jsonResponse({ error: "Admin accounts cannot be changed from the access-control page." }, 400);
    }

    let authUserId = existingProfile?.id ?? null;
    let message = "Invitation sent successfully.";

    if (!existingProfile) {
      const inviteOptions: {
        data: Record<string, string | null>;
        redirectTo?: string;
      } = {
        data: {
          name,
          role,
          department,
          manager_id: normalizedManagerId,
          reporting_manager_id: normalizedReportingManagerId,
          reporting_manager_name: reportingManagerName,
        },
      };

      const inviteRedirectUrl = resolveInviteRedirectUrl(request);
      if (inviteRedirectUrl) {
        inviteOptions.redirectTo = inviteRedirectUrl;
      }

      const { data: invitedUser, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, inviteOptions);
      if (inviteError) {
        throw inviteError;
      }

      authUserId = invitedUser.user?.id ?? null;
    } else {
      const { error: metadataError } = await adminClient.auth.admin.updateUserById(existingProfile.id, {
        user_metadata: {
          name,
          role,
          department,
          manager_id: normalizedManagerId,
          reporting_manager_id: normalizedReportingManagerId,
          reporting_manager_name: reportingManagerName,
        },
      });

      if (metadataError) {
        throw metadataError;
      }

      message = "Existing user access updated successfully.";
    }

    if (!authUserId) {
      return jsonResponse({ error: "The user account could not be provisioned in Supabase Auth." }, 500);
    }

    const profileUpsertPayload = {
      id: authUserId,
      name,
      email,
      role,
      department,
      manager_id: normalizedManagerId,
      reporting_manager_id: normalizedReportingManagerId,
      is_active: true,
    };

    const { error: profileUpsertError } = await adminClient.from("profiles").upsert(
      profileUpsertPayload,
      { onConflict: "id" },
    );

    if (profileUpsertError && !isMissingResourceError(profileUpsertError)) {
      throw profileUpsertError;
    }

    if (profileUpsertError && isMissingResourceError(profileUpsertError)) {
      const { error: legacyProfileUpsertError } = await adminClient.from("profiles").upsert(
        {
          id: authUserId,
          name,
          email,
          role,
          department,
          manager_id: normalizedManagerId,
          is_active: true,
        },
        { onConflict: "id" },
      );

      if (legacyProfileUpsertError) {
        throw legacyProfileUpsertError;
      }
    }

    const { data: existingGrant, error: existingGrantError } = await adminClient
      .from("access_grants")
      .select("invite_count")
      .eq("email", email)
      .maybeSingle();

    if (existingGrantError) {
      throw existingGrantError;
    }

    const accessGrantPayload = {
      email,
      name,
      role,
      department,
      manager_id: normalizedManagerId,
      reporting_manager_id: normalizedReportingManagerId,
      auth_user_id: authUserId,
      granted_by: callerUser.id,
      invite_count: (existingGrant?.invite_count ?? 0) + 1,
      last_invited_at: new Date().toISOString(),
    };

    const { error: grantUpsertError } = await adminClient.from("access_grants").upsert(
      accessGrantPayload,
      { onConflict: "email" },
    );

    if (grantUpsertError && !isMissingResourceError(grantUpsertError)) {
      throw grantUpsertError;
    }

    if (grantUpsertError && isMissingResourceError(grantUpsertError)) {
      const { error: legacyGrantUpsertError } = await adminClient.from("access_grants").upsert(
        {
          email,
          name,
          role,
          department,
          manager_id: normalizedManagerId,
          auth_user_id: authUserId,
          granted_by: callerUser.id,
          invite_count: (existingGrant?.invite_count ?? 0) + 1,
          last_invited_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );

      if (legacyGrantUpsertError) {
        throw legacyGrantUpsertError;
      }
    }

    return jsonResponse({
      success: true,
      message,
      userId: authUserId,
    });
  } catch (error) {
    console.error("admin-invite-user error:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unexpected error while granting access.",
      },
      500,
    );
  }
});
