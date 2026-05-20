import React, { useState } from 'react';
import { Download, Send, X, FileText } from 'lucide-react';
import { toPng } from 'html-to-image';
import { formatDate } from '@/lib/utils';
import { supabase as supabaseTyped } from '@/lib/supabase';
const supabase = supabaseTyped as any;
import toast from 'react-hot-toast';

const SLOT_INFO: Record<number, { time: string; label: string; jam: string }> = {
  1: { time: 'Sabtu 17:30',  label: 'SABTU SORE',      jam: '17.30' },
  2: { time: 'Minggu 06:00', label: 'MINGGU PAGI',      jam: '06.00' },
  3: { time: 'Minggu 08:00', label: 'MINGGU PAGI',      jam: '08.00' },
  4: { time: 'Minggu 17:30', label: 'MINGGU SORE',      jam: '17.30' },
};
const PETUGAS_PER_SLOT = 8;
const MONTHS_UPPER = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI',
  'JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];

// ── Shared style constants (match gambar referensi) ──────────────────────────
const FONT   = "'Times New Roman', Times, serif";
const FS_HDR = '28px';   // judul utama
const FS_SUB = '17px';   // subjudul tanggal
const FS_TH  = '16px';   // header kolom
const FS_TGL = '16px';   // cell kiri (tanggal/jam/PIC)
const FS_ROW = '16px';   // cell nama/panggilan/lingkungan
const FS_FTR = '19px';   // footer latihan
const BORDER = '2px solid #111';
const BORDER_OUTER = '3px solid #111';

function parseSlotSchedule(draftNote: string | null, fallback: string) {
  if (!draftNote) return [];
  const raw = draftNote.replace(/^Jam:\s*/i, '');
  return raw.split('|').map(part => {
    const m = part.trim().match(/Slot\s+(\d+):\s*([\d.]+)(?:\|(\d{4}-\d{2}-\d{2}))?/i);
    if (!m) return null;
    return { slot: Number(m[1]), jam: m[2] || '07.00', tanggal: m[3] || fallback || '' };
  }).filter(Boolean) as { slot: number; jam: string; tanggal: string }[];
}

function fmtTglIndo(dateStr: string) {
  if (!dateStr) return '';
  const [y, mo, d] = dateStr.split('-').map(Number);
  const HARI = ['MINGGU','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'];
  const dt = new Date(y, mo - 1, d);
  return `${HARI[dt.getDay()]} ${d} ${MONTHS_UPPER[mo - 1]} ${y}`;
}

