/**
 * Helpers for downloading / previewing blobs after an async fetch.
 *
 * Opening a new tab via `<a target="_blank">` or `window.open(blobUrl)` after
 * `await fetch(...)` is often blocked on the first click. Open a blank tab
 * synchronously (still inside the user gesture), then navigate it when ready.
 */

/** Call before the first `await` in a click-triggered download. */
export function openPendingPreviewWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  const win = window.open('about:blank', '_blank');
  if (!win) return null;
  try {
    win.document.write(
      '<!doctype html><html><head><meta charset="utf-8" /><title>Loading…</title></head><body style="font-family:system-ui,sans-serif;padding:2rem;color:#334">Loading…</body></html>',
    );
    win.document.close();
  } catch {
    // Cross-origin or restricted document — still usable via location.href.
  }
  return win;
}

function isPdfBlob(blob: Blob, fileName: string): boolean {
  return (
    blob.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Deliver a fetched blob: navigate a pending preview tab for PDFs, otherwise
 * trigger a file download. Closes the pending tab when the result is not a PDF.
 */
export function deliverFetchedBlob(
  blob: Blob,
  fileName: string,
  previewWindow?: Window | null,
): void {
  const url = URL.createObjectURL(blob);
  const pdf = isPdfBlob(blob, fileName);

  if (pdf && previewWindow && !previewWindow.closed) {
    try {
      previewWindow.location.href = url;
      previewWindow.focus();
    } catch {
      previewWindow.close();
      triggerAnchorDownload(url, fileName);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  if (previewWindow && !previewWindow.closed) {
    previewWindow.close();
  }

  // Zip/docx, or PDF with popup blocked — always download (not blocked after await).
  triggerAnchorDownload(url, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function triggerAnchorDownload(url: string, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
