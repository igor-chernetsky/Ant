'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { BusyLabel } from '@/components/AntSpinner';
import { CustomFileFormatPicker } from '@/components/CustomFileFormatPicker';
import {
  ContractSignaturePad,
  type ContractSignaturePadHandle,
} from '@/components/ContractSignaturePad';
import { useTranslation } from '@/components/LocaleProvider';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import {
  addendumCustomFilePreviewPath,
  createAddendumFromFile,
  createAddendumFromText,
  deleteAddendumAttachment,
  deleteContractAddendum,
  downloadAddendumAttachment,
  downloadContractAddendum,
  listContractAddenda,
  regenerateAddendumDocument,
  signContractAddendum,
  updateAddendumDocument,
  uploadAddendumAttachment,
  uploadAddendumCustomFile,
  type ContractAddendum,
} from '@/lib/addenda';
import {
  customFileCanPreviewPdf,
  customFileHasBothFormats,
  type CustomFileDownloadFormat,
} from '@/lib/contracts';
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/i18n';
import { formatDateTime } from '@/lib/projects';

interface ContractAddendaPanelProps {
  projectId: string;
  asContractor?: boolean;
  /** Only show when the main contract is fully signed. */
  enabled: boolean;
}

type CreateMode = 'text' | 'file';

function statusLabel(
  addendum: ContractAddendum,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  if (addendum.fullySigned) return t('addenda.statusFullySigned');
  if (addendum.contractorSignedAt && !addendum.clientSignedAt) {
    return t('addenda.statusAwaitingClient');
  }
  return t('addenda.statusAwaitingContractor');
}

