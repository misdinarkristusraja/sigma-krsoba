import { useState, useCallback, useRef } from 'react';

const BASE = 'https://api-sekolah-indonesia.vercel.app';

// NPSN SMP Tarakanita Solo Baru (Kab. Sukoharjo)
const NPSN_TARAKANITA_SOLOBARU = '20310748';

export type SekolahResult = {
  npsn: string;
  sekolah: string;
  bentuk: string;
  kabupaten_kota: string;
  propinsi: string;
  isTarakanitaSoloBaru: boolean;
};

export function useSekolahSearch() {
  const [results,  setResults]  = useState<SekolahResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query || query.trim().length < 2) { setResults([]); return; }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(`${BASE}/sekolah/s?sekolah=${encodeURIComponent(query.trim())}&perPage=10`);
        const json = await res.json();
        const data: SekolahResult[] = (json.dataSekolah || [])
          .filter((s: any) => ['SD','SMP','SMA','SMK'].includes(s.bentuk))
          .map((s: any) => ({
            npsn:                 s.npsn,
            sekolah:              s.sekolah,
            bentuk:               s.bentuk,
            kabupaten_kota:       s.kabupaten_kota?.trim(),
            propinsi:             s.propinsi?.trim(),
            isTarakanitaSoloBaru: s.npsn === NPSN_TARAKANITA_SOLOBARU,
          }));
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  const clear = useCallback(() => setResults([]), []);

  return { results, loading, search, clear };
}

export function isTarakanitaSoloBaru(npsn: string) {
  return npsn === NPSN_TARAKANITA_SOLOBARU;
}
