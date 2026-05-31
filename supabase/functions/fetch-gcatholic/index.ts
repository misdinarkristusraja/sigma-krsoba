// supabase/functions/fetch-gcatholic/index.ts
// Fetches liturgical calendar from imankatolik.or.id

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normaliseColor(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (/merah\s*muda/i.test(s)) return 'MerahMuda';
  if (/putih\s*vigili/i.test(s)) return 'Putih';
  if (/merah/i.test(s))  return 'Merah';
  if (/ungu/i.test(s))   return 'Ungu';
  if (/putih/i.test(s))  return 'Putih';
  if (/hitam/i.test(s))  return 'Hitam';
  return 'Hijau';
}

function detectRank(name: string): number {
  if (/hari raya/i.test(name))      return 1;
  if (/^pesta\b/i.test(name))       return 2;
  if (/perayaan wajib/i.test(name)) return 3;
  if (/peringatan\b/i.test(name))   return 4;
  if (/hari biasa|hari minggu/i.test(name)) return 5;
  if (name.length > 3)              return 4;
  return 5;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const year  = Number(body.year);
    const month = Number(body.month);
    const url   = `https://www.imankatolik.or.id/kalender.php?b=${month}&t=${year}`;

    console.log(`[fetch-liturgi] ${url}`);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SIGMA/1.0)',
        'Accept':     'text/html',
      },
    });

    if (!res.ok) {
      console.error(`[fetch-liturgi] HTTP ${res.status}`);
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await res.text();
    const padM = String(month).padStart(2, '0');

    const tglRe      = /class="k_tgl"[^>]*>(\d{1,2})<\/div>/gi;
    const perayaanRe = /class="k_perayaan">([\s\S]*?)<\/div>/gi;
    const pakaianRe  = /class="k_pakaian"[^>]*>Warna Liturgi ([^<]+)<\/td>/gi;

    const days: number[]    = [];
    const feasts: string[]  = [];
    const colours: string[] = [];

    let mx: RegExpExecArray | null;
    while ((mx = tglRe.exec(html)) !== null)      days.push(parseInt(mx[1], 10));
    let my: RegExpExecArray | null;
    while ((my = perayaanRe.exec(html)) !== null) feasts.push(my[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    let mz: RegExpExecArray | null;
    while ((mz = pakaianRe.exec(html)) !== null)  colours.push(normaliseColor(mz[1]));

    const count = Math.min(days.length, feasts.length, colours.length);
    const result = [];

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

    console.log(`[fetch-liturgi] ${result.length} entries for ${year}-${padM}`);

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
