// @ts-nocheck -- Deno runtime (jsr: imports, global Deno) that this repo's
// Next.js tsconfig isn't set up to understand; same convention as
// supabase/functions/gemini-audit. Types are still checked by `deno check`
// / at deploy time in Supabase's own Deno runtime.
//
// Edge Function: team-invite
//
// Backs Settings -> Team Access Management. Runs with the service-role key
// (only available server-side, in this function's own runtime env -- never
// shipped to the browser), so it's the one place that's allowed to:
//   - actually create/invite a Supabase Auth user by email, and
//   - write company_members for someone who isn't the caller.
//
// The client (see src/components/settings/team-management.tsx) only ever
// calls this via supabase.functions.invoke, authenticated as the signed-in
// admin. Every request is re-checked for admin rights against `company_id`
// here, server-side -- the caller's own claim of being an admin is never
// trusted.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const VALID_ROLES = ["admin", "supervisor", "accountant"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Scoped to the caller's own JWT -- only used to find out who's asking.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return json({ error: "Not authenticated." }, 401);

    const body = await req.json().catch(() => ({}));
    const { action, company_id } = body ?? {};
    if (!company_id || typeof company_id !== "string") {
      return json({ error: "company_id is required." }, 400);
    }

    // Service-role client: bypasses RLS. Only reachable past the admin
    // check below, which runs for every action this function supports.
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: company } = await admin
      .from("companies")
      .select("owner_id")
      .eq("id", company_id)
      .maybeSingle();

    let isAdmin = company?.owner_id === user.id;
    if (!isAdmin) {
      const { data: membership } = await admin
        .from("company_members")
        .select("role")
        .eq("company_id", company_id)
        .eq("user_id", user.id)
        .maybeSingle();
      isAdmin = membership?.role === "admin";
    }
    if (!isAdmin) return json({ error: "Administrator access required." }, 403);

    if (action === "list") {
      const { data: members, error } = await admin
        .from("company_members")
        .select("id, user_id, role, created_at")
        .eq("company_id", company_id)
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 500);

      const withEmails = await Promise.all(
        (members ?? []).map(async (m) => {
          const { data } = await admin.auth.admin.getUserById(m.user_id);
          return { ...m, email: data?.user?.email ?? null };
        })
      );
      return json({ members: withEmails });
    }

    if (action === "invite") {
      const { email, role, redirectTo } = body ?? {};
      if (!email || typeof email !== "string") {
        return json({ error: "email is required." }, 400);
      }
      if (!VALID_ROLES.includes(role)) {
        return json({ error: "role must be admin, supervisor, or accountant." }, 400);
      }

      let targetUserId: string | null = null;
      let alreadyHadAccount = false;

      const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
        email,
        redirectTo ? { redirectTo } : undefined
      );

      if (inviteErr) {
        const alreadyRegistered = /already been registered|already exists|already registered/i.test(
          inviteErr.message ?? ""
        );
        if (!alreadyRegistered) {
          return json({ error: inviteErr.message }, 400);
        }
        // They already have an account -- no new invite email goes out (Supabase
        // won't send one to an existing user), but they're still real: look their
        // id up and grant access to this company directly. They'll see it next
        // time they sign in.
        alreadyHadAccount = true;
        const lookupRes = await fetch(
          `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
          { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
        );
        const lookup = await lookupRes.json().catch(() => null);
        targetUserId = lookup?.users?.[0]?.id ?? null;
        if (!targetUserId) {
          return json({ error: "That email already has an account, but it could not be looked up." }, 500);
        }
      } else {
        targetUserId = inviteData.user.id;
      }

      const { error: upsertErr } = await admin
        .from("company_members")
        .upsert(
          { id: crypto.randomUUID(), company_id, user_id: targetUserId, role },
          { onConflict: "company_id,user_id" }
        );
      if (upsertErr) return json({ error: upsertErr.message }, 500);

      return json({ success: true, alreadyHadAccount });
    }

    if (action === "remove") {
      const { member_id } = body ?? {};
      if (!member_id || typeof member_id !== "string") {
        return json({ error: "member_id is required." }, 400);
      }
      const { error } = await admin
        .from("company_members")
        .delete()
        .eq("id", member_id)
        .eq("company_id", company_id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: `Unknown action "${action}".` }, 400);
  } catch (e: any) {
    console.error("team-invite error", e);
    return json({ error: e?.message ?? "Unexpected error." }, 500);
  }
});
