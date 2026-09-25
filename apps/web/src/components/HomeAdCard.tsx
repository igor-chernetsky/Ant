'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ImageLightbox } from '@/components/ImageLightbox';
import { useTranslation } from '@/components/LocaleProvider';
import { homeAdImageSrc, type PublicHomeAdSlide } from '@/lib/home-ads';
import type { Locale } from '@/lib/i18n';

const ROTATE_MS = 6500;

function copyForLocale(
  copy: PublicHomeAdSlide['title'],
  locale: Locale,
): string {
  return copy[locale] || copy.en;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function ExternalIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 5h5v5" />
      <path d="M10 14L19 5" />
      <path d="M19 12v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 4H4v5" />
      <path d="M15 20h5v-5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
    </svg>
  );
}

export function HomeAdCard({ slides }: { slides: PublicHomeAdSlide[] }) {
  const { t, locale } = useTranslation();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setIndex(0);
    setPreviewOpen(false);
  }, [slides]);

  useEffect(() => {
    // Keep the slide still while the full-size overlay is open.
    if (slides.length < 2 || paused || previewOpen) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, paused, previewOpen]);

  const slide = slides[index];
  if (!slide) return null;

  const isImageTemplate = slide.template === 'image';
  const href = slide.href?.trim() ? slide.href : null;
  const external = href ? isExternalHref(href) : false;
  const imageSrc = homeAdImageSrc(slide);
  const accessibleLabel =
    copyForLocale(slide.title, locale) || t('homeAds.imagePreview');

  return (
    <div className="home-ad-slot">
      <article
        className={`home-ad-card${isImageTemplate ? ' home-ad-card--image' : ''}`}
        aria-roledescription="carousel"
        aria-label={t('homeAds.ariaLabel')}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <span className="home-ad-sponsored">{t('homeAds.sponsored')}</span>

        {isImageTemplate ? (
          <div className="home-ad-image-body">
            {href ? (
              <a
                className="home-ad-image-link"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={accessibleLabel}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="home-ad-image" src={imageSrc} alt="" />
              </a>
            ) : (
              <button
                type="button"
                className="home-ad-image-link"
                onClick={() => setPreviewOpen(true)}
                aria-label={accessibleLabel}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="home-ad-image" src={imageSrc} alt="" />
                <span className="home-ad-image-expand" aria-hidden>
                  <ExpandIcon />
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="home-ad-body">
            <div className="home-ad-copy">
              <h3 className="home-ad-title">
                {copyForLocale(slide.title, locale)}
              </h3>
              <p className="home-ad-description">
                {copyForLocale(slide.description, locale)}
              </p>
              {href ? (
                external ? (
                  <a
                    className="home-ad-cta"
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {copyForLocale(slide.ctaLabel, locale)}
                    <ExternalIcon />
                  </a>
                ) : (
                  <Link className="home-ad-cta" href={href}>
                    {copyForLocale(slide.ctaLabel, locale)}
                  </Link>
                )
              ) : null}
            </div>
            <div className="home-ad-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="home-ad-image" src={imageSrc} alt="" />
            </div>
          </div>
        )}

        {slides.length > 1 && (
          <div className="home-ad-dots" role="tablist">
            {slides.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                className={`home-ad-dot${
                  itemIndex === index ? ' is-active' : ''
                }`}
                aria-label={t('homeAds.slideN', { n: String(itemIndex + 1) })}
                aria-selected={itemIndex === index}
                onClick={() => {
                  setPreviewOpen(false);
                  setIndex(itemIndex);
                }}
              />
            ))}
          </div>
        )}
      </article>

      {isImageTemplate && (
        <ImageLightbox
          src={imageSrc}
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
