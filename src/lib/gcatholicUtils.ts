/**
 * Shared GCatholic liturgical calendar utilities.
 * Used by: useAutoAssign (weekly schedule) + ScheduleDailyPage (daily mass).
 * Fetches via client-side CORS proxies — no edge function required.
 */

const COLOR_MAP: Record<string, string> = {
  v: 'Ungu', r: 'Merah', w: 'Putih', g: 'Hijau', p: 'MerahMuda', b: 'Hitam',
};

export interface GcatholicEntry {
  date:       string;   // YYYY-MM-DD
  name:       string;
  color:      string;   // Indonesian color name
  rank:       number;   // 1=Solemnity, 2=Feast, 3=ObligatoryMemorial, 4=Optional, 5=Feria
  isMinggu:   boolean;
  isSabtu:    boolean;
  isHariRaya: boolean;
}

// ── Easter: Anonymous Gregorian algorithm ───────────────────────────
export function computeEaster(year: number): Date {
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

export function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(d.getDate() + n); return r;
}

export function getSeasonColor(year: number, month: number, day: number): string {
  const d          = new Date(year, month - 1, day);
  const easter     = computeEaster(year);
  const ashWed     = addDays(easter, -46);
  const holySat    = addDays(easter, -1);
  const pentecost  = addDays(easter, 49);
  const christmas  = new Date(year, 11, 25);
  const christDow  = christmas.getDay();
  const advent     = addDays(christmas, -(christDow === 0 ? 21 : christDow + 21));
  const epiphany   = new Date(year, 0, 6);
  const epDow      = epiphany.getDay();
  const baptism    = epDow === 0 ? addDays(epiphany, 7) : addDays(epiphany, 7 - epDow);
  if (d >= ashWed  && d <= holySat)   return 'Ungu';
  if (d >= easter  && d <= pentecost) return 'Putih';
  if (d >= advent  && d < christmas)  return 'Ungu';
  if (d >= christmas)                  return 'Putih';
  if (d <= baptism)                    return 'Putih';
  return 'Hijau';
}

export function resolveHarianColor(name: string, rawColor: string, seasonColor: string): string {
  if (!name || name.length < 3) return seasonColor;
  const n = name.toLowerCase();
  const isJohnApostle = /yohanes\s*(rasul|penginjil|apostle|evangelist)|john\s*(the\s*)?(apostle|evangelist)/i.test(name);
  if (!isJohnApostle && /\b(martir|para\s+martir|martyr|martyrs|rasul|apostle|apostles|penginjil|evangelist)\b/.test(n)) return 'Merah';
  if (/\b(uskup|bishop|paus|pope|imam|priest|pastor|perawan|virgin|doktor|doctor|abas|abbot|pengaku\s+iman|confessor|rahib|monk|biarawan|biarawati|nun|diakon|deacon)\b/.test(n)) return 'Putih';
  if (/\b(pesta|feast|solemnity|hari\s+raya|peringatan\s+wajib|memorial)\b/.test(n)) return 'Putih';
  if (rawColor && rawColor !== 'Hijau') return rawColor;
  return seasonColor;
}

/**
 * Parse raw GCatholic HTML into GcatholicEntry[].
 * Uses <tr id="MMDD"> for reliable date identification.
 * Picks the highest-rank entry per date (rank 1=best, 5=feria).
 */
export function parseLiturgiHTML(html: string, year: number): GcatholicEntry[] {
  const dateMap = new Map<string, GcatholicEntry>();
  const trRegex = /<tr[^>]*\sid="(\d{4})"[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = trRegex.exec(html)) !== null) {
    const id       = m[1];
    const rowMonth = parseInt(id.slice(0, 2), 10);
    const rowDay   = parseInt(id.slice(2, 4), 10);
    if (!rowMonth || !rowDay) continue;
    const row = m[2];

    // Day-of-week text from second <td>
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    const dow  = (tds[1]?.[1] ?? '').replace(/<[^>]+>/g, '').trim();

    // Color from feast[single-letter] span, e.g. <span class="feastr">
    const colorM   = row.match(/<span\s+class="feast([a-z])"\s*>/i);
    const rawColor = colorM ? (COLOR_MAP[colorM[1]] ?? 'Hijau') : 'Hijau';

    // All feast entries ranked by feast[digit] class
    const feastRe = /<span[^>]+class="feast(\d)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    const entries: Array<{ rank: number; name: string }> = [];
    let fm: RegExpExecArray | null;
    while ((fm = feastRe.exec(row)) !== null) {
      const text = fm[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length >= 3) entries.push({ rank: parseInt(fm[1], 10), name: text });
    }
    if (!entries.length) continue;

    entries.sort((a, b) => a.rank - b.rank);
    const best = entries[0];

    const dateStr    = `${year}-${String(rowMonth).padStart(2, '0')}-${String(rowDay).padStart(2, '0')}`;
    const seasonColor = getSeasonColor(year, rowMonth, rowDay);
    const color       = resolveHarianColor(best.name, rawColor, seasonColor);
    const entry: GcatholicEntry = {
      date:       dateStr,
      name:       best.name,
      color,
      rank:       best.rank,
      isMinggu:   /minggu/i.test(dow),
      isSabtu:    /sabtu/i.test(dow),
      isHariRaya: /hari raya/i.test(best.name),
    };

    // Multiple <tr id="MMDD"> rows for same date → keep best rank
    const existing = dateMap.get(dateStr);
    if (!existing || entry.rank < existing.rank) {
      dateMap.set(dateStr, entry);
    }
  }
  return Array.from(dateMap.values());
}

// ── Fetch + parse GCatholic for a given month ────────────────────────
const _cache: Record<string, Map<string, GcatholicEntry>> = {};

export async function fetchGcatholicMonth(
  year: number, month: number
): Promise<Map<string, GcatholicEntry>> {
  const key = `${year}-${month}`;
  if (_cache[key]) return _cache[key];

  const targetUrl = `https://gcatholic.org/calendar/${year}/ID-id`;
  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
  ];

  let html = '';
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const json = await res.json().catch(() => null);
      html = (json?.contents ?? json?.body ?? '') as string;
      if (html.includes('feast1') || html.includes('feast2') || html.includes('feast3')) break;
    } catch { /* try next proxy */ }
  }

  const padM  = String(month).padStart(2, '0');
  const all   = html ? parseLiturgiHTML(html, year) : [];
  const map   = new Map<string, GcatholicEntry>();
  all
    .filter(e => e.date.startsWith(`${year}-${padM}`))
    .forEach(e => map.set(e.date, e));

  _cache[key] = map;
  return map;
}

export function clearGcatholicCache(year: number, month: number): void {
  delete _cache[`${year}-${month}`];
}
