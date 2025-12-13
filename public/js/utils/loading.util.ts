const overlayId = 'loading-overlay';
const progressId = 'loading-progress';
const progressBarId = 'loading-progress-bar';
const titleId = 'loading-title';
const subtitleId = 'loading-subtitle';

export interface LoadingOptions {
  message?: string;
  progress?: number;
  title?: string;
  subtitle?: string;
}

export function showLoading(message = 'Working...', progress?: number, options?: LoadingOptions) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';
  overlay.style.pointerEvents = 'auto';

  // Set title/subtitle if provided
  if (options?.title) {
    setLoadingTitle(options.title, options.subtitle);
  }

  setLoadingText(message, progress);
}

export function hideLoading() {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.style.display = 'none';
  overlay.style.pointerEvents = 'none';
  setLoadingText(''); // clear text as well
  // Reset to defaults
  setLoadingTitle('Crafting Flashcards', 'AI is analyzing your topic to build the perfect study deck...');
}

export function setLoadingTitle(title: string, subtitle?: string) {
  const titleEl = document.getElementById(titleId);
  const subtitleEl = document.getElementById(subtitleId);

  if (titleEl && title) {
    titleEl.textContent = title;
  }
  if (subtitleEl && subtitle) {
    subtitleEl.textContent = subtitle;
  }
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
