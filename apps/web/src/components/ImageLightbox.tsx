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
          {/* A drawn cross instead of the "×" glyph: its ink is centred by
              geometry, so it stays centred whatever font is loaded. */}
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="image-lightbox-image" src={src} alt="" />
      </div>
    </div>,
    document.body,
  );
}
