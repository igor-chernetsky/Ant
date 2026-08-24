'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';
import { useTranslation } from '@/components/LocaleProvider';

function BoldIcon() {
  return (
    <svg
      className="contract-document-toolbar-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M4 2h5.2c1.9 0 3.3 1.2 3.3 2.9 0 1.1-.6 2-1.5 2.5 1.3.5 2.1 1.6 2.1 3 0 2-1.6 3.1-3.8 3.1H4V2zm2.2 1.8v3.1h2.7c.9 0 1.5-.5 1.5-1.3s-.6-1.3-1.5-1.3H6.2zm0 4.8v3.6h3.2c1.1 0 1.8-.6 1.8-1.6s-.7-1.5-1.8-1.5H6.2z"
      />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg
      className="contract-document-toolbar-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M7.2 2h5.1v1.6H10.5l-2.2 8.8h1.9V14H5.1v-1.6h1.8L9.1 3.6H7.2V2z"
      />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      className="contract-document-toolbar-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M3 3.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm2.2-.7h8.5v1.5H5.2V2.8zm-2.2 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm2.2-.7h8.5v1.5H5.2V7.1zm-2.2 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm2.2-.7h8.5V13H5.2v-1.6z"
      />
    </svg>
  );
}

interface SettingsBroadcastEditorProps {
  onChange?: (html: string, isEmpty: boolean) => void;
  /** Change to remount/clear the editor after a successful send. */
  resetKey?: number;
}

export function SettingsBroadcastEditor({
  onChange,
  resetKey = 0,
}: SettingsBroadcastEditorProps) {
  const { t } = useTranslation();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: '<p></p>',
      immediatelyRender: false,
      onUpdate: ({ editor: current }) => {
        onChangeRef.current?.(current.getHTML(), current.isEmpty);
      },
    },
    [resetKey],
  );

  useEffect(() => {
    if (!editor) return;
    onChangeRef.current?.(editor.getHTML(), editor.isEmpty);
  }, [editor]);

  if (!editor) {
    return (
      <div className="admin-settings-broadcast-editor muted">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="admin-settings-broadcast-editor">
      <div className="contract-document-toolbar" role="toolbar">
        <button
          type="button"
          className="secondary contract-document-toolbar-btn"
          title={t('contractPanel.toolbarBold')}
          aria-label={t('contractPanel.toolbarBold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </button>
        <button
          type="button"
          className="secondary contract-document-toolbar-btn"
          title={t('contractPanel.toolbarItalic')}
          aria-label={t('contractPanel.toolbarItalic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </button>
        <button
          type="button"
          className="secondary contract-document-toolbar-btn"
          title={t('contractPanel.toolbarList')}
          aria-label={t('contractPanel.toolbarList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListIcon />
        </button>
      </div>
      <EditorContent editor={editor} className="admin-settings-broadcast-tiptap" />
    </div>
  );
}
