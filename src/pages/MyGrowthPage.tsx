import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getServiceTier, calculateRadarMetrics, RadarMetric, ServiceTier } from '../lib/growth';
import {
  Shield, Award, Star, Crown, CheckCircle, Calendar, MessageSquare,
  Award as BadgeIcon, Clock, Sparkles, TrendingUp
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip
} from 'recharts';

interface UserBadge {
  id: string;
  badge_key: string;
  title: string;
  description: string;
  icon_name: string;
  earned_at: string;
}

interface UserEvaluation {
  id: string;
  periode: string;
  skor_sikap: number;
  skor_kerapian: number;
  catatan_pribadi: string;
  created_at: string;
  evaluator?: { nama_panggilan: string; role: string };
}

const DEFAULT_BADGES = [
  { key: 'penjaga_fajar', title: 'Penjaga Fajar', description: 'Bertugas pada Misa Pagi (06.00) minimal 5 kali.', icon: 'Clock' },
  { key: 'sahabat_latihan', title: 'Sahabat Latihan', description: 'Kehadiran latihan sempurna 100% dalam 1 bulan.', icon: 'CheckCircle' },
  { key: 'teladan_siap_sedia', title: 'Teladan Siap Sedia', description: 'Membantu klaim penawaran swap dari teman yang berhalangan.', icon: 'Award' },
  { key: 'spesialis_pekan_suci', title: 'Pahlawan Pekan Suci', description: 'Bertugas dalam Perayaan Pekan Suci / Hari Raya Besar.', icon: 'Crown' }
];

