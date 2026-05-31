/**
 * Shared liturgical calendar utilities.
 *
 * Primary source : imankatolik.or.id  — fetched server-side via Supabase edge function
 *                  (direct HTTP from browser is blocked by CORS / Cloudflare).
 * Fallback source: gcatholic.org      — fetched client-side via CORS proxy.
 */

export interface GcatholicEntry {
  date:       string;   // YYYY-MM-DD
  name:       string;
  color:      string;   // Hijau | Merah | Putih | Ungu | MerahMuda | Hitam
  rank:       number;   // 1=Solemnity, 2=Feast, 3=ObligatoryMemorial, 4=Optional, 5=Feria
  isMinggu:   boolean;
  isSabtu:    boolean;
  isHariRaya: boolean;
}

// ── Easter + season helpers (used by GCatholic fallback parser) ─────
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
  const d         = new Date(year, month - 1, day);
  const easter    = computeEaster(year);
  const ashWed    = addDays(easter, -46);
  const holySat   = addDays(easter, -1);
  const pentecost = addDays(easter, 49);
  const christmas = new Date(year, 11, 25);
  const christDow = christmas.getDay();
  const advent    = addDays(christmas, -(christDow === 0 ? 21 : christDow + 21));
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

// ── GCatholic fallback parser (CORS proxy) ───────────────────────────
const GC_COLOR_MAP: Record<string, string> = {
  v: 'Ungu', r: 'Merah', w: 'Putih', g: 'Hijau', p: 'MerahMuda', b: 'Hitam',
};

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

    const tds      = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    const dow      = (tds[1]?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
    const colorM   = row.match(/<span\s+class="feast([a-z])"\s*>/i);
    const rawColor = colorM ? (GC_COLOR_MAP[colorM[1]] ?? 'Hijau') : 'Hijau';

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

    const dateStr     = `${year}-${String(rowMonth).padStart(2,'0')}-${String(rowDay).padStart(2,'0')}`;
    const seasonColor = getSeasonColor(year, rowMonth, rowDay);
    const color       = resolveHarianColor(best.name, rawColor, seasonColor);
    const d           = new Date(dateStr + 'T00:00:00');
    const entry: GcatholicEntry = {
      date:       dateStr,
      name:       best.name,
      color,
      rank:       best.rank,
      isMinggu:   d.getDay() === 0,
      isSabtu:    d.getDay() === 6,
      isHariRaya: /hari raya/i.test(best.name),
    };
    const existing = dateMap.get(dateStr);
    if (!existing || entry.rank < existing.rank) dateMap.set(dateStr, entry);
  }
  return Array.from(dateMap.values());
}

// ── Cache + fetch ────────────────────────────────────────────────────
const _cache: Record<string, Map<string, GcatholicEntry>> = {};

export function clearGcatholicCache(year: number, month: number): void {
  delete _cache[`${year}-${month}`];
}

function edgeDataToMap(data: any[], year: number, month: number): Map<string, GcatholicEntry> {
  const padM = String(month).padStart(2, '0');
  const map  = new Map<string, GcatholicEntry>();
  (data as any[])
    .filter(e => typeof e.date === 'string' && e.date.startsWith(`${year}-${padM}`))
    .forEach(e => {
      const d   = new Date(`${e.date}T00:00:00`);
      const entry: GcatholicEntry = {
        date:       e.date,
        name:       e.name   ?? '',
        color:      e.color  ?? 'Hijau',
        rank:       e.rank   ?? 5,
        isMinggu:   d.getDay() === 0,
        isSabtu:    d.getDay() === 6,
        isHariRaya: e.type === 'HR' || /hari raya/i.test(e.name ?? ''),
      };
      const existing = map.get(e.date);
      if (!existing || entry.rank < existing.rank) map.set(e.date, entry);
    });
  return map;
}

/**
 * Fetch liturgical data for a month.
 * 1st try: Supabase edge function (server-side → imankatolik.or.id, always reachable).
 *   Pass the authenticated Supabase client from the calling component so
 *   functions.invoke runs with the correct session context.
 * Fallback: GCatholic via CORS proxy (client-side).
 */
export async function fetchGcatholicMonth(
  year: number, month: number,
  supabaseClient?: any,
): Promise<Map<string, GcatholicEntry>> {
  const key = `${year}-${month}`;
  if (_cache[key]) return _cache[key];

  // ── Primary: edge function → imankatolik.or.id ──────────────────
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.functions.invoke('fetch-gcatholic', {
        body: { year, month },
      });
      if (!error && Array.isArray(data) && data.length > 0) {
        const map = edgeDataToMap(data, year, month);
        if (map.size > 0) {
          _cache[key] = map;
          return map;
        }
      }
    } catch { /* fall through */ }
  }

  // ── Fallback: GCatholic via CORS proxy ───────────────────────────
  const targetUrl = `https://gcatholic.org/calendar/${year}/ID-id`;
  const proxies   = [
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
      if (html.includes('feast1') || html.includes('feast3')) break;
    } catch { /* try next */ }
  }

  const padM = String(month).padStart(2, '0');
  const all  = html ? parseLiturgiHTML(html, year) : [];
  const map  = new Map<string, GcatholicEntry>();
  all.filter(e => e.date.startsWith(`${year}-${padM}`)).forEach(e => map.set(e.date, e));

  _cache[key] = map;
  return map;
}
