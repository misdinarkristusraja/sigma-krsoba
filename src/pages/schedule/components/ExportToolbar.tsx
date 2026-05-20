import React, { useState } from 'react';
import { Download, Send, X } from 'lucide-react';
import { toPng } from 'html-to-image';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const SLOT_INFO: Record<number, { time: string; label: string; jam: string }> = {
  1: { time: 'Sabtu 17:30',  label: 'Sabtu Sore',    jam: '17.30' },
  2: { time: 'Minggu 06:00', label: 'Minggu Pagi I',  jam: '06.00' },
  3: { time: 'Minggu 08:00', label: 'Minggu Pagi II', jam: '08.00' },
  4: { time: 'Minggu 17:30', label: 'Minggu Sore',   jam: '17.30' },
};
const PETUGAS_PER_SLOT = 8;
const MONTHS_UPPER = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];

function parseSlotSchedule(draftNote: string | null, fallback: string) {
  if (!draftNote) return [];
  const raw = draftNote.replace(/^Jam:\s*/i, '');
  return raw.split('|').map(part => {
    const m = part.trim().match(/Slot\s+(\d+):\s*([\d.]+)(?:\|(\d{4}-\d{2}-\d{2}))?/i);
    if (!m) return null;
    return { slot: Number(m[1]), jam: m[2] || '07.00', tanggal: m[3] || fallback || '' };
  }).filter(Boolean) as { slot: number; jam: string; tanggal: string }[];
}

function buildExportHTML(ev: any, assignments: any[], pelatihOptions: any[] = []) {
  const isMisaKhusus = ev.tipe_event === 'Misa_Khusus';
  const schedule     = isMisaKhusus ? parseSlotSchedule(ev.draft_note, ev.tanggal_tugas) : [];
  const nSlots       = isMisaKhusus ? Math.max(ev.jumlah_misa || 1, schedule.length) : 4;
  const bySlot: Record<number, any[]> = {};
  for (let s = 1; s <= nSlots; s++) bySlot[s] = assignments.filter(a => a.slot_number === s);
  const perayaan = ev.perayaan || ev.nama_event || 'MISA MINGGUAN';

  function fmtTglIndo(dateStr: string) {
    if (!dateStr) return '';
    const [y, mo, d] = dateStr.split('-').map(Number);
    const HARI_UPPER = ['MINGGU','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'];
    const dt = new Date(y, mo - 1, d);
    return `${HARI_UPPER[dt.getDay()]} ${d} ${MONTHS_UPPER[mo - 1]} ${y}`;
  }

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

  let rows = '';
  for (let slot = 1; slot <= nSlots; slot++) {
    const info    = SLOT_INFO[slot] || SLOT_INFO[1];
    const people  = bySlot[slot] || [];
    const picA    = ev[`pic_slot_${slot}a`] || '—';
    const picB    = ev[`pic_slot_${slot}b`] || '—';
    const hpA     = ev[`pic_hp_slot_${slot}a`] || '';
    const sc      = schedule.find(s => s.slot === slot);
    const tglSlot = isMisaKhusus
      ? fmtTglIndo(sc?.tanggal || ev.tanggal_tugas)
      : (slot === 1 && ev.tanggal_latihan ? fmtTglIndo(ev.tanggal_latihan) : fmtTglIndo(ev.tanggal_tugas));
    const rowspan  = Math.max(people.length, 1);
    const jamLabel = isMisaKhusus ? `MISA ${slot} (${sc?.jam || '07.00'})` : info.label.toUpperCase();
    const jamRow   = isMisaKhusus ? '' : `JAM (${sc?.jam || info.jam})<br>`;
    const hp       = hpA ? `HP PIC: ${hpA}` : '';

    const tanggalCell = `
      <td rowspan="${rowspan}" style="border:1px solid #333;padding:8px 10px;vertical-align:middle;text-align:center;font-size:11px;font-weight:bold;line-height:1.6;min-width:160px;background:#f9f9f9;">
        ${jamLabel}<br>${tglSlot}<br>${jamRow}
        PIC: ${picA.toUpperCase()}${picB !== '—' ? ' &amp; ' + picB.toUpperCase() : ''}<br>
        <span style="font-weight:normal;font-size:10px;color:#555;">${hp}</span>
      </td>`;

    if (people.length === 0) {
      rows += `<tr>${tanggalCell}<td style="border:1px solid #333;padding:6px 10px;font-size:11px;">—</td><td style="border:1px solid #333;padding:6px 10px;font-size:11px;">—</td><td style="border:1px solid #333;padding:6px 10px;font-size:11px;">—</td></tr>`;
    } else {
      people.forEach((a, i) => {
        const u = a.users || {};
        rows += `<tr>${i === 0 ? tanggalCell : ''}
          <td style="border:1px solid #333;padding:5px 10px;font-size:11px;">${u.nama_lengkap || '—'}</td>
          <td style="border:1px solid #333;padding:5px 10px;font-size:11px;">${u.nama_panggilan || '—'}</td>
          <td style="border:1px solid #333;padding:5px 10px;font-size:11px;">${u.lingkungan || '—'}</td>
        </tr>`;
      });
    }
  }

  const pelatihNicks = [ev.pelatih_slot_1, ev.pelatih_slot_2, ev.pelatih_slot_3].filter(Boolean);
  let pelatihSection = '';
  if (pelatihNicks.length) {
    const cells = pelatihNicks.map((nick: string) => {
      const found = pelatihOptions.find(p => p.nickname === nick);
      const nama  = found?.nama_panggilan || nick;
      const hp    = found?.hp_anak || found?.hp_ortu || '';
      return `<td style="border:1px solid #bbb;padding:8px 14px;text-align:center;font-size:11px;background:#f0f7ff;width:${Math.floor(100/pelatihNicks.length)}%;">
        <div style="font-weight:bold;font-size:12px;color:#1a3a5c;">${nama.toUpperCase()}</div>
        <div style="color:#555;font-size:10px;margin-top:2px;">@${nick}${hp ? ' · ' + hp : ''}</div></td>`;
    }).join('');
    const empties = Array(3 - pelatihNicks.length).fill('<td style="border:1px solid #bbb;padding:8px;background:#f0f7ff;"></td>').join('');
    pelatihSection = `<table style="width:100%;border-collapse:collapse;border:2px solid #333;margin-top:10px;">
      <thead><tr><th colspan="3" style="border:2px solid #333;padding:8px 12px;text-align:center;font-size:12px;font-weight:bold;background:#1a3a5c;color:#fff;">PELATIH PIKET</th></tr></thead>
      <tbody><tr>${cells}${empties}</tr></tbody></table>`;
  }

  return `<div style="font-family:'Arial',sans-serif;width:900px;padding:20px;background:white;">
    <table style="width:100%;border-collapse:collapse;border:2px solid #333;">
      <thead>
        <tr><th colspan="4" style="border:2px solid #333;padding:10px 12px;text-align:center;font-size:16px;font-weight:bold;letter-spacing:1px;">
          ${perayaan.toUpperCase()}
          <div style="font-size:11px;font-weight:normal;color:#555;margin-top:3px;">${subtitleTgl}</div>
        </th></tr>
        <tr>
          <th style="border:1px solid #333;padding:8px;font-size:12px;background:#eee;min-width:160px;">TANGGAL</th>
          <th style="border:1px solid #333;padding:8px;font-size:12px;background:#eee;">NAMA LENGKAP</th>
          <th style="border:1px solid #333;padding:8px;font-size:12px;background:#eee;">PANGGILAN</th>
          <th style="border:1px solid #333;padding:8px;font-size:12px;background:#eee;">LINGKUNGAN</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>${pelatihSection}</div>`;
}