// ── Core HTML builder ────────────────────────────────────────────────────────
function buildExportHTML(ev: any, assignments: any[], pelatihOptions: any[] = []) {
  const isMisaKhusus = ev.tipe_event === 'Misa_Khusus';
  const schedule     = isMisaKhusus ? parseSlotSchedule(ev.draft_note, ev.tanggal_tugas) : [];
  const nSlots       = isMisaKhusus ? Math.max(ev.jumlah_misa || 1, schedule.length) : 4;
  const bySlot: Record<number, any[]> = {};
  for (let s = 1; s <= nSlots; s++) bySlot[s] = assignments.filter(a => a.slot_number === s);
  const perayaan = (ev.perayaan || ev.nama_event || 'MISA MINGGUAN').toUpperCase();

  // Subtitle tanggal
  let subtitleTgl: string;
  if (isMisaKhusus) {
    const firstTgl = schedule[0]?.tanggal || ev.tanggal_tugas;
    const lastTgl  = ev.tanggal_tugas;
    subtitleTgl = firstTgl === lastTgl ? fmtTglIndo(lastTgl) : `${fmtTglIndo(firstTgl)} — ${fmtTglIndo(lastTgl)}`;
  } else {
    subtitleTgl = ev.tanggal_latihan
      ? `${fmtTglIndo(ev.tanggal_latihan)} s/d ${fmtTglIndo(ev.tanggal_tugas)}`
      : fmtTglIndo(ev.tanggal_tugas);
  }

  // Rows
  let rows = '';
  for (let slot = 1; slot <= nSlots; slot++) {
    const info    = SLOT_INFO[slot] || SLOT_INFO[1];
    const people  = bySlot[slot] || [];
    const picA    = (ev[`pic_slot_${slot}a`] || '').toUpperCase();
    const picB    = (ev[`pic_slot_${slot}b`] || '').toUpperCase();
    const hpA     = ev[`pic_hp_slot_${slot}a`] || '';
    const sc      = schedule.find(s => s.slot === slot);
    const tglSlot = isMisaKhusus
      ? fmtTglIndo(sc?.tanggal || ev.tanggal_tugas)
      : (slot === 1 && ev.tanggal_latihan ? fmtTglIndo(ev.tanggal_latihan) : fmtTglIndo(ev.tanggal_tugas));
    const rowspan = Math.max(people.length, 1);

    // Left cell
    const jamLabel = isMisaKhusus ? `MISA ${slot} (${sc?.jam || '07.00'})` : info.label;
    const jamValue = isMisaKhusus ? '' : `JAM (${sc?.jam || info.jam})`;
    const picLine  = picA && picB ? `PIC: ${picA} &amp; <b>${picB}</b>`
                   : picA         ? `PIC: <b>${picA}</b>`
                   : picB         ? `PIC: <b>${picB}</b>` : '';
    const hpLine   = hpA ? `(${hpA})` : '';

    const leftCell = `
      <td rowspan="${rowspan}" style="
        border:${BORDER};padding:6px 10px;vertical-align:middle;text-align:center;
        font-family:${FONT};font-size:${FS_TGL};font-weight:bold;line-height:1.75;
        min-width:200px;max-width:200px;background:#f9f9f9;">
        ${jamLabel}<br>
        ${tglSlot}<br>
        ${jamValue ? jamValue + '<br>' : ''}
        ${picLine}<br>
        <span style="font-weight:normal;font-size:13px;color:#444;">${hpLine}</span>
      </td>`;

    if (people.length === 0) {
      rows += `<tr>${leftCell}
        <td style="border:${BORDER};padding:3px 10px;font-family:${FONT};font-size:${FS_ROW};">—</td>
        <td style="border:${BORDER};padding:3px 10px;font-family:${FONT};font-size:${FS_ROW};">—</td>
        <td style="border:${BORDER};padding:3px 10px;font-family:${FONT};font-size:${FS_ROW};">—</td>
      </tr>`;
    } else {
      people.forEach((a, i) => {
        const u = a.users || {};
        rows += `<tr>${i === 0 ? leftCell : ''}
          <td style="border:${BORDER};padding:3px 10px;font-family:${FONT};font-size:${FS_ROW};">${u.nama_lengkap || '—'}</td>
          <td style="border:${BORDER};padding:3px 10px;font-family:${FONT};font-size:${FS_ROW};">${u.nama_panggilan || '—'}</td>
          <td style="border:${BORDER};padding:3px 10px;font-family:${FONT};font-size:${FS_ROW};">${u.lingkungan || '—'}</td>
        </tr>`;
      });
    }
  }

  // Pelatih section — tambah JAM LATIHAN
  const pelatihNicks = [ev.pelatih_slot_1, ev.pelatih_slot_2, ev.pelatih_slot_3].filter(Boolean);
  // Jam latihan: dari latihan_times array atau latihan_notes
  const latihanJam = (() => {
    if (ev.latihan_times && ev.latihan_times.length) return ev.latihan_times.join(', ');
    if (ev.latihan_notes && ev.latihan_notes.trim()) return ev.latihan_notes.trim();
    return '';
  })();
  const latihanHari = ev.tanggal_latihan
    ? (() => {
        const dt = new Date(ev.tanggal_latihan);
        const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
        return HARI[dt.getDay()];
      })()
    : 'Sabtu';

  // Footer: LATIHAN row (selalu tampil di bawah tabel utama)
  const latihanFooter = `
    <tr>
      <td colspan="4" style="
        border:${BORDER_OUTER};padding:14px 12px;text-align:center;
        font-family:${FONT};font-size:${FS_FTR};font-weight:bold;
        background:#fff;letter-spacing:0.5px;">
        LATIHAN : ${latihanHari.toUpperCase()}${latihanJam ? ' (' + latihanJam + ')' : ''}
      </td>
    </tr>`;

  // Pelatih piket section
  let pelatihSection = '';
  if (pelatihNicks.length) {
    const count = pelatihNicks.length;
    const cells = pelatihNicks.map((nick: string) => {
      const found = pelatihOptions.find(p => p.nickname === nick);
      const nama  = (found?.nama_panggilan || nick).toUpperCase();
      const hp    = found?.hp_anak || found?.hp_ortu || '';
      return `
        <td style="
          border:${BORDER};padding:8px 14px;text-align:center;
          font-family:${FONT};font-size:${FS_TGL};
          background:#f0f7ff;width:${Math.floor(100/count)}%;">
          <div style="font-weight:bold;font-size:15px;">${nama}</div>
          ${hp ? `<div style="font-size:13px;color:#555;margin-top:3px;">${hp}</div>` : ''}
          ${latihanJam ? `<div style="font-size:13px;color:#333;margin-top:4px;">Latihan: ${latihanHari} (${latihanJam})</div>` : ''}
        </td>`;
    }).join('');
    const empties = Array(3 - pelatihNicks.length)
      .fill(`<td style="border:${BORDER};padding:8px;background:#f0f7ff;"></td>`)
      .join('');

    pelatihSection = `
      <table style="width:100%;border-collapse:collapse;border:${BORDER_OUTER};margin-top:10px;">
        <thead>
          <tr><th colspan="3" style="
            border:${BORDER_OUTER};padding:8px 12px;text-align:center;
            font-family:${FONT};font-size:${FS_TH};font-weight:bold;
            background:#1a3a5c;color:#fff;letter-spacing:0.5px;">
            PELATIH PIKET
          </th></tr>
        </thead>
        <tbody><tr>${cells}${empties}</tr></tbody>
      </table>`;
  }

  return `
    <div style="font-family:${FONT};width:960px;padding:6px;background:white;">
      <table style="width:100%;border-collapse:collapse;border:${BORDER_OUTER};">
        <thead>
          <tr>
            <th colspan="4" style="
              border:${BORDER_OUTER};padding:16px 14px;text-align:center;
              font-family:${FONT};font-size:${FS_HDR};font-weight:bold;letter-spacing:1px;">
              ${perayaan}
              ${subtitleTgl ? `<div style="font-size:${FS_SUB};font-weight:normal;color:#555;margin-top:4px;">${subtitleTgl}</div>` : ''}
            </th>
          </tr>
          <tr>
            <th style="border:${BORDER};padding:5px 10px;font-family:${FONT};font-size:${FS_TH};font-weight:bold;background:#eee;min-width:200px;text-align:center;">TANGGAL</th>
            <th style="border:${BORDER};padding:5px 10px;font-family:${FONT};font-size:${FS_TH};font-weight:bold;background:#eee;text-align:center;">NAMA LENGKAP</th>
            <th style="border:${BORDER};padding:5px 10px;font-family:${FONT};font-size:${FS_TH};font-weight:bold;background:#eee;text-align:center;">PANGGILAN</th>
            <th style="border:${BORDER};padding:5px 10px;font-family:${FONT};font-size:${FS_TH};font-weight:bold;background:#eee;text-align:center;">LINGKUNGAN</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          ${latihanFooter}
        </tbody>
      </table>
      ${pelatihSection}
    </div>`;
}

