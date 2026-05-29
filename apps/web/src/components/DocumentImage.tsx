'use client';

import { useCallback, useEffect, useState } from 'react';
import { getDocumentDownloadUrl, type ProjectDocument } from '@/lib/documents';

interface DocumentImageProps {
  projectId: string;
  document: ProjectDocument;
  variant?: 'gallery' | 'thumb';
  onOpen?: () => void;
}

export function DocumentImage({
  projectId,
  document,
  variant = 'gallery',
  onOpen,
}: DocumentImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const loadUrl = useCallback(async () => {
    setFailed(false);
    try {
      const { downloadUrl } = await getDocumentDownloadUrl(projectId, document.id);
      setSrc(downloadUrl);
    } catch {
      setFailed(true);
      setSrc(null);
    }
  }, [projectId, document.id]);

  useEffect(() => {
    void loadUrl();
  }, [loadUrl]);

  const handleClick = () => {
    if (onOpen) {
      onOpen();
    } else if (src) {
      window.open(src, '_blank', 'noopener,noreferrer');
    }
  };

  const handleImgError = () => {
    void loadUrl();
  };

  if (failed) {
    return (
      <div className={`doc-image-placeholder doc-image-${variant}`}>
        Preview unavailable
      </div>
    );
  }

  if (!src) {
    return (
      <div className={`doc-image-placeholder doc-image-${variant}`}>
        Loading…
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`doc-image doc-image-${variant}`}
      onClick={handleClick}
      title={document.originalName}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={document.originalName}
        loading="lazy"
        onError={handleImgError}
      />
    </button>
  );
}