export default function MyGrowthPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<ServiceTier>(getServiceTier(0));
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [radarData, setRadarData] = useState<RadarMetric[]>([]);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [evaluations, setEvaluations] = useState<UserEvaluation[]>([]);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // 1. Fetch completed assignments count
      const { count: completedCount } = await supabase
        .from('assignments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id);

      const count = completedCount || 0;
      setTotalCompleted(count);
      setTier(getServiceTier(count));

      // 2. Fetch scan records for attendance metrics
      const { data: scanRecs } = await supabase
        .from('scan_records')
        .select('scan_type, event_id, latihan_id')
        .eq('user_id', profile.id);

      const scanList = (scanRecs || []) as any[];
      const scannedAssignments = scanList.filter(s => s.scan_type === 'tugas' || s.scan_type === 'walkin_tugas').length;
      const scannedTrainings = scanList.filter(s => s.scan_type === 'latihan' || s.scan_type === 'walkin_latihan').length;

      // 3. Fetch unique event types served
      const { data: eventsData } = await supabase
        .from('assignments')
        .select('events(tipe_event)')
        .eq('user_id', profile.id);

      const eventTypesSet = new Set((eventsData || []).map((a: any) => a.events?.tipe_event).filter(Boolean));

      // 4. Fetch claimed swaps count
      const { count: claimedCount } = await supabase
        .from('swap_requests')
        .select('*', { count: 'exact', head: true })
        .eq('pengganti_id', profile.id)
        .eq('status', 'Replaced');

      // 5. Fetch evaluations
      const { data: evalsData } = await supabase
        .from('user_evaluations')
        .select('*, evaluator:evaluator_id(nama_panggilan, role)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      setEvaluations(evalsData || []);

      const evalsList = (evalsData || []) as any[];
      const attitudeAvg = evalsList.length > 0
        ? evalsList.reduce((acc, curr) => acc + ((curr.skor_sikap + curr.skor_kerapian) / 2), 0) / evalsList.length
        : 4.5; // default starting benchmark score

      // Calculate Radar metrics
      const metrics = calculateRadarMetrics({
        totalAssignments: Math.max(count, scannedAssignments),
        scannedAssignments,
        totalTrainings: 10, // benchmark standard trainings
        scannedTrainings,
        uniqueEventTypes: eventTypesSet.size,
        claimedSwapsCount: claimedCount || 0,
        attitudeScoreAvg: attitudeAvg
      });

      setRadarData(metrics);

      // 6. Fetch earned badges
      const { data: badgeData } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', profile.id);

      setBadges(badgeData || []);
    } catch (err) {
      console.error('Error loading growth data:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const TierIcon = tier.level === 4 ? Crown : tier.level === 3 ? Star : tier.level === 2 ? Award : Shield;

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
        Memuat data perkembangan...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Tier Card */}
      <div className="card bg-gradient-to-r from-red-800 to-red-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
          <TierIcon size={180} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
              <TierIcon size={40} className="text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-red-200 text-xs font-semibold uppercase tracking-wider">
                <Sparkles size={14} className="text-amber-300" /> Tingkat Pelayanan
              </div>
              <h1 className="text-2xl font-bold text-white">{tier.name}</h1>
              <p className="text-sm text-red-100 mt-0.5">
                Total Penugasan Terperiksa: <strong>{totalCompleted} Tugas</strong>
              </p>
            </div>
          </div>

          {/* Progress bar to next tier */}
          <div className="w-full md:w-64 bg-white/10 p-3 rounded-xl border border-white/15 backdrop-blur-sm">
            <div className="flex justify-between text-xs text-red-100 font-medium mb-1">
              <span>Kemajuan Milestone</span>
              <span>{totalCompleted} / {tier.level === 1 ? 16 : tier.level === 2 ? 41 : tier.level === 3 ? 80 : 100}</span>
            </div>
            <div className="w-full bg-red-950/60 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-300 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (totalCompleted / (tier.level === 1 ? 16 : tier.level === 2 ? 41 : tier.level === 3 ? 80 : 100)) * 100)}%`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grid Content: Radar Chart & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Radar Chart Card */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={20} className="text-red-700 dark:text-red-400" />
              <h2 className="font-bold text-gray-900 dark:text-white text-base">Radar Kualitas Personal</h2>
            </div>
            <span className="text-xs text-gray-400 dark:text-slate-400">5 Dimensi Performance</span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="#475569" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Radar
                  name="Skor Kualitas"
                  dataKey="score"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.4}
                />
                <Tooltip formatter={(value: any) => [`${value}%`, 'Skor']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Badges Collection Card */}
        <div className="card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BadgeIcon size={20} className="text-amber-500 dark:text-amber-400" />
              <h2 className="font-bold text-gray-900 dark:text-white text-base">Lencana Achievement</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {DEFAULT_BADGES.map(b => {
                const isEarned = badges.some(ub => ub.badge_key === b.key);
                return (
                  <div
                    key={b.key}
                    className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all ${
                      isEarned
                        ? 'bg-amber-50/80 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200'
                        : 'bg-gray-50 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-300 opacity-90'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-1.5 rounded-lg ${isEarned ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300' : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-300'}`}>
                        {b.key === 'penjaga_fajar' ? <Clock size={16} /> :
                         b.key === 'sahabat_latihan' ? <CheckCircle size={16} /> :
                         b.key === 'spesialis_pekan_suci' ? <Crown size={16} /> : <Award size={16} />}
                      </div>
                      {isEarned && <span className="text-[10px] font-semibold bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-100 px-1.5 py-0.5 rounded">Raih</span>}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-gray-900 dark:text-slate-100">{b.title}</p>
                      <p className="text-[11px] text-gray-600 dark:text-slate-300 leading-tight mt-0.5">{b.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Catatan Pembinaan Privat dari Pendamping */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={20} className="text-red-700 dark:text-red-400" />
          <h2 className="font-bold text-gray-900 dark:text-white text-base">Catatan Evaluasi & Pembinaan</h2>
        </div>

        {evaluations.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Belum ada catatan evaluasi dari Pendamping/Pengurus.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {evaluations.map(e => (
              <div key={e.id} className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                  <span className="font-semibold text-gray-900 dark:text-slate-100">Periode: {e.periode}</span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> {new Date(e.created_at).toLocaleDateString('id-ID')}
                  </span>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 px-2 py-0.5 rounded font-medium">
                    Sikap: {e.skor_sikap}/5 ⭐
                  </span>
                  <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 px-2 py-0.5 rounded font-medium">
                    Kerapian: {e.skor_kerapian}/5 ⭐
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-slate-200 italic bg-white dark:bg-slate-900 p-3 rounded-lg border border-gray-100 dark:border-slate-800">
                  "{e.catatan_pribadi}"
                </p>
                <p className="text-[11px] text-gray-400 dark:text-slate-400 text-right">
                  Oleh: {e.evaluator?.nama_panggilan || 'Pendamping'} ({e.evaluator?.role || 'Pengurus'})
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
