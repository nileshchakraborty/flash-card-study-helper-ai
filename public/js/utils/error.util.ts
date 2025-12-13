export function isAuthError(error: unknown): boolean {
  const message = (error as any)?.message || '';
  return typeof message === 'string' && message.toLowerCase().includes('unauthorized');
}

export function redirectToLoginWithAlert(message = 'Your session expired. Please log in again.') {
  alert(message);
  window.location.href = '/api/auth/google';
}

export function alertError(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const msg =
    (error as any)?.message ||
    (typeof error === 'string' ? error : null) ||
    fallback;
  alert(msg);
}
