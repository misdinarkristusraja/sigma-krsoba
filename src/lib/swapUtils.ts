/**
 * Utility functions for Task Swap (Tukar Jadwal / Papan Penawaran)
 */

export const SLOT_LABELS: Record<number, string> = {
  1: 'Sabtu 17:30',
  2: 'Minggu 06:00',
  3: 'Minggu 08:00',
  4: 'Minggu 17:30',
};

export const WEEKEND_SLOT_INFO: Record<number, { time: string; label: string; jam: string }> = {
  1: { time: 'Sabtu 17:30',  label: 'Sabtu Sore',    jam: '17.30' },
  2: { time: 'Minggu 06:00', label: 'Minggu Pagi I',  jam: '06.00' },
  3: { time: 'Minggu 08:00', label: 'Minggu Pagi II', jam: '08.00' },
  4: { time: 'Minggu 17:30', label: 'Minggu Sore',   jam: '17.30' },
};

export interface ParsedSlotSchedule {
  slot: number;
  jam: string;
  tanggal: string;
}

/**
 * Universal slot schedule parser for Misa Khusus.
 * Handles "Jam: Slot 1: 07.00|2026-12-25 | Slot 2: 09.00|2026-12-25" without broken split('|').
 */
export function parseSlotScheduleUniversal(
  draftNote: string | null | undefined,
  fallbackDate: string = ''
): ParsedSlotSchedule[] {
  if (!draftNote) return [];
  const results: ParsedSlotSchedule[] = [];
  const reWithDate = /Slot\s+(\d+):\s*([\d.]+)\|(\d{4}-\d{2}-\d{2})/gi;
  for (const m of draftNote.matchAll(reWithDate)) {
    results.push({ slot: Number(m[1]), jam: m[2] || '07.00', tanggal: m[3] || fallbackDate });
  }
  if (!results.length) {
    const reNoDate = /Slot\s+(\d+):\s*([\d.]+)/gi;
    for (const m of draftNote.matchAll(reNoDate)) {
      results.push({ slot: Number(m[1]), jam: m[2] || '07.00', tanggal: fallbackDate });
    }
  }
  return results;
}

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  Pending:          { label: 'Menunggu PIC',        color: 'badge-yellow' },
  Approved_PIC:     { label: 'Disetujui PIC',        color: 'badge-blue'   },
  Rejected_PIC:     { label: 'Ditolak PIC',          color: 'badge-red'    },
  Replaced:         { label: 'Tergantikan',           color: 'badge-green'  },
  Offered:          { label: 'Di Papan Penawaran',    color: 'badge-purple' },
  Expired:          { label: 'Kadaluarsa',            color: 'badge-gray'   },
  Tidak_Terganti:   { label: 'Tidak Terganti',        color: 'badge-red'    },
};

export const todayStr = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Misa Harian tidak punya struktur slot Sabtu/Minggu (tulis "Misa N").
 * Misa Khusus menampilkan jam & tanggal jika ada di draft_note.
 * Misa akhir-pekan (Mingguan/Jumper/Sabtu_Imam) pakai SLOT_LABELS.
 */
export function slotLabel(
  slot: number | null | undefined,
  tipeEvent?: string | null,
  draftNote?: string | null,
  fallbackDate?: string
): string {
  if (tipeEvent === 'Misa_Harian') return `Misa ${slot || 1}`;
  if (tipeEvent === 'Misa_Khusus') {
    const parsed = parseSlotScheduleUniversal(draftNote, fallbackDate || '');
    const sc = parsed.find(s => s.slot === slot);
    if (sc) {
      return `Misa ${slot} (${sc.jam})${sc.tanggal ? ` · ${sc.tanggal}` : ''}`;
    }
    return `Misa ${slot || 1}`;
  }
  return SLOT_LABELS[slot as number] || `Misa ${slot || 1}`;
}

/**
 * Misa Mingguan menyimpan SATU tanggal_tugas = hari Minggu, tapi slot 1 adalah
 * Misa antisipasi Sabtu (H-1). Nama perayaan tetap nama Minggu, tapi TANGGAL yang
 * ditampilkan harus ikut hari pelaksanaan: slot 1 = Sabtu (tanggal_tugas - 1), slot 2-4 = Minggu.
 * Misa Harian / Misa Khusus = satu hari, tidak ada pergeseran.
 */
export function effectiveDate(
  tanggalTugas: string | null | undefined,
  slot: number | null | undefined,
  tipeEvent?: string | null,
): string | null | undefined {
  if (!tanggalTugas) return tanggalTugas;
  const isWeekend = tipeEvent !== 'Misa_Harian' && tipeEvent !== 'Misa_Khusus';
  if (isWeekend && slot === 1) {
    const d = new Date(tanggalTugas.slice(0, 10) + 'T00:00:00'); // parse lokal, hindari UTC shift
    d.setDate(d.getDate() - 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return tanggalTugas;
}

/**
 * Offered item yang sudah lewat tanggal tugas = "Tidak Terganti"
 */
export function getEffectiveStatus(req: any, today: string = todayStr()): string {
  if (req.status === 'Offered') {
    const ev = req.assignment?.events;
    if (ev?.tanggal_tugas) {
      const eff = effectiveDate(ev.tanggal_tugas, req.assignment?.slot_number, ev.tipe_event);
      if (eff && eff.slice(0, 10) < today) return 'Tidak_Terganti';
    } else if (req.expires_at) {
      const expDate = req.expires_at.slice(0, 10);
      if (expDate < today) return 'Tidak_Terganti';
    }
  }
  return req.status;
}

/**
 * Filter & sort aturan papan penawaran tugas:
 * 1. Hanya tugas mendatang (effectiveDate >= today).
 * 2. Event dan tanggal tugas WAJIB ada dan valid (tidak boleh draft/null/hilang).
 * 3. Tidak menampilkan request milik diri sendiri (jika currentUserId diberikan).
 * 4. Diurutkan berdasarkan jadwal TERDEKAT lebih dulu (effectiveDate asc, lalu slot_number asc).
 */
export function filterAndSortBoardRequests(
  requests: any[],
  today: string = todayStr(),
  currentUserId?: string | null,
): any[] {
  return (requests || [])
    .filter((req: any) => {
      // Status wajib Offered
      if (req.status !== 'Offered') return false;
      if (req.is_penawaran === false) return false;

      // Exclude own request
      if (currentUserId && req.requester_id === currentUserId) return false;

      // Event wajib ada dan punya tanggal_tugas (jika draft/inaccessible, ev bernilai null)
      const ev = req.assignment?.events;
      if (!ev || !ev.tanggal_tugas) return false;

      const effDate = effectiveDate(ev.tanggal_tugas, req.assignment?.slot_number, ev.tipe_event);
      if (!effDate) return false;

      // Hanya tugas mendatang (today atau lebih baru)
      return effDate.slice(0, 10) >= today;
    })
    .sort((a: any, b: any) => {
      // Urutkan jadwal terdekat (effectiveDate asc, slot asc)
      const evA = a.assignment?.events;
      const evB = b.assignment?.events;
      const dateA = effectiveDate(evA?.tanggal_tugas, a.assignment?.slot_number, evA?.tipe_event) || '';
      const dateB = effectiveDate(evB?.tanggal_tugas, b.assignment?.slot_number, evB?.tipe_event) || '';
      const diff = dateA.localeCompare(dateB);
      if (diff !== 0) return diff;
      return (a.assignment?.slot_number || 0) - (b.assignment?.slot_number || 0);
    });
}
