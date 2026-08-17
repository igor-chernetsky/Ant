'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import type { PublicHomeAdSlide } from '@/lib/home-ads';
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

export function HomeAdCard({ slides }: { slides: PublicHomeAdSlide[] }) {
  const { t, locale } = useTranslation();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [slides]);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, paused]);

  const slide = slides[index];
  if (!slide) return null;

  const title = copyForLocale(slide.title, locale);
  const description = copyForLocale(slide.description, locale);
  const cta = copyForLocale(slide.ctaLabel, locale);
  const external = isExternalHref(slide.href);

  const ctaClassName = 'home-ad-cta';
  const ctaInner = (
    <>
      {cta}
      {external ? <ExternalIcon /> : null}
    </>
  );

  return (
    <article
      className="home-ad-card"
      aria-roledescription="carousel"
      aria-label={t('homeAds.ariaLabel')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="home-ad-sponsored">{t('homeAds.sponsored')}</span>
      <div className="home-ad-body">
        <div className="home-ad-copy">
          <h3 className="home-ad-title">{title}</h3>
          <p className="home-ad-description">{description}</p>
          {external ? (
            <a
              className={ctaClassName}
              href={slide.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {ctaInner}
            </a>
          ) : (
            <Link className={ctaClassName} href={slide.href}>
              {ctaInner}
            </Link>
          )}
        </div>
        <div className="home-ad-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="home-ad-image"
            src={slide.imageUrl}
            alt=""
          />
        </div>
      </div>
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
              onClick={() => setIndex(itemIndex)}
            />
          ))}
        </div>
      )}
    </article>
  );
}
