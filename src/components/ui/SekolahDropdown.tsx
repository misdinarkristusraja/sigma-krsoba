import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, ChevronDown, CheckCircle } from 'lucide-react';

const BASE = 'https://api-sekolah-indonesia.vercel.app';
const NPSN_TARAKANITA = '20310748'; // SMP Tarakanita Kab. Sukoharjo

const JENJANG_MAP: Record<string, string> = {
  SD: 'sd', SMP: 'smp', SMA: 'sma', SMK: 'smk',
};

type Sekolah = {
  npsn: string;
  sekolah: string;
  bentuk: string;
  kabupaten_kota: string;
  isTarakanita: boolean;
};

type Props = {
  pendidikan: string;           // 'SD' | 'SMP' | 'SMA' | 'SMK' | 'Lulus' | ''
  value: string;                // nama sekolah yang dipilih
  onChange: (nama: string, isTarakanita: boolean) => void;
};

export default function SekolahDropdown({ pendidikan, value, onChange }: Props) {
  const [open,     setOpen]     = useState(false);
  const [query,    setQuery]    = useState('');
  const [list,     setList]     = useState<Sekolah[]>([]);
  const [loading,  setLoading]  = useState(false);
  const searchRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const jenjang = JENJANG_MAP[pendidikan] ?? null;

  // Load default list ketika jenjang berubah atau dropdown dibuka
  useEffect(() => {
    if (!open || !jenjang) return;
    if (query.trim().length >= 2) return; // sudah search, jangan overwrite
    loadDefault();
  }, [open, jenjang]);

  // Search saat query berubah
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    if (!jenjang) return;
    if (query.trim().length < 2) {
      // kembali ke default
      loadDefault();
      return;
    }
    searchRef.current = setTimeout(() => doSearch(query.trim()), 350);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [query, jenjang]);

  // Tutup dropdown kalau klik di luar
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function loadDefault() {
    if (!jenjang) return;
    setLoading(true);
    try {
      // Load ~20 sekolah di Sukoharjo + Solo Raya sebagai default
      const res  = await fetch(`${BASE}/sekolah/${jenjang}?kab_kota=033909&perPage=20`);
      const json = await res.json();
      let data: Sekolah[] = mapData(json.dataSekolah || []);

      // Jika Sukoharjo kosong, fallback ke semua Jawa Tengah
      if (data.length === 0) {
        const res2  = await fetch(`${BASE}/sekolah/${jenjang}?provinsi=030000&perPage=20`);
        const json2 = await res2.json();
        data = mapData(json2.dataSekolah || []);
      }
      setList(data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  async function doSearch(q: string) {
    if (!jenjang) return;
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}/sekolah/s?sekolah=${encodeURIComponent(q)}&perPage=15`);
      const json = await res.json();
      const all  = mapData(json.dataSekolah || []);
      // Filter by jenjang
      const filtered = all.filter(s => s.bentuk.toLowerCase() === jenjang);
      setList(filtered);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  function mapData(raw: any[]): Sekolah[] {
    return raw.map(s => ({
      npsn:           s.npsn,
      sekolah:        s.sekolah,
      bentuk:         s.bentuk,
      kabupaten_kota: s.kabupaten_kota?.trim() ?? '',
      isTarakanita:   s.npsn === NPSN_TARAKANITA,
    }));
  }

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

  // Tidak bisa pilih sekolah kalau jenjang belum dipilih atau Lulus
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

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className={`input w-full text-left flex items-center justify-between gap-2 ${!value ? 'text-gray-400' : 'text-gray-800'}`}
      >
        <span className="truncate flex-1">{value || `Pilih sekolah ${pendidikan}...`}</span>
        <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl">
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
            {loading && list.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-400">Memuat...</div>
            )}
            {!loading && list.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-400">
                {query.length >= 2 ? 'Sekolah tidak ditemukan' : 'Ketik nama sekolah untuk mencari'}
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

          {query.length >= 2 && (
            <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
              Data dari database nasional KEMDIKBUD
            </div>
          )}
        </div>
      )}

      {/* Tarakanita badge */}
      {value && list.find(s => s.sekolah === value)?.isTarakanita && (
        <p className="text-xs text-brand-800 font-semibold mt-1 flex items-center gap-1">
          <CheckCircle size={11} /> Status Tarakanita otomatis aktif
        </p>
      )}
    </div>
  );
}
