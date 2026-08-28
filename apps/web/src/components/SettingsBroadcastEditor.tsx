'use client';

import Image from '@tiptap/extension-image';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, type ChangeEvent } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { formatFileSize } from '@/lib/documents';

const INLINE_IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;

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

function ImageIcon() {
  return (
    <svg
      className="contract-document-toolbar-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M2.5 3.5A1.5 1.5 0 0 1 4 2h8a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 12 14H4a1.5 1.5 0 0 1-1.5-1.5v-9zM4 3.5v6.09l2.1-2.1a.75.75 0 0 1 1.06 0L9.6 11l1.4-1.4a.75.75 0 0 1 1.06 0L12.5 11.5v-8H4zm8.5 7.35-1.65-1.65-2.35 2.35-1.65-1.65L4.5 12.5h7v-1.65zM6 6.25a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
      />
    </svg>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Failed to read image'));
    };
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

interface SettingsBroadcastEditorProps {
  onChange?: (html: string, isEmpty: boolean) => void;
  onImageError?: (message: string) => void;
  /** Change to remount/clear the editor after a successful send. */
  resetKey?: number;
}

export function SettingsBroadcastEditor({
  onChange,
  onImageError,
  resetKey = 0,
}: SettingsBroadcastEditorProps) {
  const { t } = useTranslation();
  const onChangeRef = useRef(onChange);
  const onImageErrorRef = useRef(onImageError);
  const imageInputRef = useRef<HTMLInputElement>(null);
  onChangeRef.current = onChange;
  onImageErrorRef.current = onImageError;

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Image.configure({
          inline: false,
          allowBase64: true,
        }),
      ],
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

  const openImagePicker = () => {
    imageInputRef.current?.click();
  };

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !editor) return;

    const allowedTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ]);
    if (!allowedTypes.has(file.type)) {
      onImageErrorRef.current?.(
        t('admin.settingsBroadcastInlineImageTypeInvalid'),
      );
      return;
    }
    if (file.size > MAX_INLINE_IMAGE_BYTES) {
      onImageErrorRef.current?.(
        t('admin.settingsBroadcastInlineImageTooLarge', {
          maxSize: formatFileSize(MAX_INLINE_IMAGE_BYTES),
        }),
      );
      return;
    }

    try {
      const src = await readFileAsDataUrl(file);
      editor.chain().focus().setImage({ src, alt: file.name }).run();
    } catch {
      onImageErrorRef.current?.(t('admin.settingsBroadcastInlineImageReadFailed'));
    }
  };

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
        <button
          type="button"
          className="secondary contract-document-toolbar-btn"
          title={t('admin.settingsBroadcastInsertImage')}
          aria-label={t('admin.settingsBroadcastInsertImage')}
          onClick={openImagePicker}
        >
          <ImageIcon />
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept={INLINE_IMAGE_ACCEPT}
          hidden
          onChange={(event) => void handleImageSelected(event)}
        />
      </div>
      <EditorContent editor={editor} className="admin-settings-broadcast-tiptap" />
    </div>
  );
}
