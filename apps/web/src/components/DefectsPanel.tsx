'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DocumentImage } from '@/components/DocumentImage';
import { useTranslation } from '@/components/LocaleProvider';
import {
  acceptDefect,
  acceptDefectCompletion,
  completeDefect,
  createDefect,
  declineDefect,
  deleteDefect,
  fetchProjectDefects,
  rejectDefectCompletion,
  resubmitDefect,
  uploadDefectAttachments,
  type Defect,
  type DefectEvent,
  type DefectsOverview,
  type DefectStatus,
} from '@/lib/defects';
import {
  formatFileSize,
  getDocumentDownloadUrl,
  MAX_UPLOAD_BYTES,
  type ProjectDocument,
} from '@/lib/documents';
import { formatDateTime } from '@/lib/projects';

interface DefectsPanelProps {
  projectId: string;
  projectStatus: string;
}

function latestEvent(defect: Defect, kind: DefectEvent['kind']): DefectEvent | null {
  for (let i = defect.events.length - 1; i >= 0; i -= 1) {
    if (defect.events[i]?.kind === kind) {
      return defect.events[i] ?? null;
    }
  }
  return null;
}

function statusLabelKey(
  status: DefectStatus,
): `defectsSection.status${string}` {
  switch (status) {
    case 'reported':
      return 'defectsSection.statusReported';
    case 'declined':
      return 'defectsSection.statusDeclined';
    case 'in_progress':
      return 'defectsSection.statusInProgress';
    case 'submitted':
      return 'defectsSection.statusSubmitted';
    case 'closed':
      return 'defectsSection.statusClosed';
    default:
      return 'defectsSection.statusReported';
  }
}

function eventLabelKey(
  kind: DefectEvent['kind'],
): `defectsSection.event${string}` {
  switch (kind) {
    case 'created':
      return 'defectsSection.eventCreated';
    case 'declined':
      return 'defectsSection.eventDeclined';
    case 'accepted':
      return 'defectsSection.eventAccepted';
    case 'resubmitted':
      return 'defectsSection.eventResubmitted';
    case 'completed':
      return 'defectsSection.eventCompleted';
    case 'completion_rejected':
      return 'defectsSection.eventCompletionRejected';
    case 'closed':
      return 'defectsSection.eventClosed';
    default:
      return 'defectsSection.eventCreated';
  }
}

function mergeSelectedFiles(current: File[], incoming: File[]): File[] {
  const next = [...current];
  for (const file of incoming) {
    if (file.size > MAX_UPLOAD_BYTES) continue;
    if (
      next.some(
        (item) =>
          item.name === file.name &&
          item.size === file.size &&
          item.lastModified === file.lastModified,
      )
    ) {
      continue;
    }
    next.push(file);
  }
  return next;
}

