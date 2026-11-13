import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase environment variables are not configured." }, 500);
  }
  if (!authorization) {
    return jsonResponse({ error: "Missing authorization header." }, 401);
  }

  try {
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return jsonResponse({ error: "You must be signed in to update users." }, 401);
    }

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (callerProfileError) {
      throw callerProfileError;
    }
    if (
      !callerProfile ||
      !["admin", "hr"].includes(String(callerProfile.role).trim().toLowerCase())
    ) {
      return jsonResponse({ error: "Only administrators or HR can update users." }, 403);
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "A valid user update payload is required." }, 400);
    }
    const payload = body as Record<string, unknown>;
    const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
    const username = typeof payload.username === "string" ? payload.username.trim().toLowerCase() : "";
    const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
    const lastName = typeof payload.lastName === "string" ? payload.lastName.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const role = typeof payload.role === "string" ? payload.role.trim().toLowerCase() : "";
    const department = typeof payload.department === "string" ? payload.department.trim() || null : null;
    const shift = typeof payload.shift === "string" ? payload.shift.trim() || null : null;
    const allowedRoles = new Set(["admin", "hr", "manager", "employee"]);

    if (!userId || !username || !firstName || !lastName || !email || !role) {
      return jsonResponse({ error: "User id, username, name, email, and role are required." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Enter a valid email address." }, 400);
    }
    if (!allowedRoles.has(role)) {
      return jsonResponse({ error: "Invalid user role." }, 400);
    }
    if (userId === caller.id) {
      return jsonResponse({ error: "You cannot edit your own account from this screen." }, 400);
    }

    const { data: creationRecord, error: creationError } = await adminClient
      .from("user_creation")
      .select("user_id, username, first_name, last_name, email, department, shift")
      .eq("user_id", userId)
      .maybeSingle();

    if (creationError) {
      throw creationError;
    }
    if (!creationRecord) {
      return jsonResponse({ error: "The selected user record could not be found." }, 404);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, name, email, role, department")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }
    if (!profile) {
      return jsonResponse({ error: "The selected user's profile could not be found." }, 404);
    }

    const name = `${firstName} ${lastName}`.trim();
    const { error: creationUpdateError } = await adminClient
      .from("user_creation")
      .update({ username, first_name: firstName, last_name: lastName, email, department, shift })
      .eq("user_id", userId);

    if (creationUpdateError) {
      throw creationUpdateError;
    }

    const { error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({ name, email, role, department })
      .eq("id", userId);

    if (profileUpdateError) {
      const { error: rollbackError } = await adminClient
        .from("user_creation")
        .update(creationRecord)
        .eq("user_id", userId);
      if (rollbackError) {
        console.error("Could not roll back user_creation after profile update failure:", rollbackError);
      }
      throw profileUpdateError;
    }

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
      user_metadata: { username, first_name: firstName, last_name: lastName, name, role, department, shift },
    });

    if (authUpdateError) {
      const [creationRollback, profileRollback] = await Promise.all([
        adminClient.from("user_creation").update(creationRecord).eq("user_id", userId),
        adminClient.from("profiles").update(profile).eq("id", userId),
      ]);
      if (creationRollback.error) {
        console.error("Could not roll back user_creation after auth update failure:", creationRollback.error);
      }
      if (profileRollback.error) {
        console.error("Could not roll back profile after auth update failure:", profileRollback.error);
      }
      throw authUpdateError;
    }

    return jsonResponse({ success: true, message: `${name}'s details were updated successfully.` });
  } catch (error) {
    console.error("admin-update-user-creation error:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unexpected error while updating the user.",
    }, 500);
  }
});
