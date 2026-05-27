-- Migration 014: Tambah DELETE policy untuk tabel reregistrations
-- Fix: Admin tidak bisa reset/batalkan daftar ulang karena tidak ada DELETE policy.

CREATE POLICY rereg_admin_delete ON reregistrations FOR DELETE
  USING (get_current_user_role() = 'Administrator');
