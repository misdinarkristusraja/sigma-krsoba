import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { MonitorStats } from '../hooks/useAutoAssign';

const PETUGAS_PER_SLOT = 8;

interface PriorityMonitorProps {
  data: MonitorStats | null;
  loading: boolean;
  onRefresh: () => void;
}

export function PriorityMonitor({ data, loading, onRefresh }: PriorityMonitorProps) {
  return (
    <div className="space-y-5">
      {/* Formula explanation */}
      <div className="card bg-blue-50 border border-blue-200 space-y-2">
        <h3 className="font-bold text-blue-900 text-sm">Cara Rumus Prioritas Bekerja</h3>
        <div className="text-xs text-blue-800 space-y-1 leading-relaxed">
          <p><strong>Skor</strong> = hari sejak tugas terakhir + bonus/penalti K1–K6</p>
          <p>→ K1 +5, K2a +4, K2b/K3a/K3b +3, K3c/K4a +2, K4c -2, K6 -10</p>
          <p>→ Belum pernah dijadwalkan = skor <strong>∞</strong> (prioritas tertinggi)</p>
          <p><strong>Persentase</strong> = min-max scaling dari distribusi skor nyata</p>
        </div>
      </div>

      {/* Quota stats */}
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Anggota Aktif',     val: data.poolSize,                                                            color: 'bg-brand-50'  },
              { label: 'Weekend',           val: data.weekendsInMonth + '×',                                               color: 'bg-green-50'  },
              { label: 'Total Slot',        val: data.totalSlotsMonth,                                                     color: 'bg-blue-50'   },
              { label: 'Slot Terisi',       val: `${data.filledSlots}/${data.totalSlotsMonth}`,                            color: data.filledSlots >= data.totalSlotsMonth ? 'bg-green-100' : 'bg-orange-50' },
              { label: 'Ideal per Orang',   val: data.idealPerPerson + '×',                                                color: 'bg-yellow-50' },
            ].map(c => (
              <div key={c.label} className={`card ${c.color} border-0 text-center`}>
                <div className="text-2xl font-black text-gray-800">{c.val}</div>
                <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Quota warning */}
          <div className={`p-3 rounded-xl text-sm flex items-start gap-2 ${
            Number(data.idealPerPerson) < 1  ? 'bg-red-50 border border-red-200 text-red-800' :
            Number(data.idealPerPerson) > 4  ? 'bg-orange-50 border border-orange-200 text-orange-800' :
                                                'bg-green-50 border border-green-200 text-green-800'
          }`}>
            <span className="text-lg">
              {Number(data.idealPerPerson) < 1 ? '⚠️' : Number(data.idealPerPerson) > 4 ? '🔥' : '✅'}
            </span>
            <div>
              <strong>Analisis Kuota: </strong>
              {Number(data.idealPerPerson) < 1
                ? `Pool terlalu besar (${data.poolSize} orang, slot ${data.totalSlotsMonth}).`
                : Number(data.idealPerPerson) > 4
                ? `Pool terlalu kecil — rata-rata ${data.idealPerPerson}× per orang.`
                : `Distribusi ideal: ${data.poolSize} anggota → rata-rata ${data.idealPerPerson}× per bulan.`}
            </div>
          </div>

          {/* Progress bar */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-700 text-sm">Progress Jadwal Bulan Ini</h3>
              <span className="text-xs text-gray-500">{data.filledSlots} / {data.totalSlotsMonth} slot terisi</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all ${
                  data.filledSlots >= data.totalSlotsMonth ? 'bg-green-500' :
                  data.filledSlots > data.totalSlotsMonth * 0.5 ? 'bg-brand-800' : 'bg-orange-400'
                }`}
                style={{ width: `${Math.min(100, Math.round(data.filledSlots / Math.max(1, data.totalSlotsMonth) * 100))}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {data.filledSlots >= data.totalSlotsMonth ? '✅ Semua slot sudah terisi' : `Sisa ${data.totalSlotsMonth - data.filledSlots} slot kosong`}
            </p>
          </div>
        </>
      )}

      {/* Priority table */}
      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-700">Daftar Prioritas Generate</h3>
          <div className="flex items-center gap-2">
            <div className="flex gap-2 text-[10px] font-medium hidden sm:flex">
              <span className="text-red-500">🔴 Lama (&gt;30hr)</span>
              <span className="text-orange-500">🟠 Sedang (7-30hr)</span>
              <span className="text-green-600">🟢 Baru (&lt;7hr)</span>
              <span className="text-blue-500">🆕 Belum pernah</span>
            </div>
            <button onClick={onRefresh} disabled={loading} className="btn-ghost p-1.5">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-400">Menghitung prioritas...</div>
        ) : !data?.members.length ? (
          <div className="p-6 text-center text-gray-400">Klik refresh untuk lihat data</div>
        ) : (
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="tbl text-xs w-full">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Anggota</th>
                  <th>Lingkungan</th>
                  <th>Jadwal Terakhir</th>
                  <th>Hari Sejak</th>
                  <th>K6 Penalti</th>
                  <th title="Latihan terjadwal tanpa tugas (K4c)">K4c</th>
                  <th>Skor</th>
                  <th>Bln Ini</th>
                  <th>Prioritas</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((u, i) => {
                  const tierColor = u.tier === 'new'    ? 'text-blue-500 bg-blue-50' :
                                    u.tier === 'high'   ? 'text-red-600 bg-red-50' :
                                    u.tier === 'medium' ? 'text-orange-500 bg-orange-50' :
                                                          'text-green-600 bg-green-50';
                  const tierIcon  = u.tier === 'new' ? '🆕' : u.tier === 'high' ? '🔴' : u.tier === 'medium' ? '🟠' : '🟢';
                  const barColor  = u.tier === 'new'    ? 'bg-blue-400'   :
                                    u.tier === 'high'   ? 'bg-red-500'    :
                                    u.tier === 'medium' ? 'bg-orange-400' : 'bg-green-400';
                  const nextSlot  = i < PETUGAS_PER_SLOT;
                  return (
                    <tr key={u.id} className={nextSlot ? 'bg-brand-50/50' : ''}>
                      <td className="font-mono text-gray-400">
                        {i + 1}{nextSlot && <span className="ml-1 text-brand-600 font-bold">▶</span>}
                      </td>
                      <td>
                        <div className="font-semibold text-gray-900">{u.nama_panggilan}</div>
                        <div className="text-gray-400">@{u.nickname}</div>
                      </td>
                      <td className="text-gray-500">{u.lingkungan}</td>
                      <td>
                        {u.lastDate
                          ? <span className="text-gray-600">
                              {new Date(u.lastDate).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}
                            </span>
                          : <span className="text-blue-500 font-semibold">Belum pernah</span>
                        }
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-lg font-bold text-xs ${tierColor}`}>
                          {tierIcon} {u.daysSince >= 9999 ? '∞' : u.daysSince === 0 ? 'Hari ini' : `${u.daysSince}hr`}
                        </span>
                      </td>
                      <td className="text-center">
                        {u.k6Count > 0
                          ? <span className="text-red-600 font-bold bg-red-50 px-1.5 rounded text-xs">K6 ×{u.k6Count}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="text-center">
                        {u.k5Count > 0
                          ? <span className="text-yellow-600 font-bold bg-yellow-50 px-1.5 rounded text-xs">K4c ×{u.k5Count}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="text-center font-bold text-sm text-gray-700">
                        {u.score >= 9999 ? '∞' : `${u.score}hr`}
                      </td>
                      <td className="text-center">
                        <span className={u.countThisMonth > 0 ? 'font-bold text-brand-800' : 'text-gray-400'}>
                          {u.countThisMonth > 0 ? `${u.countThisMonth}×` : '—'}
                        </span>
                      </td>
                      <td className="w-28">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 bg-gray-100 rounded-full h-2.5 min-w-[36px] overflow-hidden">
                            <div className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${u.relativePct}%` }}/>
                          </div>
                          <span className={`text-xs font-black w-9 text-right ${
                            u.relativePct >= 80 ? 'text-red-600' :
                            u.relativePct >= 50 ? 'text-orange-500' :
                            u.relativePct >= 20 ? 'text-brand-700' : 'text-gray-400'
                          }`}>{u.relativePct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">
        ▶ Baris merah muda = {PETUGAS_PER_SLOT} orang pertama saat generate berikutnya.
      </p>
    </div>
  );
}
