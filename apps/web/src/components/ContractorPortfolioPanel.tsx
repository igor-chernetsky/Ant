'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deletePortfolioItem,
  fetchPortfolioItems,
  syncPendingPortfolioItems,
  updatePortfolioItem,
  uploadPortfolioPhoto,
  type PortfolioItem,
} from '@/lib/portfolio';
import {
  markFilePickerOpening,
  releaseFilePickerGuard,
} from '@/lib/file-picker-guard';

function CaptionIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function mergePortfolioItems(
  current: PortfolioItem[],
  incoming: PortfolioItem[],
): PortfolioItem[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return [...byId.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt),
  );
}

export function ContractorPortfolioPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [savingCaptionId, setSavingCaptionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchPortfolioItems();
      const synced = await syncPendingPortfolioItems(data);
      setItems(
        synced
          .filter((item) => item.status === 'uploaded' || item.status === 'pending')
          .sort(
            (a, b) =>
              a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt),
          ),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const processSelectedFiles = useCallback(
    async (fileList: FileList | null, input?: HTMLInputElement | null) => {
      if (!fileList?.length) {
        releaseFilePickerGuard();
        return;
      }

      const files = Array.from(fileList);
      if (input) {
        input.value = '';
      }

      setBusy(true);
      setError(null);
      const uploaded: PortfolioItem[] = [];

      try {
        for (const file of files) {
          const item = await uploadPortfolioPhoto(file);
          uploaded.push(item);
        }
        setItems((prev) => mergePortfolioItems(prev, uploaded));
        void loadItems({ silent: true });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        if (uploaded.length > 0) {
          setItems((prev) => mergePortfolioItems(prev, uploaded));
        }
      } finally {
        setBusy(false);
        releaseFilePickerGuard();
      }
    },
    [loadItems],
  );

  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) {
      return;
    }

    const onNativeChange = () => {
      void processSelectedFiles(input.files, input);
    };

    input.addEventListener('change', onNativeChange);
    return () => input.removeEventListener('change', onNativeChange);
  }, [processSelectedFiles]);

  const handleDelete = async (item: PortfolioItem) => {
    const confirmed = window.confirm('Remove this photo from your portfolio?');
    if (!confirmed) return;

    setDeletingId(item.id);
    setError(null);
    if (editingId === item.id) {
      setEditingId(null);
      setCaptionDraft('');
    }
    try {
      await deletePortfolioItem(item.id);
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete photo');
    } finally {
      setDeletingId(null);
    }
  };

  const openCaptionEditor = (item: PortfolioItem) => {
    setEditingId(item.id);
    setCaptionDraft(item.title ?? '');
  };

  const closeCaptionEditor = () => {
    setEditingId(null);
    setCaptionDraft('');
  };

  const handleSaveCaption = async (item: PortfolioItem) => {
    const next = captionDraft.trim();
    if (next === (item.title ?? '').trim()) {
      closeCaptionEditor();
      return;
    }

    setSavingCaptionId(item.id);
    setError(null);
    try {
      const updated = await updatePortfolioItem(item.id, { title: next });
      setItems((prev) =>
        prev.map((entry) => (entry.id === item.id ? updated : entry)),
      );
      closeCaptionEditor();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save caption');
    } finally {
      setSavingCaptionId(null);
    }
  };

  const visibleItems = items.filter((item) => item.status === 'uploaded');

  return (
    <section className="card contractor-portfolio-card">
      <div className="contractor-portfolio-header">
        <h2 className="section-title">Portfolio</h2>
        <label
          className={`contractor-portfolio-upload-label secondary${busy ? ' contractor-portfolio-upload-label--busy' : ''}`}
        >
          <span>{busy ? 'Uploading…' : 'Upload image'}</span>
          <input
            ref={fileInputRef}
            type="file"
            className="contractor-portfolio-file-input"
            multiple
            accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
            disabled={busy}
            onPointerDown={() => markFilePickerOpening()}
            onChange={(event) =>
              void processSelectedFiles(event.currentTarget.files, event.currentTarget)
            }
          />
        </label>
      </div>

      {refreshing && !loading && (
        <p className="muted contractor-portfolio-refresh-hint">Refreshing…</p>
      )}

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="muted">Loading portfolio…</p>
      ) : visibleItems.length === 0 ? (
        <p className="muted contractor-portfolio-empty">
          {busy
            ? 'Uploading photo…'
            : 'No photos yet. Upload images of your completed work.'}
        </p>
      ) : (
        <ul className="contractor-portfolio-grid contractor-portfolio-grid--owner">
          {visibleItems.map((item) => {
            const isEditing = editingId === item.id;
            const hasCaption = Boolean(item.title?.trim());

            return (
              <li key={item.id} className="contractor-portfolio-tile">
                <div className="contractor-portfolio-tile-media">
                  <a
                    href={item.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="contractor-portfolio-thumb-link"
                  >
                    {item.thumbnailUrl || item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl ?? item.imageUrl}
                        alt={item.title?.trim() || 'Portfolio photo'}
                        className="contractor-portfolio-thumb"
                        loading="lazy"
                      />
                    ) : (
                      <div className="contractor-portfolio-thumb contractor-portfolio-thumb--placeholder">
                        No preview
                      </div>
                    )}
                  </a>
                  <div className="contractor-portfolio-tile-actions">
                    <button
                      type="button"
                      className={`contractor-portfolio-icon-btn${hasCaption ? ' contractor-portfolio-icon-btn--active' : ''}`}
                      title={hasCaption ? 'Edit caption' : 'Add caption'}
                      aria-label={hasCaption ? 'Edit caption' : 'Add caption'}
                      onClick={() => openCaptionEditor(item)}
                    >
                      <CaptionIcon />
                    </button>
                    <button
                      type="button"
                      className="contractor-portfolio-icon-btn contractor-portfolio-icon-btn--danger"
                      title="Remove photo"
                      aria-label="Remove photo"
                      disabled={deletingId === item.id}
                      onClick={() => void handleDelete(item)}
                    >
                      <RemoveIcon />
                    </button>
                  </div>
                  {hasCaption && !isEditing && (
                    <p className="contractor-portfolio-tile-caption">
                      {item.title}
                    </p>
                  )}
                </div>

                {isEditing && (
                  <div className="contractor-portfolio-caption-editor">
                    <input
                      value={captionDraft}
                      onChange={(e) => setCaptionDraft(e.target.value)}
                      placeholder="Work description (optional)"
                      disabled={savingCaptionId === item.id}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleSaveCaption(item);
                        }
                        if (e.key === 'Escape') {
                          closeCaptionEditor();
                        }
                      }}
                    />
                    <div className="contractor-portfolio-caption-editor-actions">
                      <button
                        type="button"
                        className="primary"
                        disabled={savingCaptionId === item.id}
                        onClick={() => void handleSaveCaption(item)}
                      >
                        {savingCaptionId === item.id ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={savingCaptionId === item.id}
                        onClick={closeCaptionEditor}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
