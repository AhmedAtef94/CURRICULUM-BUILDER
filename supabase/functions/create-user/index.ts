// =====================================================================
// Edge Function: create-user
// Lets a SUPER ADMIN create a new user (email + password), set their role,
// and assign subjects — WITHOUT exposing the secret service_role key to the
// browser. The secret key stays here on the server only.
//
// Deploy: Supabase Dashboard → Edge Functions → Deploy a new function
//         name it exactly "create-user" and paste this file.
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided
//  automatically by Supabase — you do NOT paste any secret anywhere.)
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) Identify the caller from their JWT and confirm they are super_admin.
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: who, error: whoErr } = await caller.auth.getUser();
    if (whoErr || !who?.user) return json({ error: "غير مصرّح — سجّل الدخول أولًا" });

    const { data: prof } = await caller.from("profiles").select("role").eq("id", who.user.id).single();
    if (prof?.role !== "super_admin") return json({ error: "الصلاحية للسوبر أدمن فقط" });

    const body = await req.json();

    // ---- DELETE branch: remove a user entirely (cascades profile + assignments) ----
    if (body.action === "delete") {
      const targetId = String(body.user_id || "");
      if (!targetId) return json({ error: "user_id مطلوب" });
      if (targetId === who.user.id) return json({ error: "مينفعش تحذف حسابك بنفسك" });
      const adminX = createClient(url, service);
      const { error: dErr } = await adminX.auth.admin.deleteUser(targetId);
      if (dErr) return json({ error: dErr.message });
      return json({ ok: true, deleted: targetId });
    }

    // ---- RESET PASSWORD branch: super admin sets a new password for a user ----
    if (body.action === "reset") {
      const targetId = String(body.user_id || "");
      const newPw = String(body.password || "");
      if (!targetId) return json({ error: "user_id مطلوب" });
      if (newPw.length < 8 || !/[A-Za-z؀-ۿ]/.test(newPw) || !/[0-9]/.test(newPw)) {
        return json({ error: "كلمة المرور 8 أحرف على الأقل وتحتوي على حروف وأرقام" });
      }
      const adminX = createClient(url, service);
      const { error: rErr } = await adminX.auth.admin.updateUserById(targetId, { password: newPw });
      if (rErr) return json({ error: rErr.message });
      return json({ ok: true, reset: targetId });
    }

    // ---- CREATE branch: read + validate input (server-side rules mirror the client). ----
    const { email, password, full_name, role, subject_ids } = body;
    const emailStr = String(email || "").trim();
    const pw = String(password || "");
    const nameStr = String(full_name || "").trim();
    if (nameStr.length < 3) return json({ error: "الاسم مطلوب (3 أحرف على الأقل)" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) return json({ error: "صيغة البريد الإلكتروني غير صحيحة" });
    if (pw.length < 8 || !/[A-Za-z؀-ۿ]/.test(pw) || !/[0-9]/.test(pw)) {
      return json({ error: "كلمة المرور 8 أحرف على الأقل وتحتوي على حروف وأرقام" });
    }
    const validRoles = ["super_admin", "admin", "editor", "viewer"];
    const finalRole = validRoles.includes(role) ? role : "viewer";

    // 3) Create the user with the service key (admin power stays server-side).
    const admin = createClient(url, service);
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: emailStr,
      password: pw,
      email_confirm: true,                 // active immediately, no email step
      user_metadata: { full_name: nameStr },
    });
    if (cErr) return json({ error: cErr.message });

    const uid = created.user.id;

    // 4) Set role + name on the auto-created profile, then assign subjects.
    await admin.from("profiles").update({ role: finalRole, full_name: nameStr }).eq("id", uid);

    // Only editors are scoped by assignment — it decides what they can see
    // as well as what they can edit.
    if (finalRole === "editor" && Array.isArray(subject_ids) && subject_ids.length) {
      await admin.from("user_subjects").insert(
        subject_ids.map((sid: string) => ({ user_id: uid, subject_id: sid })),
      );
    }

    return json({ ok: true, id: uid });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) });
  }
});
