import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { toNickname, formatHP, PENDIDIKAN_OPTIONS } from '../lib/utils';
import { LINGKUNGAN_LIST, getWilayah } from '../lib/wilayah';
import SekolahDropdown from '../components/ui/SekolahDropdown';
import SignaturePad from '../components/ui/SignaturePad';
import { Church, Upload, CheckCircle, AlertCircle, FileText, X } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';

// ── PDF generator ────────────────────────────────────────────────
async function generateSuratPDF(
  namaAnak: string,
  namaOrtu: string,
  lingkungan: string,
  hpOrtu: string,
  hpAnak: string,
  signatureDataUrl: string,
  childSignatureDataUrl: string,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W   = 210;
  const M   = 20;
  const CW  = W - 2 * M;

  // ── Kop surat ──────────────────────────────────────────────────
  // Logo placeholder box with cross
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.5);
  doc.rect(M, 10, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(100, 0, 0);
  doc.text('+', M + 10, 23, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Org name + address
  const hdrX = M + 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MISDINAR PAROKI KRISTUS RAJA SOLO BARU', hdrX, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Perumahan Solo Baru Jalan Cendana Raya EF 1, Dusun III, Langenharjo,', hdrX, 20);
  doc.text('Kec. Grogol, Kabupaten Sukoharjo, Jawa Tengah 57552', hdrX, 24.5);
  doc.text('misdinar.kristusraja@gmail.com  |  @misdinarkr', hdrX, 29);

  // Double line separator
  doc.setLineWidth(0.8);
  doc.line(M, 33, W - M, 33);
  doc.setLineWidth(0.2);
  doc.line(M, 34.5, W - M, 34.5);

  // ── Judul ──────────────────────────────────────────────────────
  let y = 44;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SURAT PERNYATAAN PERSETUJUAN ORANG TUA MISDINAR BARU', W / 2, y, { align: 'center' });
  y += 7;
  doc.text('PAROKI KRISTUS RAJA SOLO BARU', W / 2, y, { align: 'center' });

  // ── Body ───────────────────────────────────────────────────────
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Yang bertanda tangan di bawah ini :', M, y);
  y += 8;

  const labelW = 28;
  const colonX = M + labelW;
  const valX   = colonX + 4;

  const parentFields: [string, string][] = [
    ['Nama',       namaOrtu   || '—'],
    ['Lingkungan', lingkungan || '—'],
    ['No. Telp.',  hpOrtu     || '—'],
  ];
  for (const [lbl, val] of parentFields) {
    doc.text(lbl,  M, y);
    doc.text(':',  colonX, y);
    doc.text(val,  valX, y);
    y += 7;
  }

  y += 3;
  const para1 = 'Merupakan orang tua/wali dari Calon Misdinar Baru yang mendaftar dan akan mengikuti rangkaian kegiatan Misdinar Periode Pelayanan 2025 / 2026 :';
  const para1Lines = doc.splitTextToSize(para1, CW - 8);
  doc.text(para1Lines, M + 5, y);
  y += para1Lines.length * 6 + 5;

  const childFields: [string, string][] = [
    ['Nama',       namaAnak   || '—'],
    ['Lingkungan', lingkungan || '—'],
    ['No. Telp*',  hpAnak     || '—'],
  ];
  for (const [lbl, val] of childFields) {
    doc.text(lbl, M, y);
    doc.text(':', colonX, y);
    doc.text(val, valX, y);
    y += 7;
  }

  y += 5;
  doc.text('Menyatakan bahwa :', M, y);
  y += 7;

  const items = [
    'Bersedia mendorong dan memotivasi anak tersebut untuk ikut ambil bagian dalam pelayanan misdinar dalam periode pelayanan 2025/2026.',
    'Bersedia dan memastikan anak tersebut untuk mematuhi seluruh syarat dan aturan dalam SOM (STANDAR OPERASIONAL PROSEDUR MISDINAR) Paroki Kristus Raja Solo Baru (link: s.id/SOMKR).',
    'Apabila di kemudian hari kami dan/atau anak kami terbukti melanggar isi Surat Pernyataan yang telah kami tandatangani, maka kami bersedia menerima segala bentuk sanksi yang diberikan kepada anak kami sesuai ketentuan yang berlaku.',
  ];
  for (let i = 0; i < items.length; i++) {
    const lines = doc.splitTextToSize(`${i + 1}.  ${items[i]}`, CW - 8);
    doc.text(lines, M + 4, y);
    y += lines.length * 6 + 2;
  }

  y += 4;
  const closing = 'Demikian Surat Pernyataan ini kami buat dengan sebenar-benarnya, untuk dapat dipergunakan sebagaimana mestinya, dan kepada yang berkepentingan untuk menjadikan maklum.';
  const closingLines = doc.splitTextToSize(closing, CW);
  doc.text(closingLines, M, y);
  y += closingLines.length * 6 + 10;

  // ── Blok tanda tangan ──────────────────────────────────────────
  const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Solo Baru, ${tanggal}`, W - M, y, { align: 'right' });
  y += 6;
  doc.text('Yang Membuat,', W - M, y, { align: 'right' });
  y += 5;

  const leftCX  = M + 27;          // center Calon Misdinar col
  const rightCX = W - M - 27;      // center Orang Tua col

  doc.setFontSize(10);
  doc.text('Calon Misdinar Baru',            leftCX,  y, { align: 'center' });
  doc.text('Orang Tua Calon Misdinar Baru',  rightCX, y, { align: 'center' });
  y += 5;

  // Child digital signature in left column
  try {
    doc.addImage(childSignatureDataUrl, 'PNG', leftCX - 25, y, 50, 28);
  } catch { /* keep PDF even if image fails */ }

  // Parent digital signature in right column
  try {
    doc.addImage(signatureDataUrl, 'PNG', rightCX - 25, y, 50, 28);
  } catch { /* keep PDF even if image fails */ }

  y += 32;

  // Signature lines
  doc.setLineWidth(0.3);
  doc.line(leftCX  - 27, y, leftCX  + 27, y);
  doc.line(rightCX - 27, y, rightCX + 27, y);
  y += 5;
  doc.setFontSize(9);
  doc.text('(........................................)', leftCX,  y, { align: 'center' });
  doc.text('(........................................)', rightCX, y, { align: 'center' });

  y += 8;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('*Dikosongi apabila tidak punya', M, y);

  return doc.output('blob');
}

// ── Component ────────────────────────────────────────────────────
export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<'checking' | 'ok' | 'taken' | null>(null);
  const [regOpenDate,  setRegOpenDate]  = useState<Date | null>(null);
  const [regCloseDate, setRegCloseDate] = useState<Date | null>(null);

  useEffect(() => {
    supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['reg_open_date', 'reg_close_date'])
      .then(({ data }: any) => {
        const map: Record<string, string> = {};
        (data || []).forEach((r: any) => { map[r.key] = r.value; });
        if (map.reg_open_date)  setRegOpenDate(new Date(map.reg_open_date));
        if (map.reg_close_date) setRegCloseDate(new Date(map.reg_close_date + 'T23:59:59'));
      });
  }, []);

  const now = new Date();
  const regIsOpen = regOpenDate && regCloseDate
    ? now >= regOpenDate && now <= regCloseDate
    : true;
  const nicknameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<Record<string, any>>({
    nama_lengkap: '', nickname: '', tanggal_lahir: '', alamat: '',
    lingkungan: '', pendidikan: '', sekolah: '',
    hp_anak: '', hp_ortu: '',
    nama_ayah: '', nama_ibu: '',
    alasan_masuk: '', sampai_kapan: '',
    nomor_data_umat: '',
    sertifikat_komuni: null as File | null,
    signature_data_url: null as string | null,
    signature_child_data_url: null as string | null,
    declared: false,
  });
  const [errors, setErrors] = useState<Record<string, any>>({});

  function handleNamaChange(val: any) {
    setForm(f => ({ ...f, nama_lengkap: val }));
    if (!form.nickname) {
      const suggested = toNickname(val.split(' ')[0]);
      if (suggested) {
        setForm(f => ({ ...f, nickname: suggested }));
        checkNickname(suggested);
      }
    }
  }

  function checkNickname(value: any) {
    if (nicknameTimer.current) clearTimeout(nicknameTimer.current);
    if (!value || value.length < 3) { setNicknameStatus(null); return; }
    setNicknameStatus('checking');
    nicknameTimer.current = setTimeout(async () => {
      const { data } = await supabase.from('users').select('id').eq('nickname', value).maybeSingle();
      setNicknameStatus(data ? 'taken' : 'ok');
    }, 400);
  }

  function validate() {
    const e: Record<string, any> = {};
    if (!form.nama_lengkap) e.nama_lengkap = 'Wajib diisi';
    if (!form.nickname || form.nickname.length < 3) e.nickname = 'Min. 3 karakter';
    if (nicknameStatus === 'taken') e.nickname = 'Sudah dipakai, pilih yang lain';
    if (!form.tanggal_lahir) e.tanggal_lahir = 'Wajib diisi';
    if (!form.lingkungan) e.lingkungan = 'Pilih lingkungan';
    if (!form.pendidikan) e.pendidikan = 'Pilih pendidikan';
    if (!form.hp_ortu) e.hp_ortu = 'No. HP Orang Tua wajib';
    if (!form.nama_ayah && !form.nama_ibu) e.nama_ayah = 'Minimal salah satu orang tua';
    if (!form.nomor_data_umat?.trim()) e.nomor_data_umat = 'Nomor Data Umat wajib diisi. Tanyakan ke PIC Data Umat lingkunganmu.';
    if (!form.signature_child_data_url) e.signature_child = 'Tanda tangan calon misdinar wajib diisi';
    if (!form.signature_data_url) e.signature = 'Tanda tangan orang tua wajib diisi';
    if (!form.declared) e.declared = 'Wajib dicentang sebagai pernyataan';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); toast.error('Ada data yang belum lengkap'); return; }

    setLoading(true);
    try {
      // 1. Generate signed surat pernyataan PDF
      const namaOrtu = [form.nama_ayah, form.nama_ibu].filter(Boolean).join(' / ');
      const pdfBlob  = await generateSuratPDF(
        form.nama_lengkap,
        namaOrtu,
        form.lingkungan,
        form.hp_ortu              || '',
        form.hp_anak              || '',
        form.signature_data_url,
        form.signature_child_data_url || '',
      );
      const pdfPath = `surat/${Date.now()}_${(form.nickname || 'pendaftar').toLowerCase()}_surat_pernyataan.pdf`;
      const { error: pdfErr } = await supabase.storage.from('documents').upload(pdfPath, pdfBlob, {
        contentType: 'application/pdf',
      });
      if (pdfErr) throw pdfErr;

      // 2. Upload sertifikat komuni (optional)
      let sertifikatUrl: string | null = null;
      if (form.sertifikat_komuni) {
        const file = form.sertifikat_komuni as File;
        const ext  = file.name.split('.').pop()?.toLowerCase() || 'pdf';
        const sertPath = `sertifikat/${Date.now()}_${(form.nickname || 'pendaftar').toLowerCase()}_sertifikat.${ext}`;
        const { error: sertErr } = await supabase.storage.from('documents').upload(sertPath, file);
        if (sertErr) throw sertErr;
        sertifikatUrl = sertPath;
      }

      // 3. Insert registration
      const wilayah = getWilayah(form.lingkungan) || null;
      const isTarakanita = form.is_tarakanita === true;

      const { error } = await supabase.from('registrations').insert({
        nama_lengkap:          form.nama_lengkap,
        nickname:              form.nickname.toLowerCase(),
        tanggal_lahir:         form.tanggal_lahir,
        alamat:                form.alamat,
        lingkungan:            form.lingkungan,
        wilayah,
        pendidikan:            form.pendidikan,
        sekolah:               form.sekolah,
        is_tarakanita:         isTarakanita,
        hp_anak:               form.hp_anak ? formatHP(form.hp_anak) : null,
        hp_ortu:               formatHP(form.hp_ortu),
        nama_ayah:             form.nama_ayah,
        nama_ibu:              form.nama_ibu,
        alasan_masuk:          form.alasan_masuk,
        sampai_kapan:          form.sampai_kapan,
        surat_pernyataan_url:  pdfPath,
        sertifikat_komuni_url: sertifikatUrl,
        nomor_data_umat:       form.nomor_data_umat?.trim() || null,
        pernyataan_declared:   true,
        status:                'Pending',
      });

      if (error) throw error;
      setStep(3);
    } catch (err: any) {
      toast.error('Gagal mendaftar: ' + (err.message || 'Coba lagi'));
    } finally {
      setLoading(false);
    }
  }

  // ── Closed state ────────────────────────────────────────────────
  if (!regIsOpen) {
    const openLabel  = regOpenDate  ? regOpenDate.toLocaleDateString('id-ID',  { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    const closeLabel = regCloseDate ? regCloseDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    const isPast = regCloseDate && new Date() > regCloseDate;
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-800 to-brand-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">{isPast ? '🔒' : '⏳'}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isPast ? 'Pendaftaran Sudah Ditutup' : 'Pendaftaran Belum Dibuka'}
          </h2>
          <p className="text-gray-500 text-sm mb-2">
            {isPast
              ? `Pendaftaran baru telah ditutup pada ${closeLabel}.`
              : `Pendaftaran baru dibuka ${openLabel} – ${closeLabel}.`}
          </p>
          <p className="text-gray-400 text-xs mb-6">Hubungi Pengurus jika perlu informasi lebih lanjut.</p>
          <Link to="/login" className="btn-primary w-full">Kembali ke Login</Link>
        </div>
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-800 to-brand-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
          <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pendaftaran Berhasil!</h2>
          <p className="text-gray-600 text-sm mb-6">
            Pendaftaran kamu sudah diterima dan sedang menunggu persetujuan Pengurus.
            Pengurus akan menghubungi melalui nomor HP yang kamu daftarkan.
          </p>
          <p className="text-xs text-gray-400 mb-6 italic">"Serve the Lord with Gladness"</p>
          <Link to="/jadwal" className="btn-primary w-full">Lihat Jadwal Publik</Link>
        </div>
      </div>
    );
  }

  const F = ({ name, label, required, children, hint }: any) => (
    <div>
      <label className="label">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-brand-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 bg-white/15 rounded-2xl items-center justify-center mb-3">
            <Church size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Daftar Misdinar</h1>
          <p className="text-brand-200 text-sm">Paroki Kristus Raja Solo Baru</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-brand-800 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <div className="flex-1 h-px bg-gray-200" />
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-brand-800 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            <p className="text-xs text-gray-400 ml-2">Data Diri & Orang Tua</p>
          </div>

          {/* ── Data Diri ── */}
          <F name="nama_lengkap" label="Nama Lengkap (dan Baptis)" required>
            <input className={`input ${errors.nama_lengkap ? 'input-error' : ''}`}
              value={form.nama_lengkap} onChange={e => handleNamaChange(e.target.value)}
              placeholder="contoh: Aloysius Giodizio Immanuel Setiyawan" />
          </F>

          <F name="nickname" label="Nama Panggilan" required hint="Lowercase, tanpa spasi. Contoh: gio">
            <div className="relative">
              <input
                className={`input ${errors.nickname ? 'input-error' : ''}`}
                value={form.nickname}
                onChange={e => { setForm(f => ({ ...f, nickname: toNickname(e.target.value) })); checkNickname(toNickname(e.target.value)); }}
                placeholder="contoh: gio"
              />
              {nicknameStatus === 'checking' && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-brand-800 rounded-full animate-spin" />
              )}
              {nicknameStatus === 'ok'    && <CheckCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />}
              {nicknameStatus === 'taken' && <AlertCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />}
            </div>
            {nicknameStatus === 'taken' && (
              <p className="text-xs text-red-500 mt-1">Sudah dipakai. Coba: {form.nickname}_{Math.floor(Math.random() * 99) + 1}</p>
            )}
          </F>

          <div className="grid grid-cols-2 gap-3">
            <F name="tanggal_lahir" label="Tanggal Lahir" required>
              <input type="date" className={`input ${errors.tanggal_lahir ? 'input-error' : ''}`}
                value={form.tanggal_lahir} onChange={e => setForm(f => ({ ...f, tanggal_lahir: e.target.value }))} />
            </F>
            <F name="pendidikan" label="Pendidikan" required>
              <select className={`input ${errors.pendidikan ? 'input-error' : ''}`}
                value={form.pendidikan} onChange={e => setForm(f => ({ ...f, pendidikan: e.target.value }))}>
                <option value="">Pilih...</option>
                {PENDIDIKAN_OPTIONS.map(p => <option key={p}>{p}</option>)}
              </select>
            </F>
          </div>

          <F name="sekolah" label="Sekolah" hint="Pilih jenjang dulu, lalu cari nama sekolah">
            <SekolahDropdown
              pendidikan={form.pendidikan}
              value={form.sekolah}
              onChange={(nama, isTarakanita) => setForm(f => ({ ...f, sekolah: nama, is_tarakanita: isTarakanita }))}
            />
          </F>

          <F name="lingkungan" label="Lingkungan" required>
            <select className={`input ${errors.lingkungan ? 'input-error' : ''}`}
              value={form.lingkungan}
              onChange={e => {
                const ling = e.target.value;
                setForm(f => ({ ...f, lingkungan: ling, wilayah: getWilayah(ling) }));
              }}>
              <option value="">Pilih lingkungan...</option>
              {LINGKUNGAN_LIST.map(l => <option key={l}>{l}</option>)}
            </select>
          </F>

          <F name="alamat" label="Alamat Rumah">
            <textarea className="input h-20 resize-none" value={form.alamat}
              onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))} placeholder="Alamat lengkap" />
          </F>

          <div className="grid grid-cols-2 gap-3">
            <F name="hp_anak" label="No. HP Anak (opsional)" hint="Kosongkan jika tidak punya HP">
              <input className="input" value={form.hp_anak}
                onChange={e => setForm(f => ({ ...f, hp_anak: e.target.value }))} placeholder="08xx..." />
            </F>
            <F name="hp_ortu" label="No. HP / WA Orang Tua" required>
              <input className={`input ${errors.hp_ortu ? 'input-error' : ''}`} value={form.hp_ortu}
                onChange={e => setForm(f => ({ ...f, hp_ortu: e.target.value }))} placeholder="08xx..." />
            </F>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <F name="nama_ayah" label="Nama Ayah">
              <input className="input" value={form.nama_ayah}
                onChange={e => setForm(f => ({ ...f, nama_ayah: e.target.value }))} placeholder="Nama ayah" />
            </F>
            <F name="nama_ibu" label="Nama Ibu">
              <input className="input" value={form.nama_ibu}
                onChange={e => setForm(f => ({ ...f, nama_ibu: e.target.value }))} placeholder="Nama ibu" />
            </F>
          </div>

          <F name="alasan_masuk" label="Alasan Menjadi Misdinar">
            <textarea className="input h-20 resize-none" value={form.alasan_masuk}
              onChange={e => setForm(f => ({ ...f, alasan_masuk: e.target.value }))} placeholder="Motivasi kamu..." />
          </F>

          <F name="sampai_kapan" label="Rencana Sampai Kapan">
            <input className="input" value={form.sampai_kapan}
              onChange={e => setForm(f => ({ ...f, sampai_kapan: e.target.value }))} placeholder="Sampai lulus SMA, dll." />
          </F>

          {/* ── Data Paroki ── */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Data Paroki</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-3">
              <p className="text-xs font-semibold text-amber-800">Nomor Data Umat wajib diisi</p>
              <p className="text-xs text-amber-700 mt-1">
                Tanyakan <strong>Nomor Data Umat</strong> ke <strong>PIC Data Umat lingkunganmu</strong> sebelum mengisi form ini.
                Nomor ini biasanya berupa 4 angka (contoh: 1111).
              </p>
            </div>
            <F name="nomor_data_umat" label="Nomor Data Umat" required hint="Contoh: 1111 — tanyakan ke PIC Data Umat lingkunganmu">
              <input
                className={`input font-mono ${errors.nomor_data_umat ? 'input-error' : ''}`}
                value={form.nomor_data_umat}
                onChange={e => setForm(f => ({ ...f, nomor_data_umat: e.target.value }))}
                placeholder="Contoh: 1111"
                maxLength={20}
              />
            </F>
          </div>

          {/* ── Dokumen ── */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Dokumen Pendaftaran</p>

            {/* Sertifikat Komuni / Baptis */}
            <F name="sertifikat_komuni"
               label="Scan Bukti Sertifikat Komuni Pertama / Baptis Dewasa"
               hint="Format PDF, JPG, atau PNG · Maks 2 MB">
              <label className="mt-1 flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-800 transition-colors">
                {form.sertifikat_komuni ? (
                  <>
                    <FileText size={18} className="text-brand-800 shrink-0" />
                    <span className="text-sm text-brand-800 flex-1 truncate">{(form.sertifikat_komuni as File).name}</span>
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); setForm(f => ({ ...f, sertifikat_komuni: null })); }}
                      className="p-1 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload size={18} className="text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-500 flex-1">Klik untuk upload...</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
                    if (!ALLOWED_TYPES.includes(f.type)) { toast.error('Format file tidak didukung. Gunakan PDF, JPG, atau PNG'); return; }
                    if (f.size > 2 * 1024 * 1024) { toast.error('File terlalu besar (maks 2 MB)'); return; }
                    setForm(prev => ({ ...prev, sertifikat_komuni: f }));
                  }}
                />
              </label>
            </F>

            {/* ── Preview Surat Pernyataan ── */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">
                  <FileText size={14} className="inline mr-1 text-brand-800" />
                  Surat Pernyataan
                </label>
                <span className="text-[11px] text-gray-400 italic">Baca sebelum tanda tangan</span>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Doc header strip */}
                <div className="bg-brand-800 px-4 py-2 flex items-center gap-2">
                  <FileText size={13} className="text-white/80" />
                  <span className="text-xs font-semibold text-white tracking-wide">
                    SURAT PERNYATAAN PERSETUJUAN ORANG TUA
                  </span>
                </div>
                {/* Scrollable document body */}
                <div
                  className="bg-white px-6 py-5 text-[11px] leading-relaxed text-gray-800 max-h-96 overflow-y-auto"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                  {/* Kop */}
                  <div className="text-center mb-3 pb-3" style={{ borderBottom: '2.5px double #333' }}>
                    <div className="font-bold text-[12px]">MISDINAR PAROKI KRISTUS RAJA SOLO BARU</div>
                    <div className="text-[10px] mt-0.5">Perumahan Solo Baru Jalan Cendana Raya EF 1, Dusun III, Langenharjo,</div>
                    <div className="text-[10px]">Kec. Grogol, Kabupaten Sukoharjo, Jawa Tengah 57552</div>
                    <div className="text-[10px]">misdinar.kristusraja@gmail.com | @misdinarkr</div>
                  </div>

                  {/* Judul */}
                  <div className="text-center font-bold text-[11.5px] mb-4">
                    <div>SURAT PERNYATAAN PERSETUJUAN ORANG TUA MISDINAR BARU</div>
                    <div>PAROKI KRISTUS RAJA SOLO BARU</div>
                  </div>

                  {/* Intro */}
                  <p className="mb-3">Yang bertanda tangan di bawah ini :</p>

                  {/* Parent fields */}
                  {(
                    [
                      ['Nama',       [form.nama_ayah, form.nama_ibu].filter(Boolean).join(' / ')],
                      ['Lingkungan', form.lingkungan],
                      ['No. Telp.',  form.hp_ortu],
                    ] as [string, string][]
                  ).map(([lbl, val]) => (
                    <div key={lbl} className="flex gap-0 mb-1">
                      <span className="w-24 shrink-0">{lbl}</span>
                      <span className="w-4 shrink-0">:</span>
                      <span className={`font-semibold ${val ? '' : 'text-gray-400 italic'}`}>{val || '—'}</span>
                    </div>
                  ))}

                  {/* Paragraph */}
                  <p className="my-3 text-justify" style={{ textIndent: '1.5em' }}>
                    Merupakan orang tua/wali dari Calon Misdinar Baru yang mendaftar dan akan
                    mengikuti rangkaian kegiatan Misdinar Periode Pelayanan 2025 / 2026 :
                  </p>

                  {/* Child fields */}
                  {(
                    [
                      ['Nama',       form.nama_lengkap],
                      ['Lingkungan', form.lingkungan],
                      ['No. Telp*',  form.hp_anak],
                    ] as [string, string][]
                  ).map(([lbl, val]) => (
                    <div key={lbl} className="flex gap-0 mb-1">
                      <span className="w-24 shrink-0">{lbl}</span>
                      <span className="w-4 shrink-0">:</span>
                      <span className={`font-semibold ${val ? '' : 'text-gray-400 italic'}`}>{val || '—'}</span>
                    </div>
                  ))}

                  {/* Items */}
                  <p className="mt-3 mb-2">Menyatakan bahwa :</p>
                  <ol className="list-decimal ml-4 space-y-2 mb-3 text-justify">
                    <li>Bersedia mendorong dan memotivasi anak tersebut untuk ikut ambil bagian dalam pelayanan misdinar dalam periode pelayanan 2025/2026.</li>
                    <li>Bersedia dan memastikan anak tersebut untuk mematuhi seluruh syarat dan aturan dalam <span className="underline">SOM (STANDAR OPERASIONAL PROSEDUR MISDINAR)</span> Paroki Kristus Raja Solo Baru (link: s.id/SOMKR).</li>
                    <li>Apabila di kemudian hari kami dan/atau anak kami terbukti melanggar isi Surat Pernyataan yang telah kami tandatangani, maka kami bersedia menerima segala bentuk sanksi yang diberikan kepada anak kami sesuai ketentuan yang berlaku.</li>
                  </ol>
                  <p className="text-justify mb-5">
                    Demikian Surat Pernyataan ini kami buat dengan sebenar-benarnya, untuk dapat dipergunakan
                    sebagaimana mestinya, dan kepada yang berkepentingan untuk menjadikan maklum.
                  </p>

                  {/* Signature block */}
                  <div className="flex justify-between items-start mt-2">
                    <div className="text-center w-36">
                      <div>Calon Misdinar Baru</div>
                      <div className="mt-10 border-t border-gray-500 pt-1 text-[10px]">(........................................)</div>
                    </div>
                    <div className="text-center">
                      <div>Solo Baru, ……{' '}
                        {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                      </div>
                      <div className="mt-1">Yang Membuat,</div>
                      <div className="mt-1">Orang Tua Calon Misdinar Baru</div>
                      <div className="mt-10 border-t border-gray-500 pt-1 text-[10px]">(........................................)</div>
                    </div>
                  </div>
                  <p className="text-[10px] italic text-gray-500 mt-3">*Dikosongi apabila tidak punya</p>
                </div>
              </div>
            </div>

            {/* Surat Pernyataan — signature pad: Calon Misdinar */}
            <div className="mt-4">
              <label className="label">
                Tanda Tangan Calon Misdinar Baru
                <span className="text-red-500 ml-1">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                Tanda tangan calon misdinar (anak) sebagai pernyataan kesediaan bergabung.
              </p>
              <SignaturePad
                onChange={dataUrl => setForm(f => ({ ...f, signature_child_data_url: dataUrl }))}
              />
              {errors.signature_child && <p className="text-xs text-red-500 mt-1">{errors.signature_child}</p>}
              {form.signature_child_data_url && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle size={12} /> Tanda tangan calon misdinar tercatat
                </p>
              )}
            </div>

            {/* Surat Pernyataan — signature pad: Orang Tua */}
            <div className="mt-4">
              <label className="label">
                Tanda Tangan Orang Tua / Wali
                <span className="text-red-500 ml-1">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                Dengan menandatangani di bawah ini, orang tua / wali menyatakan mengizinkan anak bergabung
                sebagai Misdinar dan menjamin kebenaran data yang diisi. Sistem akan otomatis membuat
                Surat Pernyataan PDF dari tanda tangan ini.
              </p>
              <SignaturePad
                onChange={dataUrl => setForm(f => ({ ...f, signature_data_url: dataUrl }))}
              />
              {errors.signature && <p className="text-xs text-red-500 mt-1">{errors.signature}</p>}
              {form.signature_data_url && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle size={12} /> Tanda tangan orang tua tercatat
                </p>
              )}
            </div>
          </div>

          {/* ── Pernyataan Kejujuran ── */}
          <div className={`rounded-xl border p-4 ${errors.declared ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.declared}
                onChange={e => setForm(f => ({ ...f, declared: e.target.checked }))}
                className="mt-0.5 w-4 h-4 accent-brand-800 shrink-0"
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                Saya menyatakan bahwa semua data yang diunggah dan diberikan adalah benar adanya.
                Apabila terjadi kesalahan di kemudian hari, saya bersedia bertanggung jawab.
              </span>
            </label>
            {errors.declared && <p className="text-xs text-red-500 mt-2 ml-7">{errors.declared}</p>}
          </div>

          <button
            type="submit"
            className="btn-primary w-full btn-lg mt-2"
            disabled={loading || nicknameStatus === 'taken'}
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Mengirim...</>
            ) : 'Kirim Pendaftaran'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-brand-800 font-semibold hover:underline">Masuk</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