function DefectFilePicker({
  files,
  disabled,
  label,
  onChange,
}: {
  files: File[];
  disabled?: boolean;
  label: string;
  onChange: (files: File[]) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const takeFiles = (list: FileList | File[] | null) => {
    if (!list || disabled) return;
    onChange(mergeSelectedFiles(files, Array.from(list)));
  };

  return (
    <div className="defect-file-picker">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        disabled={disabled}
        onChange={(event) => {
          takeFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        className={`defect-file-drop${dragOver ? ' is-dragover' : ''}`}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          takeFiles(event.dataTransfer.files);
        }}
      >
        <span className="defect-file-drop-icon" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.44 11.05l-8.49 8.49a5.25 5.25 0 0 1-7.43-7.43l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a1.75 1.75 0 0 1-2.47-2.47l8.13-8.13" />
          </svg>
        </span>
        <span className="defect-file-drop-copy">
          <strong>{label}</strong>
          <span className="muted">{t('defectsSection.attachmentsHint')}</span>
        </span>
      </button>
      {files.length > 0 && (
        <ul className="defect-file-chips">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="defect-file-chip"
            >
              <span className="defect-file-chip-name" title={file.name}>
                {file.name}
              </span>
              <span className="muted defect-file-chip-size">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                className="defect-file-chip-remove"
                disabled={disabled}
                aria-label={t('defectsSection.removeFileAria', {
                  name: file.name,
                })}
                onClick={() =>
                  onChange(files.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function toProjectDocument(
  attachment: DefectEvent['attachments'][number],
): ProjectDocument {
  return {
    id: attachment.id,
    projectId: attachment.projectId,
    originalName: attachment.originalName,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    category: attachment.category as ProjectDocument['category'],
    status: attachment.status,
    createdAt: attachment.createdAt,
    uploadedAt: attachment.uploadedAt,
    hasThumbnail: attachment.hasThumbnail,
  };
}

export function DefectsPanel({ projectId, projectStatus }: DefectsPanelProps) {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<DefectsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newDescription, setNewDescription] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [actionDraft, setActionDraft] = useState<Record<string, string>>({});
  const [actionFiles, setActionFiles] = useState<Record<string, File[]>>({});

  const isDesign = overview?.isDesignProject ?? false;
  const isClient = overview?.role === 'client';
  const isContractor = overview?.role === 'contractor';

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjectDefects(projectId);
      setOverview(data);
    } catch (err: unknown) {
      setOverview(null);
      setError(
        err instanceof Error ? err.message : t('defectsSection.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    if (projectStatus !== 'active') return;
    void reload();
  }, [projectStatus, reload]);

  const hint = useMemo(
    () =>
      isDesign ? t('defectsSection.hintDesign') : t('defectsSection.hint'),
    [isDesign, t],
  );

  if (projectStatus !== 'active') {
    return null;
  }

  const handleReport = async () => {
    const description = newDescription.trim();
    if (!description) return;
    setBusy(true);
    setError(null);
    try {
      const defect = await createDefect(projectId, description);
      const createdEvent = latestEvent(defect, 'created');
      if (createdEvent && newFiles.length > 0) {
        await uploadDefectAttachments(
          projectId,
          defect.id,
          createdEvent.id,
          newFiles,
        );
      }
      setNewDescription('');
      setNewFiles([]);
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('defectsSection.reportFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (defect: Defect) => {
    if (
      !window.confirm(
        t('defectsSection.deleteConfirm', {
          n: String(defect.sequenceNumber),
        }),
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteDefect(projectId, defect.id);
      if (expandedId === defect.id) setExpandedId(null);
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('defectsSection.deleteFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (
    defectId: string,
    action: () => Promise<Defect>,
    options?: {
      eventKind?: DefectEvent['kind'];
      files?: File[];
      fallbackKey?: string;
    },
  ) => {
    setBusy(true);
    setError(null);
    try {
      const defect = await action();
      const event =
        (options?.eventKind
          ? latestEvent(defect, options.eventKind)
          : defect.events[defect.events.length - 1]) ?? null;
      const files = options?.files ?? [];
      if (event && files.length > 0) {
        await uploadDefectAttachments(
          projectId,
          defect.id,
          event.id,
          files,
        );
      }
      setActionDraft((prev) => ({ ...prev, [defectId]: '' }));
      setActionFiles((prev) => ({ ...prev, [defectId]: [] }));
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t(options?.fallbackKey ?? 'defectsSection.actionFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const downloadAttachment = async (attachmentId: string) => {
    try {
      const { downloadUrl } = await getDocumentDownloadUrl(
        projectId,
        attachmentId,
      );
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setError(t('defectsSection.downloadFailed'));
    }
  };

  return (
    <section className="card" id="defects-panel">
      <h2 className="section-title">{t('defectsSection.title')}</h2>
      <p className="muted">{hint}</p>

      {loading && <p className="muted">{t('common.loading')}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {isClient && (
        <div className="defect-compose">
          <label className="field-label" htmlFor="defect-description">
            {t('defectsSection.reportLabel')}
          </label>
          <textarea
            id="defect-description"
            className="textarea"
            rows={3}
            value={newDescription}
            disabled={busy}
            placeholder={t('defectsSection.reportPlaceholder')}
            onChange={(event) => setNewDescription(event.target.value)}
          />
          <DefectFilePicker
            files={newFiles}
            disabled={busy}
            label={t('defectsSection.attachmentsOptional')}
            onChange={setNewFiles}
          />
          <button
            type="button"
            className="primary"
            disabled={busy || !newDescription.trim()}
            onClick={() => void handleReport()}
          >
            {busy ? t('common.pleaseWait') : t('defectsSection.reportButton')}
          </button>
        </div>
      )}

      {!loading && (overview?.defects.length ?? 0) === 0 && (
        <p className="muted">{t('defectsSection.empty')}</p>
      )}

      <ul className="defect-list">
        {(overview?.defects ?? []).map((defect) => {
          const expanded = expandedId === defect.id;
          const draft = actionDraft[defect.id] ?? '';
          const files = actionFiles[defect.id] ?? [];

          return (
            <li key={defect.id} className="defect-item">
              <div className="defect-item-header">
                <div>
                  <strong>
                    {t('defectsSection.defectNumber', {
                      n: String(defect.sequenceNumber),
                    })}
                  </strong>
                  <span className={`status-chip status-${defect.status}`}>
                    {t(statusLabelKey(defect.status))}
                  </span>
                </div>
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    setExpandedId(expanded ? null : defect.id)
                  }
                >
                  {expanded
                    ? t('defectsSection.hideHistory')
                    : t('defectsSection.showHistory')}
                </button>
              </div>
              <p className="defect-description">{defect.description}</p>

              {isClient && defect.status === 'reported' && (
                <div className="defect-actions">
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={() => void handleDelete(defect)}
                  >
                    {t('defectsSection.delete')}
                  </button>
                </div>
              )}

              {isContractor && defect.status === 'reported' && (
                <div className="defect-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void runAction(defect.id, () =>
                        acceptDefect(projectId, defect.id),
                      )
                    }
                  >
                    {t('defectsSection.accept')}
                  </button>
                  <textarea
                    className="textarea"
                    rows={2}
                    value={draft}
                    disabled={busy}
                    placeholder={t('defectsSection.declineReasonPlaceholder')}
                    onChange={(event) =>
                      setActionDraft((prev) => ({
                        ...prev,
                        [defect.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || !draft.trim()}
                    onClick={() =>
                      void runAction(
                        defect.id,
                        () => declineDefect(projectId, defect.id, draft.trim()),
                        { fallbackKey: 'defectsSection.declineFailed' },
                      )
                    }
                  >
                    {t('defectsSection.decline')}
                  </button>
                </div>
              )}

              {isContractor && defect.status === 'declined' && (
                <div className="defect-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void runAction(defect.id, () =>
                        acceptDefect(projectId, defect.id),
                      )
                    }
                  >
                    {t('defectsSection.accept')}
                  </button>
                </div>
              )}

              {isClient && defect.status === 'declined' && (
                <div className="defect-actions">
                  <textarea
                    className="textarea"
                    rows={2}
                    value={draft}
                    disabled={busy}
                    placeholder={t('defectsSection.resubmitCommentPlaceholder')}
                    onChange={(event) =>
                      setActionDraft((prev) => ({
                        ...prev,
                        [defect.id]: event.target.value,
                      }))
                    }
                  />
                  <DefectFilePicker
                    files={files}
                    disabled={busy}
                    label={t('defectsSection.attachmentsOptional')}
                    onChange={(next) =>
                      setActionFiles((prev) => ({ ...prev, [defect.id]: next }))
                    }
                  />
                  <button
                    type="button"
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        defect.id,
                        () =>
                          resubmitDefect(
                            projectId,
                            defect.id,
                            draft.trim() || undefined,
                          ),
                        {
                          eventKind: 'resubmitted',
                          files,
                          fallbackKey: 'defectsSection.resubmitFailed',
                        },
                      )
                    }
                  >
                    {t('defectsSection.resubmit')}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={() => void handleDelete(defect)}
                  >
                    {t('defectsSection.delete')}
                  </button>
                </div>
              )}

              {isContractor && defect.status === 'in_progress' && (
                <div className="defect-actions">
                  <textarea
                    className="textarea"
                    rows={2}
                    value={draft}
                    disabled={busy}
                    placeholder={t('defectsSection.completeCommentPlaceholder')}
                    onChange={(event) =>
                      setActionDraft((prev) => ({
                        ...prev,
                        [defect.id]: event.target.value,
                      }))
                    }
                  />
                  <DefectFilePicker
                    files={files}
                    disabled={busy}
                    label={t('defectsSection.fixPhotosOptional')}
                    onChange={(next) =>
                      setActionFiles((prev) => ({ ...prev, [defect.id]: next }))
                    }
                  />
                  <button
                    type="button"
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        defect.id,
                        () =>
                          completeDefect(
                            projectId,
                            defect.id,
                            draft.trim() || undefined,
                          ),
                        {
                          eventKind: 'completed',
                          files,
                          fallbackKey: 'defectsSection.completeFailed',
                        },
                      )
                    }
                  >
                    {t('defectsSection.markDone')}
                  </button>
                </div>
              )}

              {isClient && defect.status === 'submitted' && (
                <div className="defect-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void runAction(defect.id, () =>
                        acceptDefectCompletion(projectId, defect.id),
                      )
                    }
                  >
                    {t('defectsSection.acceptFix')}
                  </button>
                  <textarea
                    className="textarea"
                    rows={2}
                    value={draft}
                    disabled={busy}
                    placeholder={t('defectsSection.rejectReasonPlaceholder')}
                    onChange={(event) =>
                      setActionDraft((prev) => ({
                        ...prev,
                        [defect.id]: event.target.value,
                      }))
                    }
                  />
                  <DefectFilePicker
                    files={files}
                    disabled={busy}
                    label={t('defectsSection.attachmentsOptional')}
                    onChange={(next) =>
                      setActionFiles((prev) => ({ ...prev, [defect.id]: next }))
                    }
                  />
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || !draft.trim()}
                    onClick={() =>
                      void runAction(
                        defect.id,
                        () =>
                          rejectDefectCompletion(
                            projectId,
                            defect.id,
                            draft.trim(),
                          ),
                        {
                          eventKind: 'completion_rejected',
                          files,
                          fallbackKey: 'defectsSection.rejectFailed',
                        },
                      )
                    }
                  >
                    {t('defectsSection.rejectFix')}
                  </button>
                </div>
              )}

              {expanded && (
                <ol className="defect-timeline">
                  {defect.events.map((event) => (
                    <li key={event.id} className="defect-timeline-item">
                      <div className="defect-timeline-meta">
                        <strong>{t(eventLabelKey(event.kind))}</strong>
                        <span className="muted">
                          {event.actorDisplayName ?? t('common.dash')} ·{' '}
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                      {event.comment && (
                        <p className="defect-timeline-comment">{event.comment}</p>
                      )}
                      {event.attachments.length > 0 && (
                        <div className="defect-attachments">
                          {event.attachments.map((attachment) => {
                            const doc = toProjectDocument(attachment);
                            const isImage =
                              attachment.contentType.startsWith('image/');
                            return isImage ? (
                              <DocumentImage
                                key={attachment.id}
                                projectId={projectId}
                                document={doc}
                                variant="thumb"
                              />
                            ) : (
                              <button
                                key={attachment.id}
                                type="button"
                                className="link-button"
                                onClick={() =>
                                  void downloadAttachment(attachment.id)
                                }
                              >
                                {attachment.originalName}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
