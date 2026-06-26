import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, ChevronDown, CheckCircle, MapPin } from 'lucide-react';

// Gunakan edge function proxy agar tidak tergantung CORS browser
const PROXY_URL  = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sekolah-proxy`;
const PROXY_HEADERS = {
  'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY as string}`,
};
// NPSNs confirmed Tarakanita; fallback: school name contains 'tarakanita'
const TARAKANITA_NPSNS = new Set(['20310748']);
function isTarakanitaSchool(npsn: string, nama: string): boolean {
  return TARAKANITA_NPSNS.has(npsn) || nama.toLowerCase().includes('tarakanita');
}

// Schools not in API — prepended per jenjang (key = lowercase jenjang code)
const MANUAL_SCHOOLS: Record<string, Array<{ npsn: string; sekolah: string; bentuk: string; kabupaten_kota: string }>> = {
  sd: [
    { npsn: 'MANUAL_SD_TARA', sekolah: 'SDK Tarakanita Solo Baru', bentuk: 'SD', kabupaten_kota: 'KAB. SUKOHARJO' },
  ],
};

const JENJANG_MAP: Record<string, string> = {
  SD: 'sd', SMP: 'smp', SMA: 'sma', SMK: 'smk',
};

const KAB_KOTA_JATENG = [
  { nama: 'Sukoharjo',        kode: '031100' },
  { nama: 'Surakarta (Solo)', kode: '036100' },
  { nama: 'Karanganyar',      kode: '031300' },
  { nama: 'Wonogiri',         kode: '031200' },
  { nama: 'Sragen',           kode: '031400' },
  { nama: 'Klaten',           kode: '031000' },
  { nama: 'Boyolali',         kode: '030900' },
  { nama: 'Magelang (Kab)',   kode: '030800' },
  { nama: 'Magelang (Kota)',  kode: '036000' },
  { nama: 'Semarang (Kab)',   kode: '032200' },
  { nama: 'Semarang (Kota)',  kode: '036300' },
  { nama: 'Salatiga',         kode: '036200' },
  { nama: 'Demak',            kode: '032100' },
  { nama: 'Purworejo',        kode: '030600' },
  { nama: 'Kebumen',          kode: '030500' },
  { nama: 'Banjarnegara',     kode: '030400' },
  { nama: 'Purbalingga',      kode: '030300' },
  { nama: 'Banyumas',         kode: '030200' },
  { nama: 'Cilacap',          kode: '030100' },
  { nama: 'Wonosobo',         kode: '030700' },
  { nama: 'Temanggung',       kode: '032300' },
  { nama: 'Kendal',           kode: '032400' },
  { nama: 'Batang',           kode: '032500' },
  { nama: 'Pekalongan (Kab)', kode: '032600' },
  { nama: 'Pekalongan (Kota)',kode: '036400' },
  { nama: 'Pemalang',         kode: '032700' },
  { nama: 'Tegal (Kab)',      kode: '032800' },
  { nama: 'Tegal (Kota)',     kode: '036500' },
  { nama: 'Brebes',           kode: '032900' },
  { nama: 'Kudus',            kode: '031900' },
  { nama: 'Jepara',           kode: '032000' },
  { nama: 'Pati',             kode: '031800' },
  { nama: 'Rembang',          kode: '031700' },
  { nama: 'Blora',            kode: '031600' },
  { nama: 'Grobogan',         kode: '031500' },
];

type Sekolah = {
  npsn: string;
  sekolah: string;
  bentuk: string;
  kabupaten_kota: string;
  isTarakanita: boolean;
};

type Props = {
  pendidikan: string;
  value: string;
  onChange: (nama: string, isTarakanita: boolean) => void;
};

