# Smart Override & Walk-In Scan System Design

**Date**: 2026-07-31  
**Target Module**: [ScanPage.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/pages/ScanPage.tsx), [utils.ts](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/lib/utils.ts)

---

## 1. Goal Description
Enhance the SIGMA attendance scanning engine ([ScanPage.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/pages/ScanPage.tsx)) with an automated **Smart 2-Mode Override & Walk-In Modal**. When a misdinar QR code is scanned or username is entered manually, but the member is NOT assigned to the current event slot, the officer can record the attendance in 1-tap using two clear modes:
1. **Substitusi Mendadak (On-Site Swap)**: Links the substitute to a specific missing assigned member, updating status to K1/K3b.
2. **Tugas Tambahan Sukarela (Walk-In Volunteer)**: Records standalone voluntary duty without replacing anyone.

---

## 2. User Flow & Interface

### Step 1: Scan / Manual Input Detection
* Officer scans member QR code or types nickname.
* System queries `assignments` for the target `event_id` and `user_id`.
* If **no assignment found**, the system opens the **Smart Override Modal**.

### Step 2: Smart Override Modal Modes

#### Mode A: 🔄 Substitusi Mendadak (Tukar di Tempat)
* System automatically fetches assigned members for the current event whose attendance has NOT been scanned yet (`scanned = false`).
* Renders a quick 1-tap list of missing assigned members:
  > Example: `[Tap] Flavia (Slot 1 - Utama)` | `[Tap] Eugene (Slot 2 - Utama)`
* Officer taps the name of the missing member.
* **Database Action**: Inserts `scan_records` with:
  * `scan_type`: `'walkin_tugas'`
  * `is_walk_in`: `true`
  * `walkin_reason`: `'Substitusi Mendadak: Menggantikan ' + missingMember.nama_panggilan`
  * `replaced_user_id`: `missingMember.id`
  * `anomaly_reason`: `'Override Scanner: ' + profile.nama_panggilan`

#### Mode B: ➕ Tugas Tambahan Sukarela (Walk-In)
* Officer taps "Bantu Tugas Tambahan Sukarela".
* **Database Action**: Inserts `scan_records` with:
  * `scan_type`: `'walkin_tugas'`
  * `is_walk_in`: `true`
  * `walkin_reason`: `'Tugas Tambahan Sukarela (Walk-In)'`

---

## 3. Data Schema & Status K Classification

### Migration 038 Schema Update
```sql
ALTER TABLE scan_records
  ADD COLUMN IF NOT EXISTS replaced_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
```

### Classification Rules (`hitungPoin` in [utils.ts](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/lib/utils.ts))
* **`K1` (Substitusi Ideal)**: `isSwapPengganti` or `(isWalkIn && replaced_user_id)` AND `isHadirLatihan === true`.
* **`K3b` (Substitusi Mendadak / Walk-in)**: `(isWalkIn && replaced_user_id)` OR `isWalkIn` AND `isHadirLatihan === false`.

---

## 4. Verification Plan

### Automated Unit Tests
* `src/lib/__tests__/override.test.ts`: Test K-category status calculation for Substitusi Mendadak vs Walk-In Sukarela.

### Manual Verification
* Perform manual override on ScanPage for both Mode A (Substitusi) and Mode B (Walk-in).
* Verify audit entries appear cleanly in `scan_records`.
