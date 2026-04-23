import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const isMissingResourceError = (error: { code?: string | null; message?: string | null } | null | undefined) => {
  if (!error) {
    return false;
  }

  const haystack = [error.code, error.message].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes("does not exist") || haystack.includes("could not find") || error.code === "42P01" || error.code === "42703" || error.code === "PGRST204";
};

const isNotFoundError = (error: { code?: string | null; message?: string | null } | null | undefined) => {
  if (!error) {
    return false;
  }

  const haystack = [error.code, error.message].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes("not found") || haystack.includes("user not found");
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
      return jsonResponse({ error: "You must be signed in to delete users." }, 401);
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
      return jsonResponse({ error: "Only administrators can delete users." }, 403);
    }

    const payload = (await request.json()) as {
      accessGrantId?: string;
      email?: string;
      authUserId?: string | null;
    };

    const accessGrantId = payload.accessGrantId?.trim();
    const email = payload.email?.trim().toLowerCase() || null;
    const authUserId = payload.authUserId?.trim() || null;

    if (!accessGrantId && !email && !authUserId) {
      return jsonResponse({ error: "A user reference is required." }, 400);
    }

    let accessGrant:
      | {
          id: string;
          email: string;
          auth_user_id: string | null;
          name: string;
        }
      | null = null;

    if (accessGrantId) {
      const { data, error } = await adminClient
        .from("access_grants")
        .select("id, email, auth_user_id, name")
        .eq("id", accessGrantId)
        .maybeSingle();

      if (error && !isMissingResourceError(error)) {
        throw error;
      }

      accessGrant = data;
    }

    if (!accessGrant && email) {
      const { data, error } = await adminClient
        .from("access_grants")
        .select("id, email, auth_user_id, name")
        .eq("email", email)
        .maybeSingle();

      if (error && !isMissingResourceError(error)) {
        throw error;
      }

      accessGrant = data;
    }

    const targetAuthUserId = accessGrant?.auth_user_id ?? authUserId;
    const targetEmail = accessGrant?.email ?? email;
    const targetName = accessGrant?.name ?? targetEmail ?? "The user";

    if (targetAuthUserId && targetAuthUserId === callerUser.id) {
      return jsonResponse({ error: "You cannot delete your own admin account from the portal." }, 400);
    }

    if (targetAuthUserId) {
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetAuthUserId);
      if (deleteAuthError && !isNotFoundError(deleteAuthError)) {
        throw deleteAuthError;
      }

      const { error: deleteProfileError } = await adminClient.from("profiles").delete().eq("id", targetAuthUserId);
      if (deleteProfileError && !isMissingResourceError(deleteProfileError)) {
        throw deleteProfileError;
      }
    }

    if (accessGrant?.id) {
      const { error: deleteGrantError } = await adminClient.from("access_grants").delete().eq("id", accessGrant.id);
      if (deleteGrantError && !isMissingResourceError(deleteGrantError)) {
        throw deleteGrantError;
      }
    } else if (targetEmail) {
      const { error: deleteGrantError } = await adminClient.from("access_grants").delete().eq("email", targetEmail);
      if (deleteGrantError && !isMissingResourceError(deleteGrantError)) {
        throw deleteGrantError;
      }
    }

    return jsonResponse({
      success: true,
      message: `${targetName} has been removed from the portal.`,
    });
  } catch (error) {
    console.error("admin-delete-user error:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unexpected error while deleting the user.",
      },
      500,
    );
  }
});
