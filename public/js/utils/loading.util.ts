const overlayId = 'loading-overlay';
const progressId = 'loading-progress';
const progressBarId = 'loading-progress-bar';

export function showLoading(message = 'Working...', progress?: number) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';
  overlay.style.pointerEvents = 'auto';
  setLoadingText(message, progress);
}

export function hideLoading() {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.style.display = 'none';
  overlay.style.pointerEvents = 'none';
  setLoadingText(''); // clear text as well
}

export function setLoadingText(message?: string, progress?: number) {
  const progressEl = document.getElementById(progressId);
  const progressBar = document.getElementById(progressBarId) as HTMLElement | null;
  const parts: string[] = [];

  if (typeof progress === 'number') {
    const pct = Math.max(0, Math.min(100, Math.round(progress)));
    parts.push(`Progress: ${pct}%`);
    if (progressBar) progressBar.style.width = `${pct}%`;
  }
  if (message) parts.push(message);

  if (progressEl) {
    progressEl.textContent = parts.join(' • ') || 'Working...';
  }
}
