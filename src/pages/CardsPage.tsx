import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { buildQRUrl } from '../lib/utils';
import { toggleSelectMember, toggleSelectAll, getSelectedMembers } from '../lib/cardExportHelpers';
import { CreditCard, Download, Search, FileDown, Loader, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';

function titleCase(s: string): string {
  return (s||'').replace(/\b\w/g, c => c.toUpperCase());
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n-1) + '…' : s;
}

async function makeQR(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 280, margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

async function drawCard(
  member: any,
  qrDataUrl: string,
  type: string,
  options: { scale?: number; format?: 'png' | 'jpeg'; quality?: number } = {}
): Promise<string> {
  const isTugas = type === 'tugas';
  const SC = options.scale || 3, W = 380, H = 225;
  const cv = document.createElement('canvas');
  cv.width = W * SC; cv.height = H * SC;
  const c = cv.getContext('2d')!;
  c.scale(SC, SC);

  // ── Background ────────────────────────────────────────
  c.save();
  rr(c, 0, 0, W, H, 16);
  c.clip();

  if (isTugas) {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#FFFAEB'); g.addColorStop(1, '#FEF3C7');
    c.fillStyle = g;
  } else {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#8B0000'); g.addColorStop(1, '#5C0000');
    c.fillStyle = g;
  }
  c.fillRect(0, 0, W, H);

  // Decorative circles
  c.globalAlpha = 0.06;
  c.fillStyle = isTugas ? '#92400E' : '#fff';
  c.beginPath(); c.arc(W - 20, -20, 80, 0, Math.PI*2); c.fill();
  c.beginPath(); c.arc(W - 50, H + 10, 60, 0, Math.PI*2); c.fill();
  c.beginPath(); c.arc(30, H*0.6, 40, 0, Math.PI*2); c.fill();
  c.globalAlpha = 1;

  // Left accent
  if (isTugas) {
    const ag = c.createLinearGradient(0, 0, 0, H);
    ag.addColorStop(0, '#F59E0B'); ag.addColorStop(1, '#D97706');
    c.fillStyle = ag;
    c.fillRect(0, 0, 5, H);
  } else {
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(0, 0, 5, H);
  }
  c.restore();

  const QS = 148, QX = W - QS - 14, QY = Math.floor((H - QS) / 2);

  // QR background
  c.save();
  rr(c, QX - 6, QY - 6, QS + 12, QS + 12, 12);
  c.fillStyle = isTugas ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.13)';
  c.fill();
  c.strokeStyle = isTugas ? '#FCD34D' : 'rgba(255,255,255,0.25)';
  c.lineWidth = 1.5;
  c.stroke();
  c.restore();

  // Draw QR
  await new Promise<void>(res => {
    const img = new Image();
    img.onload = () => { c.drawImage(img, QX, QY, QS, QS); res(); };
    img.onerror = () => res();
    img.src = qrDataUrl;
  });

  // ── Typography ────────────────────────────────────────
  const txtMain = isTugas ? '#1C1917' : '#FFFFFF';
  const txtSub  = isTugas ? '#B45309' : '#FCA5A5';
  const txtFaint= isTugas ? 'rgba(161,80,0,0.55)' : 'rgba(255,255,255,0.38)';
  const LX = 18;

  // Badge pill "KARTU LATIHAN / TUGAS"
  const label = isTugas ? 'KARTU TUGAS' : 'KARTU LATIHAN';
  c.font = 'bold 8px Arial';
  const tw = c.measureText(label).width;
  const PX = LX, PY = 14, PW = tw + 14, PH = 14, PR = 7;
  c.save();
  rr(c, PX, PY, PW, PH, PR);
  c.fillStyle = isTugas ? '#F59E0B' : 'rgba(255,255,255,0.18)';
  c.fill();
  c.restore();
  c.font = 'bold 7.5px Arial';
  c.fillStyle = isTugas ? '#fff' : '#fff';
  c.fillText(label, PX + 7, PY + PH - 4);

  // SIGMA
  c.font = 'bold 32px Arial';
  c.fillStyle = txtMain;
  c.fillText('SIGMA', LX, 68);

  // Subtitle
  c.font = '9.5px Arial';
  c.fillStyle = txtSub;
  c.fillText('Misdinar Kristus Raja Solo Baru', LX, 82);

  // Divider
  c.strokeStyle = isTugas ? 'rgba(180,83,9,0.18)' : 'rgba(255,255,255,0.15)';
  c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(LX, 88); c.lineTo(QX - 8, 88); c.stroke();

  // Name
  const name = truncate(titleCase(member.nama_panggilan || member.nickname), 18);
  c.font = 'bold 18px Arial';
  c.fillStyle = txtMain;
  c.fillText(name, LX, H - 62);

  // Lingkungan
  c.font = '10.5px Arial';
  c.fillStyle = txtSub;
  c.fillText(member.lingkungan || '', LX, H - 47);

  // Instructions
  c.font = 'italic 8px Arial';
  c.fillStyle = txtSub;
  c.fillText(isTugas
    ? 'Tunjukkan kepada PIC saat bertugas'
    : 'Tunjukkan kepada Pelatih saat latihan', LX, H - 28);

  // Handle
  c.font = '7.5px Arial';
  c.fillStyle = txtFaint;
  c.fillText('@misdinarkrsoba', LX, H - 16);

  // Tagline — under QR, centered
  c.font = 'italic 7.5px Arial';
  c.fillStyle = txtFaint;
  c.textAlign = 'center';
  c.fillText('Serve Lord With Gladness', QX + QS / 2, H - 8);
  c.textAlign = 'left';

  // Border outline
  c.save();
  rr(c, 0.75, 0.75, W - 1.5, H - 1.5, 16);
  c.strokeStyle = isTugas ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.08)';
  c.lineWidth = 1.5;
  c.stroke();
  c.restore();

  const format = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality = options.quality !== undefined ? options.quality : (format === 'image/jpeg' ? 0.85 : 1.0);
  return cv.toDataURL(format, quality);
}