export default function SekolahDropdown({ pendidikan, value, onChange }: Props) {
  const [open,      setOpen]     = useState(false);
  const [query,     setQuery]    = useState('');
  const [fullList,  setFullList] = useState<Sekolah[]>([]);
  const [list,      setList]     = useState<Sekolah[]>([]);
  const [loading,   setLoading]  = useState(false);
  const [kabKota,   setKabKota]  = useState('031100'); // default Sukoharjo
  const [error,     setError]    = useState(false);
  const [isManual,  setIsManual] = useState(false);
  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const jenjang = JENJANG_MAP[pendidikan] ?? null;

  function mapData(raw: any[]): Sekolah[] {
    return raw.map(s => ({
      npsn:           s.npsn,
      sekolah:        s.sekolah,
      bentuk:         s.bentuk,
      kabupaten_kota: s.kabupaten_kota?.trim() ?? '',
      isTarakanita:   isTarakanitaSchool(s.npsn, s.sekolah),
    }));
  }

  function getManualEntries(j: string): Sekolah[] {
    return (MANUAL_SCHOOLS[j.toLowerCase()] || []).map(s => ({
      ...s,
      isTarakanita: isTarakanitaSchool(s.npsn, s.sekolah),
    }));
  }

  // Load all schools for selected kab/kota + jenjang (client-side filtering after)
  const loadForKabKota = useCallback(async (j: string, kk: string, signal?: AbortSignal) => {
    setLoading(true);
    setError(false);
    try {
      const res  = await fetch(
        `${PROXY_URL}?jenjang=${j}&kab_kota=${kk}`,
        { headers: PROXY_HEADERS, signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (signal?.aborted) return;
      const manual = getManualEntries(j);
      const data: Sekolah[] = [...manual, ...mapData(json.data || [])];
      setFullList(data);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('[SekolahDropdown] load error:', err);
      setError(true);
      setFullList([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  // Reload when dropdown opens or kab/kota or jenjang changes; cancel stale requests
  useEffect(() => {
    if (!open || !jenjang) return;
    const ctrl = new AbortController();
    setQuery('');
    loadForKabKota(jenjang, kabKota, ctrl.signal);
    return () => ctrl.abort();
  }, [open, jenjang, kabKota, loadForKabKota]);

  // Client-side filter — instant, no debounce needed
  useEffect(() => {
    const q = query.trim().toLowerCase();
    setList(q ? fullList.filter(s => s.sekolah.toLowerCase().includes(q)) : fullList);
  }, [query, fullList]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleOpen() {
    if (!jenjang) return;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function select(s: Sekolah) {
    onChange(s.sekolah, s.isTarakanita);
    setOpen(false);
    setQuery('');
  }

  if (!jenjang) {
    return (
      <input
        className="input bg-gray-50 text-gray-400 cursor-not-allowed"
        value={value}
        readOnly
        placeholder={pendidikan === 'Lulus' ? 'Tidak berlaku (sudah lulus)' : 'Pilih pendidikan dulu'}
      />
    );
  }

  const selectedIsTarakanita = list.find(s => s.sekolah === value)?.isTarakanita
    ?? fullList.find(s => s.sekolah === value)?.isTarakanita;

  if (isManual) {
    const isManualTarakanita = isTarakanitaSchool('', value);
    return (
      <div className="space-y-1">
        <div className="relative flex gap-2">
          <input
            className="input flex-1 pr-24"
            value={value}
            onChange={e => onChange(e.target.value, isTarakanitaSchool('', e.target.value))}
            placeholder={`Ketik nama sekolah ${pendidikan}...`}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              setIsManual(false);
              onChange('', false);
            }}
            className="btn-secondary whitespace-nowrap text-xs py-2 px-3 hover:bg-gray-100 transition-colors"
          >
            Cari di Daftar
          </button>
        </div>
        {value && isManualTarakanita && (
          <p className="text-xs text-brand-800 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle size={11} /> Status Tarakanita otomatis aktif
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className={`input w-full text-left flex items-center justify-between gap-2 ${!value ? 'text-gray-400' : 'text-gray-800'}`}
      >
        <span className="truncate flex-1">{value || `Pilih sekolah ${pendidikan}...`}</span>
        <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl">
          {/* Kab/Kota filter */}
          <div className="p-2 border-b border-gray-100 flex items-center gap-1.5">
            <MapPin size={12} className="text-gray-400 shrink-0" />
            <select
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-400 bg-white"
              value={kabKota}
              onChange={e => setKabKota(e.target.value)}
            >
              {KAB_KOTA_JATENG.map(k => (
                <option key={k.kode} value={k.kode}>{k.nama}</option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand-400"
                placeholder={`Cari nama sekolah ${pendidikan}...`}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {loading && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
            </div>
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {/* Opsi Ketik Manual Permanen */}
            <button
              type="button"
              onClick={() => {
                setIsManual(true);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-brand-800 bg-brand-50 hover:bg-brand-100 flex items-center gap-1.5 border-b border-gray-100 transition-colors"
            >
              <span>✍️ Sekolah tidak terdaftar? Klik untuk ketik manual</span>
            </button>

            {loading && fullList.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-400">Memuat daftar sekolah...</div>
            )}
            {error && !loading && (
              <div className="py-6 text-center text-sm text-red-400">
                Gagal memuat data. Periksa koneksi internet.
              </div>
            )}
            {!loading && !error && list.length === 0 && fullList.length > 0 && (
              <div className="py-6 text-center text-sm text-gray-400">
                <p className="mb-2">Sekolah tidak ditemukan di {KAB_KOTA_JATENG.find(k => k.kode === kabKota)?.nama ?? 'daerah ini'}</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsManual(true);
                    setOpen(false);
                  }}
                  className="btn-outline btn-xs mx-auto text-xs"
                >
                  ✍️ Isi Manual
                </button>
              </div>
            )}
            {!loading && !error && fullList.length === 0 && !loading && (
              <div className="py-6 text-center text-sm text-gray-400">
                <p className="mb-2">Tidak ada sekolah {pendidikan} ditemukan di daerah ini</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsManual(true);
                    setOpen(false);
                  }}
                  className="btn-outline btn-xs mx-auto text-xs"
                >
                  ✍️ Isi Manual
                </button>
              </div>
            )}
            {list.map(s => (
              <button
                key={s.npsn}
                type="button"
                onClick={() => select(s)}
                className={`w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors ${
                  value === s.sekolah ? 'bg-brand-50' : ''
                }`}
              >
                <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  s.bentuk === 'SD'  ? 'bg-green-100 text-green-700'   :
                  s.bentuk === 'SMP' ? 'bg-blue-100 text-blue-700'     :
                  s.bentuk === 'SMA' ? 'bg-purple-100 text-purple-700' :
                                       'bg-orange-100 text-orange-700'
                }`}>{s.bentuk}</span>
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-sm text-gray-800 block truncate">{s.sekolah}</span>
                  <span className="text-xs text-gray-400">{s.kabupaten_kota}</span>
                  {s.isTarakanita && (
                    <span className="ml-2 text-[10px] bg-brand-100 text-brand-800 font-semibold px-1.5 py-0.5 rounded">Tarakanita ✓</span>
                  )}
                </span>
                {value === s.sekolah && <CheckCircle size={14} className="text-brand-600 mt-0.5 shrink-0" />}
              </button>
            ))}
          </div>

          <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100 flex items-center justify-between">
            <span>Data dari database nasional KEMDIKBUD</span>
            {!loading && fullList.length > 0 && (
              <span>{list.length} sekolah</span>
            )}
          </div>
        </div>
      )}

      {value && selectedIsTarakanita && (
        <p className="text-xs text-brand-800 font-semibold mt-1 flex items-center gap-1">
          <CheckCircle size={11} /> Status Tarakanita otomatis aktif
        </p>
      )}
    </div>
  );
}
