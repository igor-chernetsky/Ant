'use client';

import { useRef, useState } from 'react';
import { formatFileSize } from '@/lib/documents';
import {
  deleteClarificationAttachment,
  getClarificationAttachmentDownloadUrl,
  uploadClarificationAttachment,
  type ClarificationAttachment,
} from '@/lib/clarification-attachments';
import { ensureSessionFresh } from '@/lib/session';

interface ClarificationAnswerAttachmentsProps {
  projectId: string;
  questionId: string;
  attachments: ClarificationAttachment[];
  onChange: (attachments: ClarificationAttachment[]) => void;
  disabled?: boolean;
}

export function ClarificationAnswerAttachments({
  projectId,
  questionId,
  attachments,
  onChange,
  disabled = false,
}: ClarificationAnswerAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploaded = attachments.filter((item) => item.status === 'uploaded');

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || disabled || busy) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await ensureSessionFresh();
      const next = [...attachments];
      for (const file of Array.from(files)) {
        const item = await uploadClarificationAttachment(
          projectId,
          questionId,
          file,
        );
        next.push(item);
      }
      onChange(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (attachmentId: string) => {
    setError(null);
    try {
      const { downloadUrl } = await getClarificationAttachmentDownloadUrl(
        projectId,
        questionId,
        attachmentId,
      );
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (disabled || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteClarificationAttachment(projectId, questionId, attachmentId);
      onChange(attachments.filter((item) => item.id !== attachmentId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove file');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="clarification-answer-attachments">
      <div className="clarification-answer-attachments-header">
        <span className="client-clarification-answer-label">
          Attachments (optional)
        </span>
        <button
          type="button"
          className="secondary clarification-answer-attachments-add"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Uploading…' : 'Add files'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
          className="sr-only"
          disabled={disabled || busy}
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {uploaded.length > 0 ? (
        <ul className="clarification-answer-attachments-list">
          {uploaded.map((file) => (
            <li key={file.id} className="clarification-answer-attachments-item">
              <button
                type="button"
                className="text-link clarification-answer-attachments-name"
                onClick={() => void handleDownload(file.id)}
              >
                {file.originalName}
              </button>
              <span className="muted clarification-answer-attachments-meta">
                {formatFileSize(file.sizeBytes)}
              </span>
              {!disabled && (
                <button
                  type="button"
                  className="icon-button clarification-answer-attachments-remove"
                  aria-label={`Remove ${file.originalName}`}
                  disabled={busy}
                  onClick={() => void handleDelete(file.id)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted clarification-answer-attachments-empty">
          Photos, PDFs, or documents linked to this answer.
        </p>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
