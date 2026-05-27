// supabase/functions/sekolah-proxy/index.ts
// Proxy KEMDIKBUD school API to avoid client-side CORS/network issues.
// GET ?jenjang=smp&kab_kota=031100   → returns filtered school list

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE = 'https://api-sekolah-indonesia.vercel.app';
const NPSN_TARAKANITA = '20310748';
const VALID_JENJANG   = new Set(['sd', 'smp', 'sma', 'smk']);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const url     = new URL(req.url);
    const jenjang = (url.searchParams.get('jenjang') ?? '').toLowerCase();
    const kabKota = url.searchParams.get('kab_kota') ?? '031100';

    if (!VALID_JENJANG.has(jenjang)) {
      return new Response(JSON.stringify({ error: 'jenjang tidak valid' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const apiUrl = `${BASE}/sekolah/${jenjang}?kab_kota=${kabKota}&perPage=200`;
    console.log(`[sekolah-proxy] Fetching: ${apiUrl}`);

    const res  = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (SIGMA App; contact: it@krsoba.id)' },
    });

    if (!res.ok) throw new Error(`Upstream error: ${res.status}`);
    const json = await res.json();

    const data = (json.dataSekolah || []).map((s: any) => ({
      npsn:           s.npsn,
      sekolah:        s.sekolah,
      bentuk:         s.bentuk,
      kabupaten_kota: s.kabupaten_kota?.trim() ?? '',
      propinsi:       s.propinsi?.trim() ?? '',
      isTarakanita:   s.npsn === NPSN_TARAKANITA,
    }));

    console.log(`[sekolah-proxy] Returned ${data.length} sekolah untuk ${jenjang}/${kabKota}`);

    return new Response(JSON.stringify({ data }), {
      headers: {
        ...CORS,
        'Content-Type':  'application/json',
        'Cache-Control': 'public, max-age=86400', // cache 24 jam
      },
    });
  } catch (err) {
    console.error('[sekolah-proxy] Error:', err);
    return new Response(JSON.stringify({ error: String(err), data: [] }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
