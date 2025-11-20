// CSV-only utilities: no external types required here

export const SEP = ';';

export const escapeCsvValue = (v: unknown, sep = SEP) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(sep)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
};

export const buildCsv = (rows: Array<Array<unknown>>, header?: string[]) => {
  const all: Array<Array<unknown>> = header ? [header, ...rows] : rows;
  const lines = all.map(r => r.map((c) => escapeCsvValue(c)).join(SEP));
  return '\uFEFF' + lines.join('\r\n');
};

export async function saveCsv(csv: string, suggestedName: string) {
  // Try File System Access API first
  try {
    if (typeof (window as any).showSaveFilePicker === 'function') {
      const opts = {
        suggestedName: suggestedName,
        types: [
          { description: 'CSV', accept: { 'text/csv': ['.csv'] } },
        ],
      } as any;

      const handle = await (window as any).showSaveFilePicker(opts);
      const writable = await handle.createWritable();
      await writable.write(csv);
      await writable.close();
      return { filename: handle.name ?? suggestedName, cancelled: false };
    }
  } catch (err) {
    // Detect user cancellation: AbortError
    try {
      const name = (err as any)?.name ?? (err as any)?.code;
      if (name === 'AbortError') return { filename: '', cancelled: true };
    } catch (e) {
      // ignore
    }
    // otherwise, fall through to fallback download
    // eslint-disable-next-line no-console
    console.warn('showSaveFilePicker failed, falling back to download:', err);
  }

  // Fallback: blob + anchor download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  return { filename: suggestedName, cancelled: false };
}
export const safeFilename = (name: string) => name.replace(/[^a-zA-Z0-9_.-]/g, '_');
