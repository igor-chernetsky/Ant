'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  regenerateProjectContractDocument,
  updateProjectContractDocument,
  type ProjectContract,
} from '@/lib/contracts';

function BoldIcon() {
  return (
    <svg
      className="contract-document-toolbar-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 4h8a4 4 0 0 1 0 8H6z" />
      <path d="M6 12h9a4 4 0 0 1 0 8H6z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg
      className="contract-document-toolbar-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="19" x2="10" y1="4" y2="4" />
      <line x1="14" x2="5" y1="20" y2="20" />
      <line x1="15" x2="9" y1="4" y2="20" />
    </svg>
  );
}

function HeadingIcon() {
  return (
    <svg
      className="contract-document-toolbar-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12h16" />
      <path d="M4 18V6" />
      <path d="M20 18V6" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      className="contract-document-toolbar-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg
      className="contract-document-toolbar-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </svg>
  );
}

interface ContractDocumentEditorProps {
  projectId: string;
  contract: ProjectContract;
  asContractor?: boolean;
  onSaved?: (contract: ProjectContract) => void;
}

export function ContractDocumentEditor({
  projectId,
  contract,
  asContractor = false,
  onSaved,
}: ContractDocumentEditorProps) {
  const { t } = useTranslation();
  const readOnly = !contract.canEditDocument || contract.fullySigned;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          class: 'contract-editor-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: contract.englishBodyHtml || '<p></p>',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: () => {
      setDirty(true);
      setSaved(false);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = contract.englishBodyHtml || '<p></p>';
    if (editor.getHTML() !== next && !dirty) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    editor.setEditable(!readOnly);
  }, [contract.englishBodyHtml, contract.id, dirty, editor, readOnly]);

  const runCommand = (command: () => boolean) => {
    if (!editor || readOnly) return;
    command();
    editor.chain().focus().run();
  };

  const handleSave = async () => {
    if (!editor || readOnly) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateProjectContractDocument(
        projectId,
        editor.getHTML(),
        { asContractor },
      );
      setDirty(false);
      setSaved(true);
      onSaved?.(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('contractPanel.saveDocumentFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    if (readOnly) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await regenerateProjectContractDocument(projectId, {
        asContractor,
      });
      setDirty(false);
      onSaved?.(updated);
      if (editor) {
        editor.commands.setContent(updated.englishBodyHtml || '<p></p>', {
          emitUpdate: false,
        });
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('contractPanel.regenerateFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="contract-secondary-details">
      <summary className="contract-secondary-details-summary">
        {t('contractPanel.editorToggle')}
      </summary>
      <div className="contract-secondary-details-body">
        <p className="muted contract-document-editor-hint">
          {readOnly
            ? t('contractPanel.editorReadOnlyHint')
            : t('contractPanel.editorHint')}
        </p>

        {!readOnly && editor && (
          <div className="contract-document-toolbar" role="toolbar">
            <button
              type="button"
              className="secondary contract-document-toolbar-btn"
              title={t('contractPanel.toolbarBold')}
              aria-label={t('contractPanel.toolbarBold')}
              onClick={() =>
                runCommand(() => editor.chain().focus().toggleBold().run())
              }
            >
              <BoldIcon />
            </button>
            <button
              type="button"
              className="secondary contract-document-toolbar-btn"
              title={t('contractPanel.toolbarItalic')}
              aria-label={t('contractPanel.toolbarItalic')}
              onClick={() =>
                runCommand(() => editor.chain().focus().toggleItalic().run())
              }
            >
              <ItalicIcon />
            </button>
            <button
              type="button"
              className="secondary contract-document-toolbar-btn"
              title={t('contractPanel.toolbarHeading')}
              aria-label={t('contractPanel.toolbarHeading')}
              onClick={() =>
                runCommand(() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run(),
                )
              }
            >
              <HeadingIcon />
            </button>
            <button
              type="button"
              className="secondary contract-document-toolbar-btn"
              title={t('contractPanel.toolbarList')}
              aria-label={t('contractPanel.toolbarList')}
              onClick={() =>
                runCommand(() =>
                  editor.chain().focus().toggleBulletList().run(),
                )
              }
            >
              <ListIcon />
            </button>
            <button
              type="button"
              className="secondary contract-document-toolbar-btn"
              title={t('contractPanel.toolbarTable')}
              aria-label={t('contractPanel.toolbarTable')}
              onClick={() =>
                runCommand(() =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run(),
                )
              }
            >
              <TableIcon />
            </button>
          </div>
        )}

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
              {busy
                ? t('common.saving')
                : t('contractPanel.saveDocument')}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void handleRegenerate()}
            >
              {t('contractPanel.regenerateDocument')}
            </button>
            {saved && (
              <p className="muted">{t('contractPanel.documentSaved')}</p>
            )}
          </div>
        )}

        {error && <p className="form-error">{error}</p>}
      </div>
    </details>
  );
}
