'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/components/LocaleProvider';

/**
 * Full-size image overlay. Used by the home-page `image` ad template when the
 * slide has no link: the picture is not a link, so clicking it opens it here
 * instead of navigating away.
 */
export function ImageLightbox({
  src,
  isOpen,
  onClose,
}: {
  src: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="modal-backdrop image-lightbox-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="image-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={t('homeAds.imagePreview')}
      >
        <button
          type="button"
          className="image-lightbox-close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ×
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="image-lightbox-image" src={src} alt="" />
      </div>
    </div>,
    document.body,
  );
}
