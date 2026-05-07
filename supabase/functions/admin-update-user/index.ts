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
      return jsonResponse({ error: "You must be signed in to update users." }, 401);
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
      return jsonResponse({ error: "Only administrators can edit users." }, 403);
    }

    const payload = (await request.json()) as {
      userId?: string;
      currentEmail?: string;
      name?: string;
      email?: string;
      role?: string;
      department?: string | null;
      reportingManagerId?: string | null;
    };

    const userId = payload.userId?.trim();
    const currentEmail = payload.currentEmail?.trim().toLowerCase();
    const name = payload.name?.trim();
    const email = payload.email?.trim().toLowerCase();
    const role = payload.role?.trim().toLowerCase();
    const department = payload.department?.trim() || "Operations";
    const reportingManagerId = payload.reportingManagerId?.trim() || null;

    if (!userId || !currentEmail || !name || !email || !role) {
      return jsonResponse({ error: "User id, current email, name, email, and role are required." }, 400);
    }

    if (!allowedRoles.has(role)) {
      return jsonResponse({ error: "Only employee, manager, and hr users can be edited from this page." }, 400);
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (targetProfileError) {
      throw targetProfileError;
    }

    if (!targetProfile) {
      return jsonResponse({ error: "The selected user could not be found." }, 404);
    }

    if (targetProfile.role === "admin") {
      return jsonResponse({ error: "Admin accounts cannot be edited from this page." }, 400);
    }

    const { data: conflictingProfile, error: conflictingProfileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .neq("id", userId)
      .maybeSingle();

    if (conflictingProfileError && !isMissingResourceError(conflictingProfileError)) {
      throw conflictingProfileError;
    }

    if (conflictingProfile) {
      return jsonResponse({ error: "That email is already used by another portal user." }, 400);
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
        normalizedManagerId = reportingManager.profile_id ?? null;
        reportingManagerName = reportingManager.name;
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

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        department,
        manager_id: normalizedManagerId,
        reporting_manager_id: normalizedReportingManagerId,
        reporting_manager_name: reportingManagerName,
      },
    });

    if (authUpdateError) {
      throw authUpdateError;
    }

    const profilePayload = {
      name,
      email,
      role,
      department,
      manager_id: normalizedManagerId,
      reporting_manager_id: normalizedReportingManagerId,
    };

    const { error: profileUpdateError } = await adminClient
      .from("profiles")
      .update(profilePayload)
      .eq("id", userId);

    if (profileUpdateError && !isMissingResourceError(profileUpdateError)) {
      throw profileUpdateError;
    }

    const accessGrantPayload = {
      email,
      name,
      role,
      department,
      manager_id: normalizedManagerId,
      reporting_manager_id: normalizedReportingManagerId,
      auth_user_id: userId,
    };

    const { data: accessGrantByUser, error: accessGrantByUserError } = await adminClient
      .from("access_grants")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (accessGrantByUserError && !isMissingResourceError(accessGrantByUserError)) {
      throw accessGrantByUserError;
    }

    if (accessGrantByUser?.id) {
      const { error: accessGrantUpdateError } = await adminClient
        .from("access_grants")
        .update(accessGrantPayload)
        .eq("id", accessGrantByUser.id);

      if (accessGrantUpdateError && !isMissingResourceError(accessGrantUpdateError)) {
        throw accessGrantUpdateError;
      }
    } else {
      const { data: accessGrantByEmail, error: accessGrantByEmailError } = await adminClient
        .from("access_grants")
        .select("id")
        .eq("email", currentEmail)
        .maybeSingle();

      if (accessGrantByEmailError && !isMissingResourceError(accessGrantByEmailError)) {
        throw accessGrantByEmailError;
      }

      if (accessGrantByEmail?.id) {
        const { error: accessGrantUpdateError } = await adminClient
          .from("access_grants")
          .update(accessGrantPayload)
          .eq("id", accessGrantByEmail.id);

        if (accessGrantUpdateError && !isMissingResourceError(accessGrantUpdateError)) {
          throw accessGrantUpdateError;
        }
      }
    }

    return jsonResponse({
      success: true,
      message: `${name}'s details have been updated successfully.`,
    });
  } catch (error) {
    console.error("admin-update-user error:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unexpected error while updating the user.",
      },
      500,
    );
  }
});
