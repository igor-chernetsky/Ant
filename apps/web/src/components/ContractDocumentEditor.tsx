'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  updateProjectContractDocument,
  type ProjectContract,
} from '@/lib/contracts';

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
    extensions: [StarterKit],
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
              className="secondary"
              onClick={() =>
                runCommand(() => editor.chain().focus().toggleBold().run())
              }
            >
              {t('contractPanel.toolbarBold')}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                runCommand(() => editor.chain().focus().toggleItalic().run())
              }
            >
              {t('contractPanel.toolbarItalic')}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                runCommand(() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run(),
                )
              }
            >
              {t('contractPanel.toolbarHeading')}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                runCommand(() =>
                  editor.chain().focus().toggleBulletList().run(),
                )
              }
            >
              {t('contractPanel.toolbarList')}
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
