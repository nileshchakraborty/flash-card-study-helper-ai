const extensionMimeMap: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

const supportedMimes = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
]);

export function normalizeMimeType(mimeType: string, filename: string): string {
  const lowerMime = (mimeType || '').toLowerCase();
  if (lowerMime && lowerMime !== 'application/octet-stream') return lowerMime;

  const lowerName = (filename || '').toLowerCase();
  const ext = Object.keys(extensionMimeMap).find(e => lowerName.endsWith(e));
  const mapped = ext ? extensionMimeMap[ext] : undefined;
  return mapped || lowerMime || 'application/octet-stream';
}

export function isSupportedFileType(mimeType: string, filename: string): boolean {
  const resolved = normalizeMimeType(mimeType, filename);
  return supportedMimes.has(resolved) || resolved.startsWith('image/');
}

export function ensureSupportedFileType(mimeType: string, filename: string): string {
  const resolved = normalizeMimeType(mimeType, filename);
  if (isSupportedFileType(resolved, filename)) {
    return resolved;
  }
  throw new Error('Unsupported file type');
}