// ── WA Text builder ──────────────────────────────────────────────────────────
function buildWAText(ev: any): string {
  const asgn   = ev.assignments || [];
  const bySlot: Record<number, any[]> = {};
  for (let s = 1; s <= 4; s++) bySlot[s] = asgn.filter((a: any) => a.slot_number === s);
  const latihanJam = ev.latihan_times?.[0] || ev.latihan_notes || '';
  const lines = [
    '✝️ JADWAL MISDINAR',
    (ev.perayaan || ev.nama_event || '').toUpperCase(),
    `${formatDate(ev.tanggal_latihan, 'dd')}–${formatDate(ev.tanggal_tugas, 'dd MMMM yyyy')}`,
    '',
  ];
  for (let slot = 1; slot <= 4; slot++) {
    const info = SLOT_INFO[slot];
    const picA = ev[`pic_slot_${slot}a`] || '';
    const picB = ev[`pic_slot_${slot}b`] || '';
    const hpA  = ev[`pic_hp_slot_${slot}a`] || '';
    lines.push(`📍 ${info.time}`);
    if (picA || picB) lines.push(`PIC: ${[picA, picB].filter(Boolean).join(' & ')}${hpA ? ` (${hpA})` : ''}`);
    const names = bySlot[slot]?.map((a: any) => a.users?.nama_panggilan) || [];
    if (!names.length) for (let i = 1; i <= PETUGAS_PER_SLOT; i++) lines.push(`${i}. (kosong)`);
    else names.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
    lines.push('');
  }
  if (latihanJam) lines.push(`🏃 LATIHAN : Sabtu (${latihanJam})`);
  return lines.join('\n');
}

