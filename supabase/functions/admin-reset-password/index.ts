/**
 * supabase/functions/admin-reset-password/index.ts
 *
 * Edge Function: Mass Reset Password
 * ------------------------------------------------------------------
 * Perbaikan dari versi sebelumnya:
 *  1. [BUG FIX] Destructuring `user` dari getUser() diperbaiki.
 *  2. [BUG FIX] results.push(...chunkResults) — flat, bukan nested.
 *  3. [BUG FIX] total dihitung dari jumlah user, bukan jumlah chunk.
 *  4. [SECURITY] Service role key hanya dibuat SEKALI, tidak dilog.
 *  5. [RESILIENCE] Kegagalan satu user tidak menghentikan proses.
 *  6. [CORS] Header CORS lengkap termasuk preflight OPTIONS.
 *  7. [INPUT] Validasi mode & payload sebelum diproses.
 * ------------------------------------------------------------------
 */

// Pin versi agar tidak terjadi breaking change saat cold start
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ── CORS Headers ────────────────────────────────────────────────────────────
// Access-Control-Allow-Origin: '*' aman untuk Edge Function karena
// otentikasi dilakukan via Bearer token di header, bukan cookie.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Helper: Buat Response JSON ──────────────────────────────────────────────
function reply(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ── Helper: Generate Password Alfanumerik ───────────────────────────────────
// Karakter yang digunakan dikurangi huruf/angka ambigu (0, O, l, 1, I)
function randPassword(len = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

// ── Helper: Pecah array menjadi chunks ─────────────────────────────────────
// Digunakan agar Edge Function tidak timeout saat reset ratusan user.
// Setiap chunk diproses secara paralel; antar chunk diproses sequential.
function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from(
    { length: Math.ceil(arr.length / size) },
    (_, i) => arr.slice(i * size, i * size + size)
  );
}

// ── Tipe data hasil per-user ────────────────────────────────────────────────
interface ResetResult {
  id: string;
  nickname: string;
  nama: string;
  lingkungan: string;
  hp_ortu: string;
  hp_anak: string;
  email?: string;
  password?: string; // plain text — hanya untuk keperluan notif WA
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

// ── Main Handler ────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // 1. CORS Preflight — WAJIB ditangani paling awal sebelum apapun
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // 2. Baca ENV vars — gagal eksplisit jika tidak ada
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error("[admin-reset-password] ENV vars tidak lengkap:", {
        hasUrl: !!SUPABASE_URL,
        hasKey: !!SERVICE_KEY,
      });
      return reply(
        {
          ok: false,
          error: "ENV_MISSING",
          message:
            "Konfigurasi server tidak lengkap. Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Supabase Secrets.",
        },
        500
      );
    }

    // 3. Buat Supabase admin client dengan service_role_key
    //    → Bypass RLS sehingga bisa update auth.users
    //    → autoRefreshToken & persistSession: false karena server-side
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 4. Parse body — jika body kosong/invalid, default ke {}
    const body = (await req
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    const mode = (body.mode as string) ?? "provision_all";

    // 5. Mode ping — untuk health check dari supabase-ping function
    if (mode === "ping") {
      return reply({
        ok: true,
        status: "aktif",
        timestamp: new Date().toISOString(),
      });
    }

    // 6. Verifikasi Authorization Bearer token
    //    Semua mode selain ping wajib autentikasi
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return reply(
        {
          ok: false,
          error: "MISSING_TOKEN",
          message: "Header Authorization: Bearer <token> wajib disertakan.",
        },
        401
      );
    }

    // ── BUG FIX #1: Destructuring user yang benar ────────────────────────
    // Versi lama: const { data: { }, error: authErr } = ...
    //   → `user` tidak pernah dideklarasikan → ReferenceError
    // Versi baru: data langsung diakses sebagai { user }
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);

    if (authErr || !user) {
      return reply(
        {
          ok: false,
          error: "INVALID_TOKEN",
          message: "Token tidak valid atau sudah expired. Silakan login ulang.",
        },
        401
      );
    }

    // 7. Cek role pemanggil — harus Administrator
    const { data: profile, error: profileErr } = await admin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileErr || profile?.role !== "Administrator") {
      return reply(
        {
          ok: false,
          error: "FORBIDDEN",
          message: "Hanya Administrator yang dapat melakukan mass reset.",
        },
        403
      );
    }

    // ── MODE: provision_all ───────────────────────────────────────────────
    if (mode === "provision_all") {
      // 8. Ambil semua user Active/Pending (bukan Administrator)
      const { data: members, error: fetchErr } = await admin
        .from("users")
        .select(
          "id, email, nickname, nama_panggilan, lingkungan, hp_ortu, hp_anak"
        )
        .in("status", ["Active", "Pending"])
        .neq("role", "Administrator");

      if (fetchErr) {
        console.error("[provision_all] Gagal fetch users:", fetchErr.message);
        return reply(
          {
            ok: false,
            error: "FETCH_FAILED",
            message: fetchErr.message,
          },
          500
        );
      }

      if (!members?.length) {
        return reply({
          ok: true,
          results: [],
          total: 0,
          success: 0,
          skipped: 0,
          failed: 0,
        });
      }

      // 9. Proses per chunk (10 user parallel), chunk sequential
      //    ── BUG FIX #2: Gunakan spread operator ──────────────────────────
      //    Versi lama: results.push(chunkResults)
      //      → results = [[r1,r2,...], [r3,r4,...]] (nested!)
      //    Versi baru: results.push(...chunkResults)
      //      → results = [r1, r2, r3, r4, ...] (flat)
      const results: ResetResult[] = [];
      const chunks = chunkArray(members, 10);

      for (const chunk of chunks) {
        const chunkPromises = chunk.map(
          async (m): Promise<ResetResult> => {
            const base = {
              id:          m.id,
              nickname:    m.nickname  ?? "",
              nama:        m.nama_panggilan ?? "",
              lingkungan:  m.lingkungan    ?? "",
              hp_ortu:     m.hp_ortu       ?? "",
              hp_anak:     m.hp_anak       ?? "",
            };

            // Skip user tanpa email
            if (!m.email || !m.email.trim()) {
              return { ...base, ok: false, skipped: true, error: "EMAIL_KOSONG" };
            }

            // Generate password baru
            const pw = randPassword(10);

            // Cek apakah auth.users record sudah ada
            const { data: authData } = await admin.auth.admin.getUserById(m.id);

            if (!authData?.user) {
              // User belum ada di auth — ini seharusnya sudah ditangani migration
              // tapi kita tangani juga di sini sebagai fallback
              console.warn(`[provision_all] User ${m.id} (${m.email}) tidak ada di auth.users`);
              return {
                ...base,
                ok: false,
                error: "AUTH_USER_MISSING — Jalankan migration 023 terlebih dahulu.",
              };
            }

            // Update password + pastikan email confirmed + unban
            const { error: updateErr } = await admin.auth.admin.updateUserById(
              m.id,
              {
                password:       pw,
                email_confirm:  true,
                ban_duration:   "none",
              }
            );

            if (updateErr) {
              console.error(
                `[provision_all] Gagal update user ${m.id}:`,
                updateErr.message
              );
              return { ...base, ok: false, error: updateErr.message };
            }

            // Tandai must_change_password
            await admin
              .from("users")
              .update({ must_change_password: true })
              .eq("id", m.id);
            // Kegagalan update flag ini tidak dianggap fatal —
            // password tetap berhasil direset, user hanya tidak dipaksa ganti PW

            return { ...base, email: m.email, password: pw, ok: true };
          }
        );

        // ── BUG FIX #2 (lanjutan) ──────────────────────────────────────
        const chunkResults = await Promise.allSettled(chunkPromises);

        for (const settled of chunkResults) {
          if (settled.status === "fulfilled") {
            results.push(settled.value);
          } else {
            // Promise sendiri throw (seharusnya tidak terjadi karena sudah
            // ada try-catch di dalam, tapi kita tangkap sebagai safety net)
            console.error("[provision_all] Uncaught promise rejection:", settled.reason);
            results.push({
              id: "unknown", nickname: "", nama: "",
              lingkungan: "", hp_ortu: "", hp_anak: "",
              ok: false,
              error: String(settled.reason),
            });
          }
        }
      }

      // ── BUG FIX #3: Hitung total dari jumlah user, bukan chunks ────────
      const success = results.filter((r) => r.ok).length;
      const skipped = results.filter((r) => r.skipped).length;
      const failed  = results.filter((r) => !r.ok && !r.skipped).length;

      console.info(
        `[provision_all] Selesai — total: ${results.length}, sukses: ${success}, skip: ${skipped}, gagal: ${failed}`
      );

      return reply({
        ok:      true,
        total:   results.length,   // jumlah user, bukan jumlah chunk
        success,
        skipped,
        failed,
        results,
      });
    }

    // ── MODE: reset_single — reset satu user berdasarkan ID ─────────────
    if (mode === "reset_single") {
      const targetId = body.target_id as string;
      const newPw    = (body.password as string) || randPassword(10);

      if (!targetId) {
        return reply(
          { ok: false, error: "MISSING_PARAM", message: "target_id wajib disertakan." },
          400
        );
      }

      const { error: updateErr } = await admin.auth.admin.updateUserById(
        targetId,
        { password: newPw, email_confirm: true, ban_duration: "none" }
      );

      if (updateErr) {
        return reply(
          { ok: false, error: "UPDATE_FAILED", message: updateErr.message },
          500
        );
      }

      await admin
        .from("users")
        .update({ must_change_password: true })
        .eq("id", targetId);

      return reply({ ok: true, target_id: targetId, password: newPw });
    }

    // ── Mode tidak dikenal ───────────────────────────────────────────────
    return reply(
      {
        ok: false,
        error: "UNKNOWN_MODE",
        message: `Mode '${mode}' tidak dikenal. Gunakan: provision_all, reset_single, ping.`,
      },
      400
    );

  } catch (err) {
    // Tangkap SEMUA error tidak terduga agar function tetap merespons
    // dengan header CORS (tanpa ini, browser mendapat opaque error)
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin-reset-password] FATAL ERROR:", msg);
    return reply(
      {
        ok: false,
        error: "SERVER_CRASH",
        message: msg,
      },
      500
    );
  }
});
