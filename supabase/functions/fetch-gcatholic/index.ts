// supabase/functions/fetch-gcatholic/index.ts
// Proxy fetch data liturgi dari gcatholic.org untuk menghindari CORS

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapping gcatholic color codes to our system
const COLOR_MAP: Record<string, string> = {
  'G': 'Hijau',   'g': 'Hijau',   'green': 'Hijau',
  'R': 'Merah',   'r': 'Merah',   'red': 'Merah',
  'W': 'Putih',   'w': 'Putih',   'white': 'Putih',
  'V': 'Ungu',    'v': 'Ungu',    'violet': 'Ungu', 'purple': 'Ungu',
  'P': 'MerahMuda', 'p': 'MerahMuda', 'rose': 'MerahMuda', 'pink': 'MerahMuda',
  'B': 'Hitam',   'b': 'Hitam',   'black': 'Hitam',
};

// ── Easter (Anonymous Gregorian) ────────────────────────────────────
function computeEaster(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(d.getDate() + n); return r; }

function getSeasonColor(year: number, month: number, day: number): string {
  const d = new Date(year, month - 1, day);
  const easter    = computeEaster(year);
  const ashWed    = addDays(easter, -46);
  const holySat   = addDays(easter, -1);
  const pentecost = addDays(easter, 49);
  const christmas = new Date(year, 11, 25);
  const christmasDow = christmas.getDay();
  const advent    = addDays(christmas, -(christmasDow === 0 ? 21 : christmasDow + 21));
  const epiphany  = new Date(year, 0, 6);
  const epDow     = epiphany.getDay();
  const baptism   = epDow === 0 ? addDays(epiphany, 7) : addDays(epiphany, 7 - epDow);
  if (d >= ashWed  && d <= holySat)   return 'Ungu';
  if (d >= easter  && d <= pentecost) return 'Putih';
  if (d >= advent  && d < christmas)  return 'Ungu';
  if (d >= christmas)                  return 'Putih';
  if (d <= baptism)                    return 'Putih';
  return 'Hijau';
}

/**
 * Resolve liturgical color for a misa harian entry.
 * Priority: Martyr/Apostle → Merah; Saint title → Putih; GCatholic color; Season fallback.
 */
function resolveHarianColor(name: string, rawColor: string, seasonColor: string): string {
  if (!name || name.length < 3) return seasonColor;
  const n = name.toLowerCase();
  const isJohnApostle = /yohanes\s*(rasul|penginjil|apostle|evangelist)|john\s*(the\s*)?(apostle|evangelist)/i.test(name);
  if (!isJohnApostle && /\b(martir|para\s+martir|martyr|martyrs|rasul|apostle|apostles|penginjil|evangelist)\b/.test(n)) return 'Merah';
  if (/\b(uskup|bishop|paus|pope|imam|priest|pastor|perawan|virgin|doktor|doctor|abas|abbot|pengaku\s+iman|confessor|rahib|monk|biarawan|biarawati|nun|diakon|deacon)\b/.test(n)) return 'Putih';
  if (/\b(pesta|feast|solemnity|hari\s+raya|peringatan\s+wajib|memorial)\b/.test(n)) return 'Putih';
  if (rawColor && rawColor !== 'Hijau') return rawColor;
  return seasonColor;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { year, month } = await req.json();
    const url = `https://gcatholic.org/calendar/${year}/ID-id`;

    console.log(`[fetch-gcatholic] Fetching: ${url}`);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (SIGMA App; contact: it@krsoba.id)' }
    });

    if (!res.ok) throw new Error(`gcatholic returned ${res.status}`);
    const html = await res.text();

    // Parse HTML table
    const doc  = new DOMParser().parseFromString(html, 'text/html');
    const rows = doc?.querySelectorAll('table tr') || [];

    const result: Array<{date: string, name: string, color: string, type: string}> = [];
    const targetMonth = String(month).padStart(2, '0');

    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return;
      const dateText = cells[0]?.textContent?.trim() || '';

      // Try to parse date (format varies: "1 Mar" or "01/03")
      const dateMatch = dateText.match(/(\d{1,2})[\/\s-]?(\w+)?/);
      if (!dateMatch) return;

      const day      = dateMatch[1].padStart(2, '0');
      const fullDate = `${year}-${targetMonth}-${day}`;

      // Extract color from span class (e.g. <span class="feastw">, <span class="feastr">)
      const rowHtml   = row.innerHTML || '';
      const spanMatch = rowHtml.match(/class="feast([a-z])"/i);
      let rawColor    = spanMatch ? (COLOR_MAP[spanMatch[1].toLowerCase()] || 'Hijau') : 'Hijau';

      // Fallback: try <tr> class
      if (rawColor === 'Hijau') {
        const className = (row.getAttribute('class') || '').toLowerCase();
        for (const [k, v] of Object.entries(COLOR_MAP)) {
          if (className.includes(k.toLowerCase())) { rawColor = v; break; }
        }
      }

      // Extract feast entries with rank from span class="feast[digit]..."
      // Rank 1=Solemnity(H), 2=Feast(Pfak), 3=ObligatoryMemorial(Pw), 4=Optional(P), 5=Feria
      // When multiple entries exist, pick highest liturgical importance (lowest rank number)
      interface FeastEntry { rank: number; name: string; }
      const feastEntries: FeastEntry[] = [];
      const nameCell = cells[1];
      nameCell?.querySelectorAll('span').forEach((span: any) => {
        const cls       = span.getAttribute('class') || '';
        const rankMatch = cls.match(/^feast(\d)/);
        if (rankMatch) {
          const text = (span.textContent || '').replace(/\s+/g, ' ').trim();
          if (text.length >= 3) feastEntries.push({ rank: parseInt(rankMatch[1], 10), name: text });
        }
      });
      feastEntries.sort((a, b) => a.rank - b.rank);
      const best = feastEntries[0];

      // Fall back to full cell text if no feast span found
      const cleanName = best
        ? best.name
        : (nameCell?.textContent || '').replace(/\s+/g, ' ').trim();
      const rank      = best?.rank ?? 5;

      if (!cleanName || cleanName.length < 3 || !day) return;

      const dayNum      = parseInt(day, 10);
      const seasonColor = getSeasonColor(year, parseInt(targetMonth, 10), dayNum);
      const finalColor  = resolveHarianColor(cleanName, rawColor, seasonColor);
      const isHariRaya  = /hari raya|solemnity/i.test(cleanName);

      result.push({
        date:  fullDate,
        name:  cleanName,
        color: finalColor,
        rank,
        type:  isHariRaya ? 'HR' : 'HS',
      });
    });

    // Filter to requested month only
    const monthData = result.filter(r => r.date.startsWith(`${year}-${targetMonth}`));

    console.log(`[fetch-gcatholic] Found ${monthData.length} entries for ${year}-${targetMonth}`);

    return new Response(JSON.stringify(monthData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[fetch-gcatholic] Error:', err);
    // Return empty array as fallback — scheduler will use manual input
    return new Response(JSON.stringify([]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
