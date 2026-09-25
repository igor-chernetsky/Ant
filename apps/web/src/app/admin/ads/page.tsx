'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import {
  AD_IMAGE_ACCEPT,
  MAX_AD_IMAGE_BYTES,
  createAdminHomeAd,
  deleteAdminHomeAd,
  fetchAdminHomeAds,
  homeAdImageSrc,
  updateAdminHomeAd,
  uploadAdminHomeAdImage,
  type HomeAdImageSource,
  type HomeAdSlide,
  type HomeAdSlideInput,
  type HomeAdTemplate,
  type LocaleCopy,
} from '@/lib/home-ads';
import { isAdmin } from '@/lib/verification';

const LOCALES = ['en', 'ru', 'th'] as const;
type AdLocale = (typeof LOCALES)[number];

const TEMPLATES: readonly HomeAdTemplate[] = ['card', 'image'];
const IMAGE_SOURCES: readonly HomeAdImageSource[] = ['url', 'upload'];

const EMPTY_COPY: LocaleCopy = { en: '', ru: '', th: '' };

const EMPTY_DRAFT: HomeAdSlideInput = {
  enabled: true,
  template: 'card',
  imageSource: 'url',
  href: '',
  imageUrl: '',
  title: { ...EMPTY_COPY },
  description: { ...EMPTY_COPY },
  ctaLabel: { ...EMPTY_COPY },
};

