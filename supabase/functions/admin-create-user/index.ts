
// @ts-ignore Deno resolves URL imports at runtime; the editor may not.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: { get(name: string): string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const resolveInviteRedirectUrl = (request: Request) => {
  const configuredUrl = Deno.env.get("INVITE_REDIRECT_URL")?.trim();
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      url.searchParams.set("auth_action", "invite");
      return url.toString();
    } catch {
      return configuredUrl;
    }
  }

  const originHeader = request.headers.get("origin")?.trim();
  if (!originHeader) {
    return undefined;
  }

  try {
    const url = new URL("/login", originHeader);
    url.searchParams.set("auth_action", "invite");
    return url.toString();
  } catch {
    return undefined;
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

  let createdUserId: string | null = null;

  try {
    if (req.method !== "POST") {
      return respond({ success: false, message: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
   // const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate the caller's access token.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respond({ success: false, message: "Please sign in" }, 401);
    }

    const token = authHeader.slice(7);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerData, error: callerError } =
      await adminClient.auth.getUser(token);

    if (callerError || !callerData.user) {
      return respond({ success: false, message: "Invalid session" }, 401);
    }

    const { data: callerProfile, error: roleError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", callerData.user.id)
      .single();

    if (roleError || callerProfile?.role !== "admin") {
      return respond({ success: false, message: "Admin access required" }, 403);
    }

    const body = await req.json();

    const username = String(body.username ?? "").trim();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const department = body.department || null;
    const shift = body.shift || null;
    const role = body.role || "admin";

    if (!username || !firstName || !lastName || !email) {
      return respond({ success: false, message: "Fill all required fields" }, 400);
    }

    if (!["admin", "hr", "manager", "employee"].includes(role)) {
      return respond({ success: false, message: "Invalid role" }, 400);
    }

    const name = `${firstName} ${lastName}`.trim();

    const inviteOptions: {
      data: Record<string, string | null>;
      redirectTo?: string;
    } = {
      data: {
        username,
        name,
        full_name: name,
        first_name: firstName,
        last_name: lastName,
        role,
        department,
        shift,
      },
    };

    const inviteRedirectUrl = resolveInviteRedirectUrl(req);
    if (inviteRedirectUrl) {
      inviteOptions.redirectTo = inviteRedirectUrl;
    }

    const { data: authResult, error: authError } =
      await adminClient.auth.admin.inviteUserByEmail(email, inviteOptions);

    if (authError || !authResult.user) {
      return respond({
        success: false,
        message: authError?.message ?? "Could not send the invitation email",
      }, 400);
    }
    
console.log("Created Auth user:", authResult.user.id);
    createdUserId = authResult.user.id;

    // Always store the new user in profiles (profiles.id = auth.users.id).
    // Inserts the row if no auth trigger created it, otherwise overwrites
    // the email-derived name with the entered details.
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: createdUserId,
          name,
          email,
          role,
          department,
        },
        { onConflict: "id" },
      );

    if (profileError) {
      throw new Error(`Profile save failed: ${profileError.message}`);
    }

    // Save the additional account details in the new table.
    const { error: recordError } = await adminClient
      .from("user_creation")
      .insert({
        user_id: createdUserId,
        username,
        first_name: firstName,
        last_name: lastName,
        email,
        department,
        shift,
        created_by: callerData.user.id,
      });

    if (recordError) {
      throw new Error(`User creation record failed: ${recordError.message}`);
    }

    return respond({
      success: true,
      message: `User created successfully. An invitation email has been sent to ${email}.`,
      userId: createdUserId,
    }, 201);
  } catch (error) {
    console.error("admin-create-user failed:", error);

    // Clean up the newly created Auth user on failure.
    // Check your foreign keys and triggers for profile cleanup behavior.
    if (createdUserId) {
      const url = Deno.env.get("SUPABASE_URL")!;
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const cleanupClient = createClient(url, key, {
        auth: { persistSession: false },
      });

      const { error: recordCleanupError } = await cleanupClient
        .from("user_creation")
        .delete()
        .eq("user_id", createdUserId);

      if (recordCleanupError) {
        console.error("User creation record cleanup failed:", recordCleanupError.message);
      }

      console.log("Cleaning up Auth user:", createdUserId);
      const { error: cleanupError } =
        await cleanupClient.auth.admin.deleteUser(createdUserId);

      if (cleanupError) {
        console.error("Account cleanup failed:", cleanupError.message);
      }
    }

    return respond({
      success: false,
      message: error instanceof Error
        ? error.message
        : "Unexpected server error",
    }, 500);
  }
});
