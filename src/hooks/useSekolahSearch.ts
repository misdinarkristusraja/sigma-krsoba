import { useState, useCallback, useRef } from 'react';

const BASE = 'https://api-sekolah-indonesia.vercel.app';

const NPSN_TARAKANITA_SOLOBARU = '20310748';

export type SekolahResult = {
  npsn: string;
  sekolah: string;
  bentuk: string;
  kabupaten_kota: string;
  propinsi: string;
  isTarakanitaSoloBaru: boolean;
};

function mapRow(s: any): SekolahResult {
  return {
    npsn:                 s.npsn,
    sekolah:              s.sekolah,
    bentuk:               s.bentuk,
    kabupaten_kota:       s.kabupaten_kota?.trim() ?? '',
    propinsi:             s.propinsi?.trim() ?? '',
    isTarakanitaSoloBaru: s.npsn === NPSN_TARAKANITA_SOLOBARU,
  };
}

// Cache per (jenjang, kab_kota) to avoid redundant fetches
const cache: Record<string, SekolahResult[]> = {};

async function loadKabKota(jenjang: string, kabKota: string): Promise<SekolahResult[]> {
  const key = `${jenjang}:${kabKota}`;
  if (cache[key]) return cache[key];
  const res  = await fetch(`${BASE}/sekolah/${jenjang}?kab_kota=${kabKota}&perPage=200`);
  const json = await res.json();
  const data = (json.dataSekolah || [])
    .filter((s: any) => ['SD','SMP','SMA','SMK'].includes(s.bentuk))
    .map(mapRow);
  cache[key] = data;
  return data;
}

export function useSekolahSearch(kabKota = '031100') {
  const [results,  setResults]  = useState<SekolahResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // fullList per-jenjang cache within this hook instance
  const listCache = useRef<Record<string, SekolahResult[]>>({});

  const search = useCallback((query: string, jenjang?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query || query.trim().length < 2) { setResults([]); return; }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.trim().toLowerCase();
        if (jenjang) {
          // Load kab/kota list once, then filter client-side
          const j = jenjang.toLowerCase();
          if (!listCache.current[j]) {
            listCache.current[j] = await loadKabKota(j, kabKota);
          }
          setResults(listCache.current[j].filter(s =>
            s.sekolah.toLowerCase().includes(q)
          ));
        } else {
          // No jenjang hint: global search filtered to SD/SMP/SMA/SMK
          const res  = await fetch(`${BASE}/sekolah/s?sekolah=${encodeURIComponent(query.trim())}&perPage=50`);
          const json = await res.json();
          setResults(
            (json.dataSekolah || [])
              .filter((s: any) => ['SD','SMP','SMA','SMK'].includes(s.bentuk))
              .map(mapRow)
          );
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, [kabKota]);

  const clear = useCallback(() => setResults([]), []);

  return { results, loading, search, clear };
}

export function isTarakanitaSoloBaru(npsn: string) {
  return npsn === NPSN_TARAKANITA_SOLOBARU;
}
