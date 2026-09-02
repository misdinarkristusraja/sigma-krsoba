import { SupabaseClient } from '@supabase/supabase-js';
import {
  MajorMassMember,
  MajorMassRules,
  MajorMassAllocationResult,
} from '@/types/majorMass';
import { calculateMemberScore, isSeniorMember } from './majorMassEngine';

/**
 * Fetches active members pool and aggregates K-score data within evaluation range.
 */
export async function fetchMajorMassPoolAndScores(
  supabase: SupabaseClient | any,
  rules: MajorMassRules
): Promise<MajorMassMember[]> {
  // 1. Fetch active misdinar
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, nickname, nama_lengkap, nama_panggilan, pendidikan, lingkungan')
    .eq('status', 'Active')
    .eq('is_suspended', false)
    .in('role', ['Misdinar_Aktif', 'Misdinar_Retired']);

  if (userError) throw userError;
  if (!users || users.length === 0) return [];

  // 2. Fetch rekap_poin_mingguan within evaluation range
  const { data: rekapData, error: rekapError } = await supabase
    .from('rekap_poin_mingguan')
    .select('user_id, poin, kondisi')
    .gte('week_start', rules.evalStartDate)
    .lte('week_start', rules.evalEndDate);

  if (rekapError) throw rekapError;

  // 3. Fetch scan records for duty attendance count
  const { data: scanData, error: scanError } = await supabase
    .from('scan_records')
    .select('user_id, scan_type')
    .in('scan_type', ['tugas', 'walkin_tugas'])
    .gte('timestamp', `${rules.evalStartDate}T00:00:00`)
    .lte('timestamp', `${rules.evalEndDate}T23:59:59`);

  if (scanError) throw scanError;

  // Aggregate per user
  const pointsMap: Record<string, number> = {};
  const k6CountMap: Record<string, number> = {};
  const dutyCountMap: Record<string, number> = {};

  users.forEach((u: any) => {
    pointsMap[u.id] = 0;
    k6CountMap[u.id] = 0;
    dutyCountMap[u.id] = 0;
  });

  (rekapData || []).forEach((r: any) => {
    if (pointsMap[r.user_id] !== undefined) {
      pointsMap[r.user_id] += r.poin || 0;
      if (r.kondisi === 'K6') {
        k6CountMap[r.user_id] += 1;
      }
    }
  });

  (scanData || []).forEach((s: any) => {
    if (dutyCountMap[s.user_id] !== undefined) {
      dutyCountMap[s.user_id] += 1;
    }
  });

  return users.map((u: any): MajorMassMember => {
    const kScore = calculateMemberScore({
      rekapPoints: pointsMap[u.id] || 0,
      hadirTugasCount: dutyCountMap[u.id] || 0,
      k6Count: k6CountMap[u.id] || 0,
      k6PenaltyWeight: rules.k6PenaltyWeight,
    });

    return {
      id: u.id,
      nickname: u.nickname || u.nama_panggilan || '',
      nama_lengkap: u.nama_lengkap || '',
      nama_panggilan: u.nama_panggilan || '',
      pendidikan: u.pendidikan,
      lingkungan: u.lingkungan,
      kScore,
      totalHadirTugas: dutyCountMap[u.id] || 0,
      k6Count: k6CountMap[u.id] || 0,
      isSenior: isSeniorMember(u.pendidikan),
    };
  });
}

/**
 * Persists the allocated Major Mass series as events and assignments into Supabase.
 */
export async function persistMajorMassSeries(
  supabase: SupabaseClient | any,
  allocation: MajorMassAllocationResult,
  rules: MajorMassRules,
  isDraft: boolean = true
): Promise<string[]> {
  const createdEventIds: string[] = [];

  for (const slot of allocation.slots) {
    const { config, assigned } = slot;

    // Create event record
    const eventPayload: any = {
      nama_event: config.name.toUpperCase(),
      tipe_event: 'Misa_Khusus',
      tanggal_tugas: config.date,
      tanggal_latihan: config.rehearsalDate || null,
      perayaan: rules.seriesName,
      warna_liturgi: rules.seriesType === 'natal' ? 'Putih' : 'Putih',
      jumlah_misa: 1,
      jumlah_petugas: config.quota,
      status_event: 'Akan_Datang',
      is_draft: isDraft,
      is_misa_besar: true,
      latihan_times: config.rehearsalTime ? [config.rehearsalTime] : [],
      latihan_notes: config.rehearsalNotes || '',
      mode_latihan: 'terpisah',
    };

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert(eventPayload)
      .select('id')
      .single();

    if (eventError) throw eventError;
    if (!event) continue;

    createdEventIds.push(event.id);

    // Insert assignments for this event
    if (assigned && assigned.length > 0) {
      const assignmentPayload = assigned.map((a, idx) => ({
        event_id: event.id,
        user_id: a.member.id,
        slot_number: 1,
        position: idx + 1,
      }));

      const { error: assignError } = await supabase
        .from('assignments')
        .insert(assignmentPayload);

      if (assignError) throw assignError;
    }
  }

  return createdEventIds;
}
