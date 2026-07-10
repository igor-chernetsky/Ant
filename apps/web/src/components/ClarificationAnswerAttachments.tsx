'use client';

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { formatFileSize } from '@/lib/documents';
import {
  deleteClarificationAttachment,
  getClarificationAttachmentDownloadUrl,
  uploadClarificationAttachment,
  type ClarificationAttachment,
} from '@/lib/clarification-attachments';
import { ensureSessionFresh } from '@/lib/session';

export interface ClarificationAnswerAttachmentsHandle {
  openFilePicker: () => void;
}

interface ClarificationAnswerAttachmentsProps {
  projectId: string;
  questionId: string;
  attachments: ClarificationAttachment[];
  onChange: (attachments: ClarificationAttachment[]) => void;
  disabled?: boolean;
  hideAddButton?: boolean;
  readOnly?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

export const ClarificationAnswerAttachments = forwardRef<
  ClarificationAnswerAttachmentsHandle,
  ClarificationAnswerAttachmentsProps
>(function ClarificationAnswerAttachments(
  {
    projectId,
    questionId,
    attachments,
    onChange,
    disabled = false,
    hideAddButton = false,
    readOnly = false,
    onBusyChange,
  },
  ref,
) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setBusyState = (next: boolean) => {
    setBusy(next);
    onBusyChange?.(next);
  };

  useImperativeHandle(
    ref,
    () => ({
      openFilePicker: () => inputRef.current?.click(),
    }),
    [],
  );

  const uploaded = attachments.filter((item) => item.status === 'uploaded');

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || disabled || busy) {
      return;
    }

    setBusyState(true);
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
      setError(err instanceof Error ? err.message : t('common.uploadFailed'));
    } finally {
      setBusyState(false);
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
      setError(err instanceof Error ? err.message : t('common.downloadFailed'));
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (disabled || busy) {
      return;
    }
    setBusyState(true);
    setError(null);
    try {
      await deleteClarificationAttachment(projectId, questionId, attachmentId);
      onChange(attachments.filter((item) => item.id !== attachmentId));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('clarification.removeFileFailed'),
      );
    } finally {
      setBusyState(false);
    }
  };

  if (readOnly) {
    if (uploaded.length === 0) {
      return null;
    }

    return (
      <ul className="clarification-answer-attachments-list clarification-answer-attachments-list--readonly">
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
          </li>
        ))}
      </ul>
    );
  }

  if (hideAddButton && uploaded.length === 0 && !error) {
    return (
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => void handleFiles(e.target.files)}
      />
    );
  }

  return (
    <div className="clarification-answer-attachments">
      {!hideAddButton && (
        <div className="clarification-answer-attachments-header">
          <span className="client-clarification-answer-label">
            {t('clarification.attachmentsOptional')}
          </span>
          <button
            type="button"
            className="secondary clarification-answer-attachments-add"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? t('common.uploading') : t('common.addFiles')}
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => void handleFiles(e.target.files)}
      />

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
                  aria-label={t('clarification.removeFileAria', {
                    name: file.originalName,
                  })}
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
        !hideAddButton && (
          <p className="muted clarification-answer-attachments-empty">
            {t('clarification.attachmentsEmpty')}
          </p>
        )
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
});
