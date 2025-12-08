import fs from 'fs';
import path from 'path';

type PropMap = Record<string, string>;

function parseProperties(content: string): PropMap {
  const map: PropMap = {};
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) map[key] = value;
  });
  return map;
}

function loadProperties(): PropMap {
  try {
    const filePath = path.resolve(process.cwd(), 'config', 'app.properties');
    const data = fs.readFileSync(filePath, 'utf8');
    return parseProperties(data);
  } catch {
    return {};
  }
}

const props = loadProperties();

export const appProperties = {
  MAX_UPLOAD_MB: Number(props.MAX_UPLOAD_MB ?? 30),
  TEST_MAX_UPLOAD_MB: Number(props.TEST_MAX_UPLOAD_MB ?? 40),
  JOB_POLL_MAX_MS: Number(props.JOB_POLL_MAX_MS ?? 60000),
  JOB_BACKEND_MAX_MS: Number(props.JOB_BACKEND_MAX_MS ?? 90000),
  XLS_MAX_ROWS_PER_SHEET: Number(props.XLS_MAX_ROWS_PER_SHEET ?? 200),
  MAX_EXTRACT_TEXT_CHARS: Number(props.MAX_EXTRACT_TEXT_CHARS ?? 20000),
};