function AddendumEditor({
  projectId,
  addendum,
  asContractor,
  onSaved,
}: {
  projectId: string;
  addendum: ContractAddendum;
  asContractor: boolean;
  onSaved: (row: ContractAddendum) => void;
}) {
  const { t } = useTranslation();
  const readOnly = !addendum.canEditDocument || addendum.fullySigned;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [regenLocale, setRegenLocale] = useState<Locale>(
    addendum.bodyLocale ?? 'en',
  );

  useEffect(() => {
    setRegenLocale(addendum.bodyLocale ?? 'en');
  }, [addendum.bodyLocale, addendum.id]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: true,
          autolink: false,
          HTMLAttributes: {
            rel: 'noopener noreferrer',
            target: '_blank',
          },
        },
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: { class: 'contract-editor-table' },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: addendum.englishBodyHtml || '<p></p>',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: () => {
      setDirty(true);
      setSaved(false);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = addendum.englishBodyHtml || '<p></p>';
    if (editor.getHTML() !== next && !dirty) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    editor.setEditable(!readOnly);
  }, [addendum.englishBodyHtml, addendum.id, dirty, editor, readOnly]);

  const handleSave = async () => {
    if (!editor || readOnly) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateAddendumDocument(
        projectId,
        addendum.id,
        editor.getHTML(),
        { asContractor },
      );
      setDirty(false);
      setSaved(true);
      onSaved(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('addenda.saveFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    if (readOnly || !addendum.sourceDescription) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await regenerateAddendumDocument(
        projectId,
        addendum.id,
        { asContractor, locale: regenLocale },
      );
      setDirty(false);
      onSaved(updated);
      if (editor) {
        editor.commands.setContent(updated.englishBodyHtml || '<p></p>', {
          emitUpdate: false,
        });
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('addenda.regenerateFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="addendum-document-block">
      <p className="muted contract-document-editor-hint">
        {readOnly
          ? t('addenda.editorReadOnlyHint')
          : t('addenda.editorHint')}
      </p>
      <div
        className={`contract-document-editor${
          readOnly ? ' contract-document-editor--readonly' : ''
        }`}
      >
        <EditorContent editor={editor} />
      </div>
      {!readOnly && (
        <div className="contract-document-actions">
          <button
            type="button"
            className="primary"
            disabled={busy || !dirty}
            onClick={() => void handleSave()}
          >
            {busy ? t('common.saving') : t('addenda.saveDocument')}
          </button>
          {addendum.sourceDescription && (
            <>
              <label className="field addendum-regen-locale">
                <span className="muted">{t('addenda.documentLanguage')}</span>
                <select
                  value={regenLocale}
                  disabled={busy}
                  onChange={(e) => setRegenLocale(e.target.value as Locale)}
                >
                  {SUPPORTED_LOCALES.map((code) => (
                    <option key={code} value={code}>
                      {LOCALE_LABELS[code]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void handleRegenerate()}
              >
                {t('addenda.regenerateDocument')}
              </button>
            </>
          )}
          {saved && <p className="muted">{t('addenda.documentSaved')}</p>}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function AddendumItem({
  projectId,
  addendum,
  asContractor,
  onUpdated,
  onDeleted,
}: {
  projectId: string;
  addendum: ContractAddendum;
  asContractor: boolean;
  onUpdated: (row: ContractAddendum) => void;
  onDeleted: (addendumId: string) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withAttachments, setWithAttachments] = useState(true);
  const [downloadFormats, setDownloadFormats] = useState<
    CustomFileDownloadFormat[]
  >(['pdf', 'docx']);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const signaturePadRef = useRef<ContractSignaturePadHandle | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const file = addendum.customFile;
  const uploadedAttachments = (addendum.attachments ?? []).filter(
    (item) => item.status === 'uploaded',
  );
  const canPreviewPdf = customFileCanPreviewPdf(file);
  const bothFormats = customFileHasBothFormats(file);
  const previewSrc = addendumCustomFilePreviewPath(
    projectId,
    addendum.id,
    asContractor,
  );

  const handleSign = async () => {
    const confirmed = await confirm({
      title: t('addenda.confirmSignTitle'),
      message: t('addenda.confirmSignMessage'),
      confirmLabel: t('addenda.confirmSignLabel'),
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const signatureDataUrl = signaturePadRef.current?.toDataURL() ?? null;
      const updated = await signContractAddendum(projectId, addendum.id, {
        asContractor,
        signatureDataUrl,
      });
      signaturePadRef.current?.clear();
      onUpdated(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('addenda.signFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected || !addendum.canReplaceFile) return;

    if (addendum.clientSignedAt || addendum.contractorSignedAt) {
      const confirmed = await confirm({
        title: t('addenda.confirmReplaceFileTitle'),
        message: t('addenda.confirmReplaceFileMessage'),
        confirmLabel: t('addenda.confirmReplaceFileLabel'),
      });
      if (!confirmed) return;
    }

    setBusy(true);
    setError(null);
    try {
      const updated = await uploadAddendumCustomFile(
        projectId,
        addendum.id,
        selected,
        { asContractor },
      );
      onUpdated(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('addenda.uploadFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadContractAddendum(projectId, addendum.id, {
        asContractor,
        withAttachments: withAttachments && uploadedAttachments.length > 0,
        formats: bothFormats ? downloadFormats : undefined,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('addenda.downloadFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleAttachmentSelected = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected || !addendum.canManageAttachments) return;
    setBusy(true);
    setError(null);
    try {
      const attachment = await uploadAddendumAttachment(
        projectId,
        addendum.id,
        selected,
        { asContractor },
      );
      onUpdated({
        ...addendum,
        attachments: [...(addendum.attachments ?? []), attachment],
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('addenda.attachmentUploadFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    setBusy(true);
    setError(null);
    try {
      await deleteAddendumAttachment(projectId, addendum.id, attachmentId, {
        asContractor,
      });
      onUpdated({
        ...addendum,
        attachments: (addendum.attachments ?? []).filter(
          (item) => item.id !== attachmentId,
        ),
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('addenda.attachmentDeleteFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAddendum = async () => {
    if (!addendum.canDelete) return;
    const confirmed = await confirm({
      title: t('addenda.confirmDeleteTitle'),
      message: t('addenda.confirmDeleteMessage', { title: addendum.title }),
      confirmLabel: t('addenda.confirmDeleteLabel'),
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await deleteContractAddendum(projectId, addendum.id, { asContractor });
      onDeleted(addendum.id);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('addenda.deleteFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="contract-secondary-details addendum-item" open>
      <summary className="contract-secondary-details-summary addendum-item-summary">
        <span className="addendum-item-title">{addendum.title}</span>
        <span className="addendum-item-status">{statusLabel(addendum, t)}</span>
      </summary>
      <div className="contract-secondary-details-body addendum-item-body">
        <div className="addendum-meta">
          <p className="muted addendum-signing-order">
            {t('addenda.signingOrderHint')}
          </p>
          <div className="addendum-parties" aria-label={t('addenda.title')}>
            <div
              className={`addendum-party${
                addendum.contractorSignedAt ? ' addendum-party--signed' : ''
              }`}
            >
              <span className="addendum-party-role">
                {t('contractPanel.partyContractor')}
              </span>
              <span className="muted">
                {addendum.contractorSignedAt
                  ? t('contractPanel.signedAt', {
                      date: formatDateTime(addendum.contractorSignedAt),
                    })
                  : t('contractPanel.awaiting')}
              </span>
            </div>
            <div
              className={`addendum-party${
                addendum.clientSignedAt ? ' addendum-party--signed' : ''
              }`}
            >
              <span className="addendum-party-role">
                {t('contractPanel.partyClient')}
              </span>
              <span className="muted">
                {addendum.clientSignedAt
                  ? t('contractPanel.signedAt', {
                      date: formatDateTime(addendum.clientSignedAt),
                    })
                  : t('contractPanel.awaiting')}
              </span>
            </div>
          </div>
        </div>

        {addendum.hasCustomFile && file ? (
          <div className="addendum-custom-preview">
            <p className="muted addendum-custom-file-name">
              {t('addenda.customFileLabel', { name: file.originalName })}
            </p>
            {canPreviewPdf ? (
              <div className="contract-custom-preview-frame-wrap">
                <iframe
                  className="contract-custom-preview-frame"
                  title={t('addenda.previewFrameTitle')}
                  src={previewSrc}
                />
              </div>
            ) : (
              <p className="muted">{t('addenda.previewLegacyDocx')}</p>
            )}
          </div>
        ) : (
          <AddendumEditor
            projectId={projectId}
            addendum={addendum}
            asContractor={asContractor}
            onSaved={onUpdated}
          />
        )}

        <section className="addendum-attachments" aria-label={t('addenda.attachmentsTitle')}>
          <div className="addendum-attachments-header">
            <div>
              <h4 className="addendum-attachments-title">
                {t('addenda.attachmentsTitle')}
              </h4>
              <p className="muted addendum-attachments-hint">
                {t('addenda.attachmentsHint')}
              </p>
            </div>
            {addendum.canManageAttachments && (
              <>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                  hidden
                  onChange={(e) => void handleAttachmentSelected(e)}
                />
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => attachmentInputRef.current?.click()}
                >
                  {t('addenda.addAttachment')}
                </button>
              </>
            )}
          </div>
          {uploadedAttachments.length === 0 ? (
            <p className="muted addendum-attachments-empty">
              {t('addenda.attachmentsEmpty')}
            </p>
          ) : (
            <ul className="addendum-attachments-list">
              {uploadedAttachments.map((item) => (
                <li key={item.id} className="addendum-attachments-item">
                  <button
                    type="button"
                    className="text-link addendum-attachments-name"
                    disabled={busy}
                    onClick={() =>
                      void downloadAddendumAttachment(
                        projectId,
                        addendum.id,
                        item.id,
                        { asContractor },
                      ).catch((err: unknown) =>
                        setError(
                          err instanceof Error
                            ? err.message
                            : t('addenda.downloadFailed'),
                        ),
                      )
                    }
                  >
                    {item.originalName}
                  </button>
                  {addendum.canManageAttachments && (
                    <button
                      type="button"
                      className="text-link addendum-attachments-remove"
                      disabled={busy}
                      onClick={() => void handleDeleteAttachment(item.id)}
                    >
                      {t('addenda.removeAttachment')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div
          className={`addendum-tools${
            addendum.canSign ? ' addendum-tools--with-pad' : ''
          }`}
        >
          {addendum.canSign && (
            <ContractSignaturePad padRef={signaturePadRef} disabled={busy} />
          )}

          <div className="addendum-actions-card">
            <h4 className="addendum-actions-card-title">
              {t('addenda.actionsTitle')}
            </h4>

            {uploadedAttachments.length > 0 && (
              <label className="addendum-include-attachments">
                <input
                  type="checkbox"
                  checked={withAttachments}
                  disabled={busy}
                  onChange={(e) => setWithAttachments(e.target.checked)}
                />
                <span>
                  {t('addenda.includeAttachments', {
                    count: String(uploadedAttachments.length),
                  })}
                </span>
              </label>
            )}

            <CustomFileFormatPicker
              hasPdf={Boolean(file?.hasPdf)}
              hasDocx={Boolean(file?.hasDocx)}
              formats={downloadFormats}
              onChange={setDownloadFormats}
              disabled={busy}
            />

            <div className="addendum-actions">
              <button
                type="button"
                className={addendum.canSign ? 'primary' : 'secondary'}
                disabled={
                  busy ||
                  (!addendum.canSign &&
                    bothFormats &&
                    downloadFormats.length === 0)
                }
                onClick={() =>
                  addendum.canSign
                    ? void handleSign()
                    : void handleDownload()
                }
              >
                <BusyLabel
                  busy={busy}
                  idle={
                    addendum.canSign
                      ? t('addenda.sign')
                      : t('addenda.downloadPackage')
                  }
                  busyText={
                    addendum.canSign
                      ? t('addenda.signing')
                      : t('addenda.downloading')
                  }
                />
              </button>

              {addendum.canSign && (
                <button
                  type="button"
                  className="secondary"
                  disabled={
                    busy || (bothFormats && downloadFormats.length === 0)
                  }
                  onClick={() => void handleDownload()}
                >
                  <BusyLabel
                    busy={busy}
                    idle={t('addenda.downloadPackage')}
                    busyText={t('addenda.downloading')}
                  />
                </button>
              )}

              {addendum.canReplaceFile && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    hidden
                    onChange={(e) => void handleFileSelected(e)}
                  />
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {addendum.hasCustomFile
                      ? t('addenda.replaceFile')
                      : t('addenda.uploadFile')}
                  </button>
                </>
              )}

              {addendum.canDelete && (
                <button
                  type="button"
                  className="secondary addendum-actions-delete"
                  disabled={busy}
                  onClick={() => void handleDeleteAddendum()}
                >
                  {t('addenda.delete')}
                </button>
              )}
            </div>

            {addendum.fullySigned && (
              <p className="muted addendum-fully-signed-note">
                {t('addenda.fullySignedNote')}
              </p>
            )}
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        {confirmDialog}
      </div>
    </details>
  );
}

export function ContractAddendaPanel({
  projectId,
  asContractor = false,
  enabled,
}: ContractAddendaPanelProps) {
  const { t, locale } = useTranslation();
  const [items, setItems] = useState<ContractAddendum[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>('text');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [createLocale, setCreateLocale] = useState<Locale>(locale);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFileName, setCreateFileName] = useState<string | null>(null);
  const createFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCreateLocale(locale);
  }, [locale]);

  const load = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listContractAddenda(projectId, { asContractor });
      setItems(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('addenda.loadFailed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, projectId, asContractor, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreated = (row: ContractAddendum) => {
    setItems((prev) => [row, ...prev.filter((x) => x.id !== row.id)]);
    setCreateOpen(false);
    setTitle('');
    setDescription('');
    setCreateMode('text');
    setCreateFileName(null);
    if (createFileRef.current) {
      createFileRef.current.value = '';
    }
  };

  const handleCreateSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    setCreateBusy(true);
    try {
      if (createMode === 'text') {
        const row = await createAddendumFromText(
          projectId,
          {
            description: description.trim(),
            title: title.trim() || undefined,
            locale: createLocale,
          },
          { asContractor },
        );
        handleCreated(row);
      } else {
        const file = createFileRef.current?.files?.[0];
        if (!file) {
          setCreateError(t('addenda.fileRequired'));
          return;
        }
        const row = await createAddendumFromFile(projectId, file, {
          asContractor,
          title: title.trim() || undefined,
        });
        handleCreated(row);
      }
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error ? err.message : t('addenda.createFailed'),
      );
    } finally {
      setCreateBusy(false);
    }
  };

  if (!enabled) {
    return null;
  }

  return (
    <section className="tender-subsection addenda-panel">
      <div className="addenda-panel-header">
        <h3 className="tender-subsection-title">{t('addenda.title')}</h3>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setCreateError(null);
            setCreateOpen(true);
          }}
        >
          {t('addenda.create')}
        </button>
      </div>
      <p className="muted">{t('addenda.hint')}</p>

      {loading ? (
        <p className="muted">{t('addenda.loading')}</p>
      ) : items.length === 0 ? (
        <p className="muted">{t('addenda.empty')}</p>
      ) : (
        <div className="addenda-list">
          {items.map((item) => (
            <AddendumItem
              key={item.id}
              projectId={projectId}
              addendum={item}
              asContractor={asContractor}
              onUpdated={(updated) => {
                setItems((prev) =>
                  prev.map((row) => (row.id === updated.id ? updated : row)),
                );
              }}
              onDeleted={(addendumId) => {
                setItems((prev) => prev.filter((row) => row.id !== addendumId));
              }}
            />
          ))}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      {createOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !createBusy) {
              setCreateOpen(false);
            }
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-addendum-title"
          >
            <div className="modal-header">
              <h2 id="create-addendum-title">{t('addenda.createTitle')}</h2>
              <button
                type="button"
                className="icon-button"
                disabled={createBusy}
                onClick={() => setCreateOpen(false)}
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
            <form className="modal-form" onSubmit={(e) => void handleCreateSubmit(e)}>
              <p className="muted modal-subtitle">{t('addenda.createHint')}</p>

              <div className="clarification-mode-field">
                <span className="clarification-mode-label">
                  {t('addenda.createModeLabel')}
                </span>
                <div
                  className="clarification-mode-switch"
                  role="radiogroup"
                  aria-label={t('addenda.createModeLabel')}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={createMode === 'text'}
                    className={`clarification-mode-switch-btn${
                      createMode === 'text'
                        ? ' clarification-mode-switch-btn--active'
                        : ''
                    }`}
                    disabled={createBusy}
                    onClick={() => setCreateMode('text')}
                  >
                    {t('addenda.modeText')}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={createMode === 'file'}
                    className={`clarification-mode-switch-btn${
                      createMode === 'file'
                        ? ' clarification-mode-switch-btn--active'
                        : ''
                    }`}
                    disabled={createBusy}
                    onClick={() => setCreateMode('file')}
                  >
                    {t('addenda.modeFile')}
                  </button>
                </div>
              </div>

              <label className="field">
                <span>{t('addenda.titleOptional')}</span>
                <input
                  type="text"
                  value={title}
                  disabled={createBusy}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
              </label>

              {createMode === 'text' ? (
                <>
                  <label className="field">
                    <span>{t('addenda.documentLanguage')}</span>
                    <select
                      value={createLocale}
                      disabled={createBusy}
                      onChange={(e) =>
                        setCreateLocale(e.target.value as Locale)
                      }
                    >
                      {SUPPORTED_LOCALES.map((code) => (
                        <option key={code} value={code}>
                          {LOCALE_LABELS[code]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t('addenda.description')}</span>
                    <textarea
                      value={description}
                      disabled={createBusy}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={6}
                      required
                      minLength={10}
                    />
                  </label>
                </>
              ) : (
                <div className="field addenda-create-file-field">
                  <span>{t('addenda.file')}</span>
                  <div className="addenda-create-file-row">
                    <input
                      ref={createFileRef}
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      disabled={createBusy}
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setCreateFileName(file?.name ?? null);
                        setCreateError(null);
                      }}
                    />
                    <button
                      type="button"
                      className="secondary"
                      disabled={createBusy}
                      onClick={() => createFileRef.current?.click()}
                    >
                      {t('addenda.chooseFile')}
                    </button>
                    <span className="muted addenda-create-file-name">
                      {createFileName ?? t('addenda.noFileChosen')}
                    </span>
                  </div>
                </div>
              )}

              {createError && <p className="form-error">{createError}</p>}

              <div className="row addenda-create-actions">
                <button type="submit" className="primary" disabled={createBusy}>
                  <BusyLabel
                    busy={createBusy}
                    idle={t('addenda.createSubmit')}
                    busyText={
                      createMode === 'text'
                        ? t('addenda.creatingWithAi')
                        : t('addenda.creating')
                    }
                  />
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={createBusy}
                  onClick={() => setCreateOpen(false)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
