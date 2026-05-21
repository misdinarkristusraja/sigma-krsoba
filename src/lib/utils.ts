import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid } from 'date-fns';
import { id } from 'date-fns/locale';

// ── Tailwind class merger ──────────────────────────────────
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// ── Date helpers (WIB = UTC+7) ────────────────────────────
export const WIB_OFFSET = 7 * 60; // minutes

export function nowWIB(): Date {
  const now = new Date();
  return new Date(now.getTime() + WIB_OFFSET * 60 * 1000);
}

export function formatWIB(date: Date | string | null | undefined, fmt = 'dd MMM yyyy HH:mm'): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '-';
  return format(d, fmt, { locale: id });
}

export function formatDate(date: Date | string | null | undefined, fmt = 'EEEE, dd MMMM yyyy'): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '-';
  return format(d, fmt, { locale: id });
}

/**
 * Hitung periode minggu: Sabtu 07:00 WIB → Sabtu berikutnya 06:59:59 WIB
 */
export function getWeekPeriod(dateStr: Date | string): { start: string; end: string; label: string } {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;

  const wibMs   = date.getTime() + WIB_OFFSET * 60 * 1000;
  const wib     = new Date(wibMs);
  const dow     = wib.getUTCDay();
  const hourWIB = wib.getUTCHours();

  let weekStart = new Date(date);
  if (dow === 6 && hourWIB >= 7) {
    // already Saturday >= 07:00 WIB
  } else {
    const daysBack = dow === 6 ? 7 : (dow + 1);
    weekStart.setDate(weekStart.getDate() - daysBack);
  }
  weekStart.setHours(7, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(6, 59, 59, 999);

  return {
    start: format(weekStart, 'yyyy-MM-dd'),
    end:   format(weekEnd,   'yyyy-MM-dd'),
    label: `${format(weekStart,'dd MMM', {locale:id})} – ${format(weekEnd,'dd MMM yyyy', {locale:id})}`,
  };
}

// ── Canonical Week Start ──────────────────────────────────
export function toLocalISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export function getWeekStartFromDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  const daysBack = dow === 6 ? 0 : (dow + 1);
  const sat = new Date(y, m - 1, d - daysBack);
  return toLocalISO(sat);
}

export function getWeekEndFromStart(ws: string | null | undefined): string | null {
  if (!ws) return null;
  const [y, m, d] = ws.split('-').map(Number);
  const end = new Date(y, m - 1, d + 6);
  return toLocalISO(end);
}

// ── MyID / CheckSum Generator ─────────────────────────────
export async function generateMyID(nickname: string, tanggalLahir: string): Promise<string> {
  const salt  = import.meta.env.VITE_MYID_SALT || 'sigma-krsoba-default';
  const input = `${nickname.toLowerCase()}|${tanggalLahir}|${salt}`;
  const data  = new TextEncoder().encode(input);
  const hash  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
    .substring(0, 10);
}

// ── QR URL Builder ────────────────────────────────────────
export function buildQRUrl(nickname: string, myid: string, type = 'tugas'): string {
  const base = import.meta.env.VITE_APP_URL || window.location.origin;
  return `${base}/scan?id=${encodeURIComponent(nickname)}&cs=${myid}&t=${type}`;
}

export function parseQRValue(raw: string): { version: string; nickname: string; myid: string; type: string } | null {
  try {
    const url = new URL(raw);
    if (url.hostname.includes('docs.google.com') || url.hostname.includes('google.com')) {
      return {
        version: 'legacy',
        nickname: url.searchParams.get('entry.1892831387') || '',
        myid:     url.searchParams.get('entry.717609437')  || '',
        type:     url.searchParams.get('entry.1680363418') || 'tugas',
      };
    }
    if (url.pathname === '/scan' || url.searchParams.has('cs')) {
      return {
        version:  'new',
        nickname: url.searchParams.get('id') || '',
        myid:     url.searchParams.get('cs') || '',
        type:     url.searchParams.get('t')  || 'tugas',
      };
    }
  } catch {}
  return null;
}