function buildWAText(ev: any): string {
  const asgn   = ev.assignments || [];
  const bySlot: Record<number, any[]> = {};
  for (let s = 1; s <= 4; s++) bySlot[s] = asgn.filter((a: any) => a.slot_number === s);
  const lines = ['PERAYAAN EKARISTI', ev.perayaan || ev.nama_event,
    `${formatDate(ev.tanggal_latihan,'dd')}–${formatDate(ev.tanggal_tugas,'dd MMMM yyyy')}`, ''];
  for (let slot = 1; slot <= 4; slot++) {
    const info = SLOT_INFO[slot];
    const picA = ev[`pic_slot_${slot}a`];
    const picB = ev[`pic_slot_${slot}b`];
    const hpA  = ev[`pic_hp_slot_${slot}a`];
    lines.push(info.time);
    if (picA || picB) lines.push(`PIC: ${[picA,picB].filter(Boolean).join(' & ')}${hpA ? ` (${hpA})` : ''}`);
    const names = bySlot[slot]?.map((a: any) => a.users?.nama_panggilan) || [];
    if (!names.length) for (let i=1;i<=PETUGAS_PER_SLOT;i++) lines.push(`${i}. (kosong)`);
    else names.forEach((n,i) => lines.push(`${i+1}. ${n}`));
    lines.push('');
  }
  return lines.join('\n');
}

interface ExportToolbarProps {
  ev: any;
  picOptions: any[];
  size?: 'sm' | 'md';
}

export function ExportToolbar({ ev, picOptions, size = 'sm' }: ExportToolbarProps) {
  const [showWA, setShowWA] = useState(false);
  const [waText, setWaText] = useState('');

  async function handlePNG() {
    const asgn = ev.assignments || [];
    const html = buildExportHTML(ev, asgn, picOptions);
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      const inner = container.firstElementChild as HTMLElement;
      const png   = await toPng(inner, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const a     = document.createElement('a');
      a.href     = png;
      a.download = `jadwal-${ev.perayaan?.replace(/\s+/g,'-') || ev.id}.png`;
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

      {showWA && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Template WA</h3>
              <button onClick={() => setShowWA(false)}><X size={20}/></button>
            </div>
            <textarea className="w-full h-80 font-mono text-xs p-3 border border-gray-200 rounded-xl bg-gray-50 resize-none" value={waText} readOnly/>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { navigator.clipboard.writeText(waText); toast.success('Disalin!'); }} className="btn-primary flex-1">Salin</button>
              <button onClick={() => setShowWA(false)} className="btn-secondary">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
