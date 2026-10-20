/** Accepts only internal absolute paths, so a crafted `returnUrl` cannot redirect off-site. */
export function safeReturnUrl(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }
  if (value.startsWith('/sign-in') || value.startsWith('/access-denied')) return fallback;
  return value;
}