// ── Phone helpers ─────────────────────────────────────────
export function formatHP(hp: string | null | undefined): string {
  if (!hp) return '';
  const clean = hp.replace(/\D/g, '');
  if (clean.startsWith('0')) return '+62' + clean.slice(1);
  if (clean.startsWith('62')) return '+' + clean;
  return clean;
}

export function buildWALink(hp: string | null | undefined, message = ''): string {
  const cleaned = formatHP(hp).replace('+', '');
  const enc = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${cleaned}${enc}`;
}

// ── String helpers ────────────────────────────────────────
export function toNickname(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export function capitalize(str: string | null | undefined): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function truncate(str: string | null | undefined, len = 30): string {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

// ── Liturgy color mapping ─────────────────────────────────
export const LITURGY_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  Hijau:     { bg: 'bg-green-50',  text: 'text-green-800',  dot: 'bg-green-600',  label: 'Hijau'      },
  Merah:     { bg: 'bg-red-50',    text: 'text-red-800',    dot: 'bg-red-600',    label: 'Merah'      },
  Putih:     { bg: 'bg-amber-50',  text: 'text-amber-800',  dot: 'bg-amber-400',  label: 'Putih'      },
  Ungu:      { bg: 'bg-purple-50', text: 'text-purple-800', dot: 'bg-purple-600', label: 'Ungu'       },
  MerahMuda: { bg: 'bg-pink-50',   text: 'text-pink-800',   dot: 'bg-pink-500',   label: 'Merah Muda' },
  Hitam:     { bg: 'bg-gray-100',  text: 'text-gray-800',   dot: 'bg-gray-700',   label: 'Hitam'      },
};

export function getLiturgyClass(color: string | null | undefined) {
  return LITURGY_COLORS[color || ''] || LITURGY_COLORS['Hijau'];
}

// ── Role / Status labels ──────────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
  Administrator:    'Administrator',
  Pengurus:         'Pengurus',
  Pelatih:          'Pelatih',
  Misdinar_Aktif:   'Misdinar Aktif',
  Misdinar_Retired: 'Misdinar Retired',
};

export const STATUS_LABELS: Record<string, string> = {
  Active:    'Aktif',
  Pending:   'Menunggu',
  Retired:   'Pensiun',
  Suspended: 'Disuspend',
};

// ── Points formula (6 kondisi) ────────────────────────────
interface PoinInput {
  isDijadwalkan:  boolean;
  isHadirTugas:   boolean;
  isHadirLatihan: boolean;
  isWalkIn:       boolean;
}

export function hitungPoin({ isDijadwalkan, isHadirTugas, isHadirLatihan, isWalkIn }: PoinInput): { poin: number; kondisi: string | null } {
  if (isDijadwalkan && isHadirTugas && isHadirLatihan)   return { poin:  2, kondisi: 'K1' };
  if (!isDijadwalkan && isWalkIn && isHadirLatihan)      return { poin:  3, kondisi: 'K2' };
  if (isDijadwalkan && isHadirTugas && !isHadirLatihan)  return { poin:  1, kondisi: 'K3' };
  if (!isDijadwalkan && isWalkIn && !isHadirLatihan)     return { poin:  2, kondisi: 'K4' };
  if (!isDijadwalkan && !isWalkIn && isHadirLatihan)     return { poin:  1, kondisi: 'K5' };
  if (isDijadwalkan && !isHadirTugas && !isHadirLatihan) return { poin: -1, kondisi: 'K6' };
  return { poin: 0, kondisi: null };
}

// ── Export CSV helper ─────────────────────────────────────
interface CSVHeader { label: string; key: string }

export function downloadCSV(rows: Record<string, unknown>[], headers: CSVHeader[], filename: string): void {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headerRow = headers.map(h => escape(h.label)).join(',');
  const dataRows  = rows.map(r => headers.map(h => escape(r[h.key])).join(','));
  const csv  = [headerRow, ...dataRows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href  = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// ── Sleep helper ──────────────────────────────────────────
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Weekend dates for a given month ───────────────────────
export function getWeekends(year: number, month: number): { saturday: string; sunday: string }[] {
  const result: { saturday: string; sunday: string }[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 0) {
      const sat = new Date(year, month - 1, d.getDate() - 1);
      result.push({ saturday: toLocalISO(sat), sunday: toLocalISO(d) });
    }
    d.setDate(d.getDate() + 1);
  }
  return result;
}

// ── Pendidikan options ────────────────────────────────────
export const PENDIDIKAN_OPTIONS = ['SD', 'SMP', 'SMA', 'SMK', 'Lulus'];
export const JENJANG_LABELS: Record<string, string> = { SD: 'SD', SMP: 'SMP', SMA: 'SMA', SMK: 'SMK', Lulus: 'Alumni' };

// ── Disambiguasi nama panggilan ───────────────────────────
interface MemberLike {
  id:              string;
  nama_panggilan?: string;
  nickname?:       string;
  nama_lengkap?:   string;
  lingkungan?:     string;
}

export function tagDuplicateNames(members: MemberLike[]): Record<string, string> {
  const result: Record<string, string> = {};
  const byName: Record<string, MemberLike[]> = {};

  members.forEach(m => {
    const key = (m.nama_panggilan || '').trim().toLowerCase();
    if (!byName[key]) byName[key] = [];
    byName[key].push(m);
  });

  members.forEach(m => {
    const key   = (m.nama_panggilan || '').trim().toLowerCase();
    const group = byName[key];

    if (group.length <= 1) {
      result[m.id] = m.nama_panggilan || m.nickname || m.id;
    } else {
      const base = m.nama_panggilan || m.nickname || m.id;

      if (m.nama_lengkap) {
        const parts = m.nama_lengkap.trim().split(/\s+/);
        if (parts.length > 1) {
          const initial     = parts[parts.length - 1][0].toUpperCase() + '.';
          const sameInitial = group.filter(g => {
            if (!g.nama_lengkap) return false;
            const gParts = g.nama_lengkap.trim().split(/\s+/);
            return gParts.length > 1 && gParts[gParts.length-1][0].toUpperCase() === initial[0];
          });
          if (sameInitial.length === 1) { result[m.id] = `${base} ${initial}`; return; }
        }
      }

      if (m.lingkungan) {
        const sameLinkg = group.filter(g => g.lingkungan === m.lingkungan);
        if (sameLinkg.length === 1) { result[m.id] = `${base} (${m.lingkungan})`; return; }
      }

      result[m.id] = `${base} [${m.nickname}]`;
    }
  });

  return result;
}

export function getDisplayName(member: MemberLike, allMembers: MemberLike[]): string {
  if (!allMembers?.length) return member.nama_panggilan || member.nickname || member.id;
  const tagged = tagDuplicateNames(allMembers);
  return tagged[member.id] || member.nama_panggilan || member.nickname || member.id;
}

// ── Event PIC helpers ─────────────────────────────────────
export type EventPic = { id?: string; slot: number; nama: string; hp?: string | null; urutan: number };

export function getPicsForSlot(event_pics: EventPic[] | null | undefined, slot: number): EventPic[] {
  if (!event_pics) return [];
  return event_pics
    .filter(p => p.slot === slot)
    .sort((a, b) => a.urutan - b.urutan);
}

export function getPicNames(event_pics: EventPic[] | null | undefined, slot: number): string {
  return getPicsForSlot(event_pics, slot).map(p => p.nama).join(' / ') || '—';
}

export function getPicHp(event_pics: EventPic[] | null | undefined, slot: number): string | null {
  const pics = getPicsForSlot(event_pics, slot);
  return pics[0]?.hp || null;
}
