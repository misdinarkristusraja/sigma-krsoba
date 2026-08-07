/**
 * Determines whether a protected route should redirect the user to /change-password.
 * Prevents infinite redirect loops when the current route is already /change-password.
 */
export function shouldRedirectToChangePassword(
  profile: { must_change_password?: boolean } | null | undefined,
  currentPathname: string
): boolean {
  if (!profile?.must_change_password) return false;
  return currentPathname !== '/change-password';
}