// ── Monthly PDF builder ──────────────────────────────────────────────────────
async function buildMonthlyPDF(year: number, month: number, pelatihOptions: any[]) {
  // Fetch all events in month with assignments
  const start = `${year}-${String(month).padStart(2,'0')}-01`;
  const end   = `${year}-${String(month).padStart(2,'0')}-31`;
  const { data: events, error } = await supabase
    .from('events')
    .select(`
      *,
      assignments(slot_number, position,
        users(id, nama_lengkap, nama_panggilan, lingkungan))
    `)
    .gte('tanggal_tugas', start)
    .lte('tanggal_tugas', end)
    .not('is_draft', 'eq', true)
    .order('tanggal_tugas');

  if (error || !events?.length) {
    toast.error(error?.message || `Tidak ada jadwal bulan ${MONTHS_UPPER[month - 1]} ${year}`);
    return;
  }

  const pages = events.map((ev: any) =>
    buildExportHTML(ev, ev.assignments || [], pelatihOptions)
  ).join('<div style="page-break-after:always;"></div>');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Jadwal Misdinar ${MONTHS_UPPER[month - 1]} ${year}</title>
<style>
  body { margin: 0; padding: 0; background: #fff; }
  @media print {
    @page { size: A4 landscape; margin: 10mm 12mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>${pages}</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { toast.error('Popup diblokir browser. Izinkan popup untuk export PDF.'); return; }
  win.document.write(html);
  win.document.close();
  // Tunggu render sebelum print
  win.onload = () => {
    setTimeout(() => { win.print(); }, 300);
  };
}

// ── Props ────────────────────────────────────────────────────────────────────
interface ExportToolbarProps {
  ev: any;
  picOptions: any[];
  size?: 'sm' | 'md';
}

// ── Component ────────────────────────────────────────────────────────────────
export function ExportToolbar({ ev, picOptions, size = 'sm' }: ExportToolbarProps) {
  const [showWA,       setShowWA]       = useState(false);
  const [waText,       setWaText]       = useState('');
  const [showMonthPDF, setShowMonthPDF] = useState(false);
  const [pdfYear,      setPdfYear]      = useState(new Date().getFullYear());
  const [pdfMonth,     setPdfMonth]     = useState(new Date().getMonth() + 1);
  const [pdfLoading,   setPdfLoading]   = useState(false);

  async function handlePNG() {
    const asgn = ev.assignments || [];
    const html = buildExportHTML(ev, asgn, picOptions);
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      const inner = container.firstElementChild as HTMLElement;
      const png   = await toPng(inner, { pixelRatio: 3, backgroundColor: '#ffffff' });
      const a     = document.createElement('a');
      a.href     = png;
      a.download = `jadwal-${(ev.perayaan || ev.id).replace(/\s+/g, '-')}.png`;
      a.click();
      toast.success('PNG berhasil diunduh!');
    } catch (err: any) {
      toast.error('Gagal export PNG: ' + err.message);
    } finally {
      document.body.removeChild(container);
    }
  }

  function handleWA() {
    setWaText(buildWAText(ev));
    setShowWA(true);
  }

  async function handleMonthPDF() {
    setPdfLoading(true);
    await buildMonthlyPDF(pdfYear, pdfMonth, picOptions);
    setPdfLoading(false);
    setShowMonthPDF(false);
  }

  const btnClass = size === 'sm'
    ? 'btn-outline btn-sm text-xs py-1'
    : 'btn-outline gap-2';

  return (
    <>
      <button onClick={handlePNG} className={`${btnClass} gap-1`} title="Export PNG">
        <Download size={size === 'sm' ? 11 : 16}/>{size !== 'sm' && ' PNG'}
      </button>
      <button onClick={handleWA} className={`${btnClass} gap-1`} title="Template WA">
        <Send size={size === 'sm' ? 11 : 16}/>{size !== 'sm' && ' WA'}
      </button>
      <button onClick={() => setShowMonthPDF(true)} className={`${btnClass} gap-1`} title="Export PDF 1 Bulan">
        <FileText size={size === 'sm' ? 11 : 16}/>{size !== 'sm' && ' PDF Bulan'}
      </button>

      {/* WA Modal */}
      {showWA && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Template WA</h3>
              <button onClick={() => setShowWA(false)}><X size={20}/></button>
            </div>
            <textarea
              className="w-full h-80 font-mono text-xs p-3 border border-gray-200 rounded-xl bg-gray-50 resize-none"
              value={waText} readOnly
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { navigator.clipboard.writeText(waText); toast.success('Disalin!'); }}
                className="btn-primary flex-1"
              >Salin</button>
              <button onClick={() => setShowWA(false)} className="btn-secondary">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly PDF Modal */}
      {showMonthPDF && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <FileText size={18} className="text-indigo-600"/> Export PDF Bulanan
              </h3>
              <button onClick={() => setShowMonthPDF(false)}><X size={20}/></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Semua jadwal dalam satu bulan akan dibuka di tab baru sebagai halaman print.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label">Bulan</label>
                <select
                  className="input"
                  value={pdfMonth}
                  onChange={e => setPdfMonth(Number(e.target.value))}
                >
                  {MONTHS_UPPER.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tahun</label>
                <input
                  type="number"
                  className="input"
                  value={pdfYear}
                  min={2024} max={2030}
                  onChange={e => setPdfYear(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleMonthPDF}
                disabled={pdfLoading}
                className="btn-primary flex-1 gap-2"
              >
                {pdfLoading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Memuat...</>
                  : <><FileText size={15}/> Buka & Print</>
                }
              </button>
              <button onClick={() => setShowMonthPDF(false)} className="btn-secondary">Batal</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
