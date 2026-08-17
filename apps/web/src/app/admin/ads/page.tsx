'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import {
  createAdminHomeAd,
  deleteAdminHomeAd,
  fetchAdminHomeAds,
  updateAdminHomeAd,
  type HomeAdSlide,
  type HomeAdSlideInput,
  type LocaleCopy,
} from '@/lib/home-ads';
import { isAdmin } from '@/lib/verification';

const EMPTY_COPY: LocaleCopy = { en: '', ru: '', th: '' };

const EMPTY_DRAFT: HomeAdSlideInput = {
  enabled: true,
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

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
      href: slide.href,
      imageUrl: slide.imageUrl,
      title: { ...slide.title },
      description: { ...slide.description },
      ctaLabel: { ...slide.ctaLabel },
    });
    setError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        await updateAdminHomeAd(editingId, draft);
      } else {
        await createAdminHomeAd(draft);
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

  return (
    <>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />
      <main className="content-container main-content">
        <section className="page-hero">
          <h1>{t('admin.adsTitle')}</h1>
          <p className="page-hero-lead muted">{t('admin.adsLead')}</p>
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
            <section className="card">
              <h2 className="section-title">{t('admin.adsSlides')}</h2>
              {error && <p className="form-error">{error}</p>}
              {slides.length === 0 ? (
                <p className="muted">{t('admin.adsEmpty')}</p>
              ) : (
                <ul className="admin-ads-list">
                  {slides.map((slide, index) => (
                    <li key={slide.id} className="admin-ads-row">
                      <div className="admin-ads-row-main">
                        <strong>{slide.title.en}</strong>
                        <span className="muted">
                          {slide.enabled
                            ? t('admin.adsEnabled')
                            : t('admin.adsDisabled')}{' '}
                          · {slide.href}
                        </span>
                      </div>
                      <div className="admin-ads-row-actions">
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy || index === 0}
                          onClick={() => void move(slide.id, -1)}
                        >
                          {t('admin.adsMoveUp')}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy || index === slides.length - 1}
                          onClick={() => void move(slide.id, 1)}
                        >
                          {t('admin.adsMoveDown')}
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

            <section className="card">
              <h2 className="section-title">
                {editingId ? t('admin.adsEditSlide') : t('admin.adsAddSlide')}
              </h2>
              <form className="admin-ads-form" onSubmit={(e) => void handleSave(e)}>
                <label className="field">
                  <span>{t('admin.adsHref')}</span>
                  <input
                    value={draft.href}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, href: e.target.value }))
                    }
                    placeholder="/materials"
                    required
                  />
                </label>
                <label className="field">
                  <span>{t('admin.adsImageUrl')}</span>
                  <input
                    value={draft.imageUrl}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, imageUrl: e.target.value }))
                    }
                    placeholder="/ads/materials.png"
                    required
                  />
                </label>
                <label className="admin-ads-enabled">
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
                  {t('admin.adsEnabled')}
                </label>

                {(['en', 'ru', 'th'] as const).map((locale) => (
                  <fieldset key={locale} className="admin-ads-locale">
                    <legend>{t(`header.lang_${locale}`)}</legend>
                    <label className="field">
                      <span>{t('admin.adsTitleField')}</span>
                      <input
                        value={draft.title[locale]}
                        onChange={(e) =>
                          setCopy('title', locale, e.target.value)
                        }
                        required
                      />
                    </label>
                    <label className="field">
                      <span>{t('admin.adsDescription')}</span>
                      <textarea
                        rows={3}
                        value={draft.description[locale]}
                        onChange={(e) =>
                          setCopy('description', locale, e.target.value)
                        }
                        required
                      />
                    </label>
                    <label className="field">
                      <span>{t('admin.adsCta')}</span>
                      <input
                        value={draft.ctaLabel[locale]}
                        onChange={(e) =>
                          setCopy('ctaLabel', locale, e.target.value)
                        }
                        required
                      />
                    </label>
                  </fieldset>
                ))}

                <div className="row">
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