export default function AdminAdsPage() {
  const { t } = useTranslation();
  const { me, ready: sessionReady, signOut } = useSession();
  const [ready, setReady] = useState(false);
  const [slides, setSlides] = useState<HomeAdSlide[]>([]);
  const [draft, setDraft] = useState<HomeAdSlideInput>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeLocale, setActiveLocale] = useState<AdLocale>('en');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  /**
   * Preview for a file uploaded in this session. The stored image is only
   * reachable through the API route once the slide exists, so a fresh upload
   * shows a local object URL until the form is saved.
   */
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const next = await fetchAdminHomeAds();
    setSlides(next);
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    setReady(true);
    if (me && isAdmin(me.roles)) {
      void load().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('admin.adsLoadFailed'));
      });
    }
  }, [sessionReady, me, load, t]);

  const startEdit = (slide: HomeAdSlide) => {
    setEditingId(slide.id);
    setDraft({
      enabled: slide.enabled,
      template: slide.template,
      imageSource: slide.imageUploaded ? 'upload' : 'url',
      href: slide.href ?? '',
      imageUrl: slide.imageUploaded ? '' : (slide.imageUrl ?? ''),
      title: { ...slide.title },
      description: { ...slide.description },
      ctaLabel: { ...slide.ctaLabel },
    });
    setLocalPreview(null);
    setActiveLocale('en');
    setError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setLocalPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setActiveLocale('en');
  };

  const handleImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const storageKey = await uploadAdminHomeAdImage(file);
      setDraft((prev) => ({
        ...prev,
        imageSource: 'upload',
        imageStorageKey: storageKey,
        imageUrl: '',
      }));
      setLocalPreview((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(file);
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('admin.adsImageUploadFailed'),
      );
    } finally {
      setUploading(false);
    }
  };

  const editedSlide = slides.find((slide) => slide.id === editingId) ?? null;
  /** Image already saved on the server for the slide being edited. */
  const hasStoredImage = Boolean(editedSlide?.imageUploaded);

  /** Draft payload: only the selected image source is sent to the API. */
  const buildPayload = (): HomeAdSlideInput => {
    const {
      imageStorageKey,
      imageUrl,
      imageSource: _imageSource,
      ...rest
    } = draft;

    if (draft.imageSource === 'upload') {
      // Send the key only for a file uploaded in this session. Otherwise the
      // slide already has its image and the field must stay untouched.
      return imageStorageKey
        ? { ...rest, imageSource: 'upload', imageStorageKey }
        : { ...rest };
    }

    return { ...rest, imageSource: 'url', imageUrl: (imageUrl ?? '').trim() };
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (draft.imageSource === 'upload' && !draft.imageStorageKey && !hasStoredImage) {
      setError(t('admin.adsImageRequired'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (editingId) {
        await updateAdminHomeAd(editingId, payload);
      } else {
        await createAdminHomeAd(payload);
      }
      resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('admin.adsSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.adsConfirmDelete'))) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminHomeAd(id);
      if (editingId === id) resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('admin.adsDeleteFailed'));
    } finally {
      setBusy(false);
    }
  };

  const move = async (id: string, direction: -1 | 1) => {
    const index = slides.findIndex((slide) => slide.id === id);
    const swapWith = slides[index + direction];
    if (index < 0 || !swapWith) return;
    setBusy(true);
    setError(null);
    try {
      await updateAdminHomeAd(id, { sortOrder: swapWith.sortOrder });
      await updateAdminHomeAd(swapWith.id, { sortOrder: slides[index].sortOrder });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('admin.adsSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const setCopy = (
    field: 'title' | 'description' | 'ctaLabel',
    locale: keyof LocaleCopy,
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      [field]: { ...prev[field], [locale]: value },
    }));
  };

  const localeFilled = (locale: AdLocale) =>
    Boolean(
      draft.title[locale].trim() &&
        draft.description[locale].trim() &&
        draft.ctaLabel[locale].trim(),
    );

  return (
    <>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />
      <main className="content-container content-container--wide main-content admin-ads-page">
        <section className="page-hero admin-ads-hero">
          <div>
            <h1>{t('admin.adsTitle')}</h1>
            <p className="page-hero-lead muted">{t('admin.adsLead')}</p>
          </div>
          {ready && me && isAdmin(me.roles) && (
            <p className="muted admin-ads-count">
              {t('admin.adsCount', { count: String(slides.length) })}
            </p>
          )}
        </section>

        {!ready && <p className="muted">{t('common.loading')}</p>}

        {ready && !me && (
          <section className="card">
            <p>{t('admin.signInPrompt')}</p>
            <button
              type="button"
              className="primary"
              onClick={() => setLoginOpen(true)}
            >
              {t('header.signIn')}
            </button>
          </section>
        )}

        {ready && me && !isAdmin(me.roles) && (
          <section className="card error">
            <p>{t('admin.roleRequired')}</p>
          </section>
        )}

        {ready && me && isAdmin(me.roles) && (
          <div className="admin-ads-layout">
            <section className="card admin-ads-editor">
              <header className="admin-ads-panel-head">
                <h2 className="section-title">
                  {editingId ? t('admin.adsEditSlide') : t('admin.adsAddSlide')}
                </h2>
                {editingId && (
                  <button
                    type="button"
                    className="secondary admin-ads-clear-edit"
                    disabled={busy}
                    onClick={resetForm}
                  >
                    {t('admin.adsNewSlide')}
                  </button>
                )}
              </header>

              {error && <p className="form-error admin-ads-form-error">{error}</p>}

              <form className="admin-ads-form" onSubmit={(e) => void handleSave(e)}>
                <div className="admin-ads-form-section">
                  <h3 className="admin-ads-form-section-title">
                    {t('admin.adsSettingsSection')}
                  </h3>

                  <div
                    className="admin-ads-template"
                    role="radiogroup"
                    aria-label={t('admin.adsTemplate')}
                  >
                    {TEMPLATES.map((template) => (
                      <button
                        key={template}
                        type="button"
                        role="radio"
                        aria-checked={draft.template === template}
                        className={`admin-ads-template-option${
                          draft.template === template ? ' is-active' : ''
                        }`}
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, template }))
                        }
                      >
                        <span className="admin-ads-template-name">
                          {t(`admin.adsTemplate_${template}`)}
                        </span>
                        <span className="admin-ads-template-hint muted">
                          {t(`admin.adsTemplateHint_${template}`)}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="admin-ads-settings-grid">
                    <label className="admin-ads-field">
                      <span className="admin-ads-field-label">
                        {draft.template === 'image'
                          ? t('admin.adsHrefOptional')
                          : t('admin.adsHref')}
                      </span>
                      <input
                        value={draft.href ?? ''}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, href: e.target.value }))
                        }
                        placeholder="/materials"
                        required={draft.template !== 'image'}
                      />
                      {draft.template === 'image' ? (
                        <span className="admin-ads-field-hint muted">
                          {t('admin.adsHrefImageHint')}
                        </span>
                      ) : null}
                    </label>
                  </div>

                  <div className="admin-ads-image-block">
                    <span className="admin-ads-field-label">
                      {t('admin.adsImageSource')}
                    </span>

                    <div
                      className="admin-ads-template"
                      role="radiogroup"
                      aria-label={t('admin.adsImageSource')}
                    >
                      {IMAGE_SOURCES.map((source) => (
                        <button
                          key={source}
                          type="button"
                          role="radio"
                          aria-checked={draft.imageSource === source}
                          className={`admin-ads-template-option${
                            draft.imageSource === source ? ' is-active' : ''
                          }`}
                          onClick={() =>
                            setDraft((prev) => ({ ...prev, imageSource: source }))
                          }
                        >
                          <span className="admin-ads-template-name">
                            {t(`admin.adsImageSource_${source}`)}
                          </span>
                          <span className="admin-ads-template-hint muted">
                            {t(`admin.adsImageSourceHint_${source}`)}
                          </span>
                        </button>
                      ))}
                    </div>

                    {draft.imageSource === 'upload' ? (
                      <div className="admin-ads-upload">
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="sr-only"
                          accept={AD_IMAGE_ACCEPT}
                          onChange={(e) => void handleImageFile(e)}
                          disabled={uploading}
                        />
                        <div className="admin-ads-upload-actions">
                          <button
                            type="button"
                            className="secondary"
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {uploading
                              ? t('admin.adsImageUploading')
                              : draft.imageStorageKey
                                ? t('admin.adsImageReplace')
                                : t('admin.adsImageUpload')}
                          </button>
                          {localPreview ? (
                            <span className="admin-ads-upload-badge">
                              {t('admin.adsImageUploaded')}
                            </span>
                          ) : null}
                        </div>
                        <span className="admin-ads-field-hint muted">
                          {t('admin.adsImageUploadHint', {
                            maxMb: String(MAX_AD_IMAGE_BYTES / (1024 * 1024)),
                          })}
                        </span>
                        {localPreview || (hasStoredImage && editedSlide) ? (
                          <div className="admin-ads-preview">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                localPreview ?? homeAdImageSrc(editedSlide!)
                              }
                              alt=""
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <label className="admin-ads-field">
                        <span className="admin-ads-field-label">
                          {t('admin.adsImageUrl')}
                        </span>
                        <input
                          value={draft.imageUrl ?? ''}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              imageUrl: e.target.value,
                            }))
                          }
                          placeholder="/ads/materials.png"
                          required
                        />
                        {draft.imageUrl?.trim() ? (
                          <div className="admin-ads-preview">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={draft.imageUrl} alt="" />
                          </div>
                        ) : null}
                      </label>
                    )}
                  </div>

                  <div className="admin-ads-settings-footer">
                    <label className="admin-ads-toggle">
                      <input
                        type="checkbox"
                        checked={draft.enabled !== false}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            enabled: e.target.checked,
                          }))
                        }
                      />
                      <span>{t('admin.adsEnabled')}</span>
                    </label>
                  </div>
                </div>

                {draft.template === 'card' ? (
                  <div className="admin-ads-form-section">
                    <h3 className="admin-ads-form-section-title">
                      {t('admin.adsCopySection')}
                    </h3>
                    <p className="admin-ads-form-section-lead muted">
                      {t('admin.adsCopySectionLead')}
                    </p>

                    <div
                      className="admin-ads-locale-tabs"
                      role="tablist"
                      aria-label={t('admin.adsCopySection')}
                    >
                      {LOCALES.map((locale) => (
                        <button
                          key={locale}
                          type="button"
                          role="tab"
                          className={`admin-ads-locale-tab${
                            activeLocale === locale ? ' is-active' : ''
                          }`}
                          aria-selected={activeLocale === locale}
                          onClick={() => setActiveLocale(locale)}
                        >
                          {t(`header.lang_${locale}`)}
                          {localeFilled(locale) ? (
                            <span className="admin-ads-locale-dot" aria-hidden />
                          ) : null}
                        </button>
                      ))}
                    </div>

                    {LOCALES.map((locale) => (
                      <div
                        key={locale}
                        className="admin-ads-locale-panel"
                        role="tabpanel"
                        hidden={activeLocale !== locale}
                      >
                        <label className="admin-ads-field">
                          <span className="admin-ads-field-label">
                            {t('admin.adsTitleField')}
                          </span>
                          <input
                            value={draft.title[locale]}
                            onChange={(e) =>
                              setCopy('title', locale, e.target.value)
                            }
                            required
                          />
                        </label>
                        <label className="admin-ads-field">
                          <span className="admin-ads-field-label">
                            {t('admin.adsDescription')}
                          </span>
                          <textarea
                            rows={4}
                            value={draft.description[locale]}
                            onChange={(e) =>
                              setCopy('description', locale, e.target.value)
                            }
                            required
                          />
                        </label>
                        <label className="admin-ads-field">
                          <span className="admin-ads-field-label">
                            {t('admin.adsCta')}
                          </span>
                          <input
                            value={draft.ctaLabel[locale]}
                            onChange={(e) =>
                              setCopy('ctaLabel', locale, e.target.value)
                            }
                            required
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="admin-ads-form-actions">
                  <button type="submit" className="primary" disabled={busy}>
                    {busy
                      ? t('common.pleaseWait')
                      : editingId
                        ? t('common.save')
                        : t('admin.adsAddSlide')}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={resetForm}
                    >
                      {t('common.cancel')}
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="card admin-ads-registry">
              <h2 className="section-title">{t('admin.adsSlides')}</h2>
              {slides.length === 0 ? (
                <p className="muted admin-ads-empty">{t('admin.adsEmpty')}</p>
              ) : (
                <ul className="admin-ads-list">
                  {slides.map((slide, index) => (
                    <li
                      key={slide.id}
                      className={`admin-ads-card${
                        editingId === slide.id ? ' is-editing' : ''
                      }`}
                    >
                      <div className="admin-ads-card-preview">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={homeAdImageSrc(slide)} alt="" />
                      </div>
                      <div className="admin-ads-card-main">
                        <div className="admin-ads-card-head">
                          <strong>
                            {slide.title.en ||
                              slide.href ||
                              t('admin.adsTemplate_image')}
                          </strong>
                          <span className="admin-ads-template-badge">
                            {t(`admin.adsTemplate_${slide.template}`)}
                          </span>
                          <span
                            className={`admin-ads-status${
                              slide.enabled ? ' is-enabled' : ''
                            }`}
                          >
                            {slide.enabled
                              ? t('admin.adsEnabled')
                              : t('admin.adsDisabled')}
                          </span>
                        </div>
                        <p className="admin-ads-card-meta muted">
                          {slide.href ?? t('admin.adsNoLink')}
                        </p>
                        {slide.description.en ? (
                          <p className="admin-ads-card-copy muted">
                            {slide.description.en}
                          </p>
                        ) : null}
                      </div>
                      <div className="admin-ads-card-actions">
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy || index === 0}
                          onClick={() => void move(slide.id, -1)}
                          aria-label={t('admin.adsMoveUp')}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy || index === slides.length - 1}
                          onClick={() => void move(slide.id, 1)}
                          aria-label={t('admin.adsMoveDown')}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => startEdit(slide)}
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={busy}
                          onClick={() => void handleDelete(slide.id)}
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => setLoginOpen(false)}
      />
    </>
  );
}
