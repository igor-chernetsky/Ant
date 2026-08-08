import { PassThrough } from 'stream';
import { ZipArchive } from 'archiver';

export type CustomFileFormat = 'pdf' | 'docx';

export interface DualCustomFileFields {
  customFileStorageKey: string | null;
  customFileOriginalName: string | null;
  customFileContentType: string | null;
  customFileSizeBytes: number | null;
  customFileUploadedAt: Date | null;
  sourceDocxStorageKey: string | null;
  sourceDocxOriginalName: string | null;
  sourceDocxSizeBytes: number | null;
}

export interface DualCustomFileMeta {
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  uploadedAt: string;
  hasPdf: boolean;
  hasDocx: boolean;
  pdfOriginalName: string | null;
  docxOriginalName: string | null;
}

function isPdfMeta(contentType: string | null, name: string | null): boolean {
  const ct = (contentType ?? '').toLowerCase();
  const n = (name ?? '').toLowerCase();
  return ct.includes('pdf') || n.endsWith('.pdf');
}

function isDocxMeta(contentType: string | null, name: string | null): boolean {
  const ct = (contentType ?? '').toLowerCase();
  const n = (name ?? '').toLowerCase();
  return (
    ct.includes('wordprocessingml') ||
    ct.includes('msword') ||
    n.endsWith('.docx') ||
    n.endsWith('.doc')
  );
}

export function mapDualCustomFileMeta(
  row: DualCustomFileFields,
): DualCustomFileMeta | null {
  if (!row.customFileStorageKey && !row.sourceDocxStorageKey) {
    return null;
  }
  if (!row.customFileUploadedAt && !row.sourceDocxStorageKey) {
    return null;
  }

  const customIsPdf = isPdfMeta(
    row.customFileContentType,
    row.customFileOriginalName,
  );
  const customIsDocx = isDocxMeta(
    row.customFileContentType,
    row.customFileOriginalName,
  );
  const hasSourceDocx = Boolean(row.sourceDocxStorageKey);
  const hasPdf = Boolean(row.customFileStorageKey) && (customIsPdf || !customIsDocx);
  const hasDocx = hasSourceDocx || (Boolean(row.customFileStorageKey) && customIsDocx);

  const pdfOriginalName = hasPdf
    ? row.customFileOriginalName
    : null;
  const docxOriginalName = hasSourceDocx
    ? row.sourceDocxOriginalName
    : customIsDocx
      ? row.customFileOriginalName
      : null;

  const displayName =
    docxOriginalName ||
    pdfOriginalName ||
    row.customFileOriginalName ||
    'contract';

  const previewContentType =
    hasPdf
      ? row.customFileContentType || 'application/pdf'
      : row.customFileContentType ||
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const uploadedAt =
    row.customFileUploadedAt?.toISOString() ?? new Date().toISOString();

  return {
    originalName: displayName,
    contentType: previewContentType,
    sizeBytes: row.customFileSizeBytes ?? row.sourceDocxSizeBytes,
    uploadedAt,
    hasPdf,
    hasDocx,
    pdfOriginalName,
    docxOriginalName,
  };
}

export function normalizeDownloadFormats(
  raw: unknown,
): CustomFileFormat[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,\s]+/)
      : [];
  const formats = [
    ...new Set(
      list
        .map((item) => String(item).trim().toLowerCase())
        .filter((item): item is CustomFileFormat =>
          item === 'pdf' || item === 'docx',
        ),
    ),
  ];
  return formats;
}

export async function buildZipBuffer(
  entries: Array<{ name: string; buffer: Buffer }>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    archive.on('error', reject);
    archive.pipe(stream);

    for (const entry of entries) {
      archive.append(entry.buffer, { name: entry.name });
    }

    void archive.finalize();
  });
}
