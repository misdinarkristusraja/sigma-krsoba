export async function approveRegistrationAction(
  reg: { id: string; nickname: string; tanggal_lahir?: string }
): Promise<any> {
  return { ok: false, error: 'NOT_IMPLEMENTED', message: 'TBD' };
}
