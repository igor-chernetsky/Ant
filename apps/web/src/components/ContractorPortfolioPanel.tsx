'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  deletePortfolioItem,
  fetchPortfolioItems,
  updatePortfolioItem,
  uploadPortfolioPhoto,
  type PortfolioItem,
} from '@/lib/portfolio';

export function ContractorPortfolioPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPortfolioItems();
      setItems(data.filter((item) => item.status === 'uploaded'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const workTitle = title.trim();
    if (!workTitle) {
      setError('Enter a work title before uploading a photo.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await uploadPortfolioPhoto(file, {
        title: workTitle,
        description: description.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      await loadItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item: PortfolioItem) => {
    const confirmed = window.confirm(`Remove "${item.title}" from your portfolio?`);
    if (!confirmed) return;

    setDeletingId(item.id);
    setError(null);
    try {
      await deletePortfolioItem(item.id);
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTitleBlur = async (item: PortfolioItem, nextTitle: string) => {
    const trimmed = nextTitle.trim();
    if (!trimmed || trimmed === item.title) return;

    try {
      const updated = await updatePortfolioItem(item.id, { title: trimmed });
      setItems((prev) =>
        prev.map((entry) => (entry.id === item.id ? updated : entry)),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update title');
    }
  };

  return (
    <section className="card contractor-portfolio-card">
      <h2 className="section-title">Portfolio</h2>
      <p className="muted doc-hint">
        Showcase completed work with photos. Thumbnails are generated automatically
        for faster loading.
      </p>

      <div className="contractor-portfolio-form modal-form">
        <label>
          Work title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Kitchen renovation, Bang Tao"
            disabled={busy}
          />
        </label>
        <label>
          Description <span className="muted">(optional)</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Scope, materials, timeline…"
            disabled={busy}
          />
        </label>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp"
          onChange={(e) => void handleFileChange(e)}
          disabled={busy}
        />
        <button
          type="button"
          className="primary"
          disabled={busy || !title.trim()}
          onClick={() => fileInputRef.current?.click()}
        >
          {busy ? 'Uploading…' : 'Add photo'}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="muted">Loading portfolio…</p>
      ) : items.length === 0 ? (
        <p className="muted">No portfolio items yet.</p>
      ) : (
        <ul className="contractor-portfolio-grid">
          {items.map((item) => (
            <li key={item.id} className="contractor-portfolio-item">
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
                    alt={item.title}
                    className="contractor-portfolio-thumb"
                    loading="lazy"
                  />
                ) : (
                  <div className="contractor-portfolio-thumb contractor-portfolio-thumb--placeholder">
                    No preview
                  </div>
                )}
              </a>
              <div className="contractor-portfolio-item-body">
                <input
                  className="contractor-portfolio-title-input"
                  defaultValue={item.title}
                  onBlur={(e) => void handleTitleBlur(item, e.target.value)}
                />
                {item.description && (
                  <p className="muted contractor-portfolio-description">
                    {item.description}
                  </p>
                )}
                <button
                  type="button"
                  className="text-link contractor-portfolio-remove"
                  disabled={deletingId === item.id}
                  onClick={() => void handleDelete(item)}
                >
                  {deletingId === item.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
