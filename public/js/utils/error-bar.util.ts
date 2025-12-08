let autoHideTimer: number | null = null;
const BAR_ID = 'error-bar';
const MSG_ID = 'error-bar-message';
const CLOSE_ID = 'error-bar-close';

export function initErrorBar() {
  const closeBtn = document.getElementById(CLOSE_ID);
  if (closeBtn) {
    closeBtn.addEventListener('click', () => hideErrorBar());
  }
}

export function showErrorBar(message: string) {
  const bar = document.getElementById(BAR_ID);
  const msg = document.getElementById(MSG_ID);
  if (!bar || !msg) return;

  // Replace previous message
  msg.textContent = message;
  bar.classList.remove('hidden', 'opacity-0', 'translate-y-10');
  bar.classList.add('opacity-100', 'translate-y-0');

  // Reset timer
  if (autoHideTimer) window.clearTimeout(autoHideTimer);
  autoHideTimer = window.setTimeout(() => hideErrorBar(), 60_000);
}

export function hideErrorBar() {
  const bar = document.getElementById(BAR_ID);
  if (!bar) return;
  bar.classList.add('opacity-0', 'translate-y-10');
  setTimeout(() => bar.classList.add('hidden'), 200);
  if (autoHideTimer) {
    window.clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}