export default function CardsPage() {
  const { profile, isPengurus } = useAuth();
  const [members,  setMembers]  = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search,   setSearch]   = useState('');
  const [cardPngs, setCardPngs] = useState<Record<string, string>>({ latihan: '', tugas: '' });
  const [genLoading, setGenLoading] = useState(false);
  const [bulkProg, setBulkProg] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    supabase.from('users')
      .select('id, nickname, myid, nama_panggilan, lingkungan, status')
      .in('status', ['Active', 'Pending']).order('nama_panggilan')
      .then(({ data }: { data: any }) => {
        const list = data || [];
        setMembers(list);
        setSelectedIds(new Set(list.map((m: any) => m.id)));
        const params = new URLSearchParams(window.location.search);
        const targetId = params.get('user');
        if (targetId) {
          const target = list.find((m: any) => m.id === targetId);
          if (target) setSelected(target);
          else if (!isPengurus && profile) {
            const me = list.find((m: any) => m.id === profile.id);
            if (me) setSelected(me);
          }
        } else if (!isPengurus && profile) {
          const me = list.find((m: any) => m.id === profile.id);
          if (me) setSelected(me);
        }
      });
  }, [profile, isPengurus]);

  const displayMember = selected || members[0] || null;

  useEffect(() => {
    if (!displayMember?.myid) return;
    let cancelled = false;
    setCardPngs({ latihan: '', tugas: '' });
    (async () => {
      const lUrl = buildQRUrl(displayMember.nickname, displayMember.myid, 'latihan');
      const tUrl = buildQRUrl(displayMember.nickname, displayMember.myid, 'tugas');
      const [lQR, tQR] = await Promise.all([makeQR(lUrl), makeQR(tUrl)]);
      if (cancelled) return;
      const [lPng, tPng] = await Promise.all([
        drawCard(displayMember, lQR, 'latihan'),
        drawCard(displayMember, tQR, 'tugas'),
      ]);
      if (!cancelled) setCardPngs({ latihan: lPng, tugas: tPng });
    })();
    return () => { cancelled = true; };
  }, [displayMember?.id]);

  function downloadPNG(type: string) {
    const a = document.createElement('a');
    a.href = cardPngs[type];
    a.download = `kartu-${type}-${displayMember?.nickname}.png`;
    a.click();
  }

  function downloadPDF() {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85, 54] });
    pdf.addImage(cardPngs.latihan, 'PNG', 0, 0, 85, 54);
    pdf.addPage([85, 54], 'landscape');
    pdf.addImage(cardPngs.tugas, 'PNG', 0, 0, 85, 54);
    pdf.save(`kartu-${displayMember?.nickname}.pdf`);
    toast.success('PDF 2 kartu diunduh!');
  }

  async function bulkExport() {
    const targetMembers = getSelectedMembers(members, selectedIds);
    if (!isPengurus || !targetMembers.length) {
      toast.error('Pilih minimal 1 anggota untuk diexport');
      return;
    }
    setGenLoading(true);
    setBulkProg({ done: 0, total: targetMembers.length });
    // 1 halaman per kartu (landscape card-size) using optimized JPEG compression to prevent String Length Error
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85, 54] });
    let firstPage = true;

    try {
      for (let i = 0; i < targetMembers.length; i++) {
        const m = targetMembers[i];
        if (!m.myid) { setBulkProg(p => p ? ({...p, done: i+1}) : null); continue; }
        const [lQR, tQR] = await Promise.all([
          makeQR(buildQRUrl(m.nickname, m.myid, 'latihan')),
          makeQR(buildQRUrl(m.nickname, m.myid, 'tugas')),
        ]);
        const [lJpeg, tJpeg] = await Promise.all([
          drawCard(m, lQR, 'latihan', { scale: 2, format: 'jpeg', quality: 0.85 }),
          drawCard(m, tQR, 'tugas', { scale: 2, format: 'jpeg', quality: 0.85 }),
        ]);

        // Kartu Latihan (1 halaman)
        if (!firstPage) pdf.addPage([85, 54], 'landscape');
        firstPage = false;
        pdf.addImage(lJpeg, 'JPEG', 0, 0, 85, 54, undefined, 'FAST');

        // Kartu Tugas (1 halaman)
        pdf.addPage([85, 54], 'landscape');
        pdf.addImage(tJpeg, 'JPEG', 0, 0, 85, 54, undefined, 'FAST');

        setBulkProg({ done: i + 1, total: targetMembers.length });
      }
      pdf.save(`kartu-sigma-terpilih-${targetMembers.length}.pdf`);
      toast.success(`${targetMembers.length * 2} kartu (${targetMembers.length} anggota) selesai diexport!`);
    } catch (e: any) {
      toast.error('Gagal: ' + e.message);
    } finally {
      setGenLoading(false); setBulkProg(null);
    }
  }

  const filtered = members.filter(m =>
    !search || m.nama_panggilan?.toLowerCase().includes(search.toLowerCase()) ||
    m.nickname?.toLowerCase().includes(search.toLowerCase())
  );

  const allFilteredIds = filtered.map(m => m.id);
  const isAllSelected = members.length > 0 && selectedIds.size === members.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Kartu Anggota</h1>
          <p className="page-subtitle">QR untuk scan absensi · Latihan & Tugas</p>
        </div>
        {isPengurus && (
          <button onClick={bulkExport} disabled={genLoading || selectedIds.size === 0}
            className="btn-primary gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 shadow-md">
            <FileDown size={16}/>
            {bulkProg
              ? `${bulkProg.done}/${bulkProg.total}...`
              : `Export PDF (${selectedIds.size} Anggota)`
            }
          </button>
        )}
      </div>

      {bulkProg && (
        <div className="space-y-1 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
          <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div className="bg-brand-800 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(bulkProg.done/bulkProg.total*100)}%` }}/>
          </div>
          <p className="text-xs text-gray-500 text-center font-medium">
            Memproses export {bulkProg.done} dari {bulkProg.total} anggota...
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {isPengurus && (
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-700 text-sm">Pilih Anggota Export</h3>
              <button
                onClick={() => setSelectedIds(toggleSelectAll(selectedIds, members.map(m => m.id)))}
                className="text-xs font-semibold text-brand-800 hover:text-brand-900 flex items-center gap-1 hover:underline">
                {isAllSelected ? <CheckSquare size={13}/> : <Square size={13}/>}
                {isAllSelected ? 'Batal Semua' : 'Pilih Semua'}
              </button>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input className="input pl-8 text-sm" placeholder="Cari nama..."
                value={search} onChange={e => setSearch(e.target.value)}/>
            </div>

            <div className="text-xs text-gray-400 font-medium px-1 flex justify-between">
              <span>{selectedIds.size} dari {members.length} anggota terpilih</span>
              {search && <span>({filtered.length} cocok)</span>}
            </div>

            <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
              {filtered.map(m => {
                const isChecked = selectedIds.has(m.id);
                const isCurrent = selected?.id === m.id;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 border ${
                      isCurrent
                        ? 'bg-brand-50 border-brand-200 text-brand-950 font-medium shadow-xs'
                        : 'bg-white border-transparent hover:bg-gray-50 text-gray-700'
                    }`}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIds(prev => toggleSelectMember(prev, m.id));
                      }}
                      className="text-brand-800 hover:scale-110 transition-transform shrink-0"
                      title={isChecked ? 'Hapus centang' : 'Centang untuk export'}>
                      {isChecked
                        ? <CheckSquare size={17} className="text-brand-800 fill-brand-100"/>
                        : <Square size={17} className="text-gray-300"/>
                      }
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelected(m)}
                      className="flex-1 text-left min-w-0">
                      <div className="font-medium truncate flex items-center gap-1.5">
                        <span className="truncate">{titleCase(m.nama_panggilan)}</span>
                        {m.status === 'Pending' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded font-semibold shrink-0">
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        @{m.nickname} · {m.lingkungan}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={`${isPengurus?'lg:col-span-2':'lg:col-span-3'} space-y-5`}>
          {!displayMember ? (
            <div className="card text-center py-12 text-gray-400">
              <CreditCard size={40} className="mx-auto mb-3 opacity-30"/>
              <p>Pilih anggota untuk melihat kartu</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-6 justify-center">
                {['latihan','tugas'].map(type => (
                  <div key={type} className="flex flex-col items-center gap-3 group">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      {type === 'latihan' ? 'Kartu Latihan' : 'Kartu Tugas'}
                    </p>
                    <div className="w-80 h-[192px] rounded-2xl overflow-hidden shadow-xl transition-all duration-300 group-hover:shadow-2xl group-hover:scale-[1.02]">
                      {cardPngs[type]
                        ? <img src={cardPngs[type]} alt="" className="w-full h-full object-cover"/>
                        : <div className={`w-full h-full flex items-center justify-center ${type==='latihan'?'bg-brand-800':'bg-amber-50 border-2 border-amber-200'}`}>
                            <Loader size={28} className={type==='latihan'?'text-white animate-spin':'text-amber-400 animate-spin'}/>
                          </div>
                      }
                    </div>
                    <button onClick={() => downloadPNG(type)} disabled={!cardPngs[type]}
                      className="btn-secondary btn-sm gap-1.5 w-full transition-all hover:scale-105 active:scale-95 disabled:opacity-40">
                      <Download size={13}/> Download PNG
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-center">
                <button onClick={downloadPDF} disabled={!cardPngs.latihan||!cardPngs.tugas}
                  className="btn-primary gap-2 px-8 transition-all hover:scale-105 active:scale-95 disabled:opacity-40">
                  <FileDown size={16}/> Download PDF (2 Kartu)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

