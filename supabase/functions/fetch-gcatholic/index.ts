// supabase/functions/fetch-gcatholic/index.ts
// Fetches liturgical calendar from imankatolik.or.id (server-side, no CORS issue)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalise color string from imankatolik (may have trailing whitespace, special values)
function normaliseColor(raw: string): string {
  const s = raw.trim().replace(/\r?\n/g, '').trim();
  if (/merah muda/i.test(s)) return 'MerahMuda';
  if (/merah/i.test(s))      return 'Merah';
  if (/ungu/i.test(s))       return 'Ungu';
  // "Ungu pagi Putih Vigili" → Putih (vigil mass color)
  if (/putih vigili/i.test(s)) return 'Putih';
  if (/putih/i.test(s))      return 'Putih';
  if (/hitam/i.test(s))      return 'Hitam';
  return 'Hijau';
}

// Detect rank from feast name as given by imankatolik
function detectRank(name: string): number {
  if (/hari raya/i.test(name))         return 1;
  if (/^pesta\b/i.test(name))          return 2;
  if (/perayaan wajib/i.test(name))    return 3;
  if (/peringatan\b/i.test(name))      return 4;
  if (/hari biasa|hari minggu/i.test(name)) return 5;
  // Named saint without explicit rank marker = optional memorial
  if (name.length > 3)                 return 4;
  return 5;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { year, month } = await req.json();
    const url = `https://www.imankatolik.or.id/kalender.php?b=${month}&t=${year}`;

    console.log(`[fetch-liturgi] Fetching: ${url}`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SIGMA App; contact: it@krsoba.id)',
        'Accept':     'text/html,application/xhtml+xml',
      }
    });
    if (!res.ok) throw new Error(`imankatolik returned ${res.status}`);

    const html = await res.text();

    // Each day has three matching elements in document order:
    //   class="k_tgl"     → day number
    //   class="k_perayaan"→ feast name (may contain <br/> and rank prefixes)
    //   class="k_pakaian" → "Warna Liturgi <color>"
    const tglRe      = /class="k_tgl"[^>]*>(\d{1,2})<\/div>/gi;
    const perayaanRe = /class="k_perayaan">([\s\S]*?)<\/div>/gi;
    const pakaianRe  = /class="k_pakaian"[^>]*>Warna Liturgi ([^<]+)<\/td>/gi;

    const days:    number[] = [];
    const feasts:  string[] = [];
    const colours: string[] = [];

    let m: RegExpExecArray | null;
    while ((m = tglRe.exec(html))      !== null) days.push(parseInt(m[1], 10));
    while ((m = perayaanRe.exec(html)) !== null) feasts.push(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    while ((m = pakaianRe.exec(html))  !== null) colours.push(normaliseColor(m[1]));

    const count  = Math.min(days.length, feasts.length, colours.length);
    const padM   = String(month).padStart(2, '0');
    const result: Array<{ date: string; name: string; color: string; rank: number; type: string }> = [];

    for (let i = 0; i < count; i++) {
      const day   = days[i];
      const name  = feasts[i];
      const color = colours[i];
      const rank  = detectRank(name);
      result.push({
        date:  `${year}-${padM}-${String(day).padStart(2, '0')}`,
        name,
        color,
        rank,
        type:  rank === 1 ? 'HR' : 'HS',
      });
    }

    console.log(`[fetch-liturgi] Parsed ${result.length} entries for ${year}-${padM}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[fetch-liturgi] Error:', err);
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
