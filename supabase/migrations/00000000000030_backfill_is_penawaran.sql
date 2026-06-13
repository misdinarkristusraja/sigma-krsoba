-- ================================================================
-- SIGMA — Backfill is_penawaran untuk legacy Offered rows
--
-- Root cause: baris swap_requests yang dicatat manual SEBELUM fix
-- is_penawaran (commit app 3021ee7) punya status='Offered' tapi
-- is_penawaran=FALSE. Akibatnya:
--   • Tampil di tabel admin "Semua Request" (label "Di Papan Penawaran",
--     karena badge dihitung dari status saja), TAPI
--   • TIDAK muncul di kartu Papan Penawaran, karena loadBoard memfilter
--     `.eq('is_penawaran', true)` (sesuai RLS swap_select_board).
--
-- Gejala yang dilaporkan: "Catat Manual Offered, no error, tak muncul di
-- papan" untuk anggota seperti Teora & Inara — padahal event belum lewat
-- dan requester bukan admin sendiri. Murni data legacy tersangkut.
--
-- Fix: samakan flag. Setiap status='Offered' secara semantik = aktif
-- ditawarkan ke papan, jadi is_penawaran HARUS true. Baris yang event-nya
-- sudah lewat tetap disembunyikan filter tanggal di loadBoard (aman).
-- ================================================================

UPDATE swap_requests
SET    is_penawaran = TRUE
WHERE  status = 'Offered'
  AND  is_penawaran IS DISTINCT FROM TRUE;
