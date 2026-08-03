export type UserRole = 'Administrator' | 'Pengurus' | 'Pendamping' | 'Pelatih' | 'Misdinar_Aktif' | 'Misdinar_Retired';
export type UserStatus = 'Active' | 'Pending' | 'Retired' | 'Suspended';
export type EventType = 'Mingguan' | 'Jumper' | 'Sabtu_Imam' | 'Misa_Khusus' | 'Misa_Harian' | 'Latihan';
export type SwapStatus = 'Pending' | 'Approved_PIC' | 'Rejected_PIC' | 'Replaced' | 'Offered' | 'Expired';
export type EventStatus = 'Akan_Datang' | 'Berlangsung' | 'Sudah_Lewat';
export type ScanType = 'tugas' | 'latihan' | 'walkin_tugas' | 'walkin_latihan';
export type OptinStatus = 'Bisa' | 'Tidak_Bisa' | 'Pas_Libur';

export interface Profile {
  id: string;
  nickname: string;
  myid: string;
  nama_lengkap: string;
  nama_panggilan: string;
  tanggal_lahir?: string;
  pendidikan?: 'SD' | 'SMP' | 'SMA' | 'SMK' | 'Lulus';
  sekolah?: string;
  is_tarakanita: boolean;
  wilayah?: string;
  lingkungan: string;
  email: string;
  hp_anak?: string;
  hp_ortu?: string;
  nama_ayah?: string;
  nama_ibu?: string;
  alamat?: string;
  alasan_masuk?: string;
  sampai_kapan?: string;
  role: UserRole;
  status: UserStatus;
  divisi?: string;
  status_jadwal?: string;
  is_suspended: boolean;
  suspended_until?: string;
  surat_pernyataan_url?: string;
  foto_url?: string;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  nama_event: string;
  tipe_event: EventType;
  tanggal_tugas: string;
  tanggal_latihan?: string;
  hari?: string;
  perayaan?: string;
  warna_liturgi?: 'Hijau' | 'Merah' | 'Putih' | 'Ungu' | 'MerahMuda' | 'Hitam';
  jumlah_misa: number;
  status_event: EventStatus;
  event_pics?: Array<{ id?: string; slot: number; nama: string; hp?: string | null; urutan: number }>;
  event_pelatih?: Array<{ id?: string; nama: string; urutan: number }>;
  pic_harian?: string;
  gcatholic_fetched: boolean;
  is_draft: boolean;
  published_at?: string;
  published_by?: string;
  draft_note?: string;
  is_misa_besar: boolean;
  latihan_times?: string[];
  latihan_notes?: string;
  mode_latihan: 'terpisah' | 'gabung';
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  event_id: string;
  user_id: string;
  slot_number?: number;
  position?: number;
  created_at: string;
  user?: Profile; // Joined data
  event?: Event;  // Joined data
}

export interface SwapRequest {
  id: string;
  requester_id: string;
  assignment_id: string;
  alasan: string;
  pic_user_id?: string;
  pic_wa_link?: string;
  status: SwapStatus;
  pengganti_id?: string;
  pic_approved_at?: string;
  expires_at: string;
  is_penawaran: boolean;
  created_at: string;
  requester?: Profile;    // Joined data
  pengganti?: Profile;    // Joined data
  assignment?: Assignment; // Joined data
}

export interface ScanRecord {
  id: string;
  user_id: string;
  event_id?: string;
  scanner_user_id: string;
  scan_type: ScanType;
  is_walk_in: boolean;
  walkin_reason?: string;
  timestamp: string;
  qr_version: 'legacy' | 'new';
  raw_qr_value?: string;
  is_anomaly: boolean;
  anomaly_reason?: string;
  latihan_id?: string;
  replaced_user_id?: string;
  user?: Profile; // Joined data
  scanner?: Profile; // Joined data
  event?: Event; // Joined data
}

export interface Database {
  public: {
    Tables: {
      users: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      events: { Row: Event; Insert: Partial<Event>; Update: Partial<Event> };
      assignments: { Row: Assignment; Insert: Partial<Assignment>; Update: Partial<Assignment> };
      swap_requests: { Row: SwapRequest; Insert: Partial<SwapRequest>; Update: Partial<SwapRequest> };
      scan_records: { Row: ScanRecord; Insert: Partial<ScanRecord>; Update: Partial<ScanRecord> };
      // and others...
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_profile: {
        Args: Record<PropertyKey, never>
        Returns: Profile
      }
      get_email_by_nickname: {
        Args: { p_nickname: string }
        Returns: string
      }
      hitung_poin_kondisi: {
        Args: { p_dijadwalkan: boolean; p_hadir_tugas: boolean; p_hadir_latihan: boolean; p_walk_in: boolean }
        Returns: { poin: number; kondisi: string }
      }
    }
    Enums: {
      user_role: UserRole;
      user_status: UserStatus;
      event_type: EventType;
      event_status: EventStatus;
      scan_type_enum: ScanType;
      swap_status: SwapStatus;
      optin_status: OptinStatus;
      qr_version: 'legacy' | 'new';
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
