'use client';

import { useEffect, useMemo, useState } from 'react';
import { HelpScenario } from '@/components/help/HelpScenario';
import { useTranslation } from '@/components/LocaleProvider';

type HelpRole = 'client' | 'contractor' | 'designer';

function roleFromHash(hash: string): HelpRole | null {
  if (hash.startsWith('client-')) return 'client';
  if (hash.startsWith('contractor-')) return 'contractor';
  if (hash.startsWith('designer-')) return 'designer';
  return null;
}

export function HelpHub() {
  const { t } = useTranslation();
  const [role, setRole] = useState<HelpRole>('client');

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, '');
      const fromHash = roleFromHash(hash);
      if (fromHash) {
        setRole(fromHash);
      }
      if (!hash) return;
      window.requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  const roles: Array<{ id: HelpRole; label: string }> = useMemo(
    () => [
      { id: 'client', label: t('help.roleClient') },
      { id: 'contractor', label: t('help.roleContractor') },
      { id: 'designer', label: t('help.roleDesigner') },
    ],
    [t],
  );

  return (
    <div className="help-hub">
      <section className="page-hero">
        <h1>{t('help.title')}</h1>
        <p className="page-hero-lead muted">{t('help.lead')}</p>
      </section>

      <div
        className="admin-filter-bar help-role-tabs"
        role="tablist"
        aria-label={t('help.title')}
      >
        {roles.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={role === item.id}
            className={
              role === item.id
                ? 'admin-filter-chip admin-filter-chip-active'
                : 'admin-filter-chip'
            }
            onClick={() => setRole(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {role === 'client' && (
        <section
          className="help-role-section"
          aria-labelledby="help-client-heading"
        >
          <h2 id="help-client-heading" className="section-title">
            {t('help.clientSectionTitle')}
          </h2>
          <p className="muted help-section-lead">{t('help.clientSectionLead')}</p>
          <div className="help-scenario-grid">
            <HelpScenario
              id="client-first-project"
              title={t('help.clientScenario1Title')}
              steps={[
                t('help.clientScenario1Step1'),
                t('help.clientScenario1Step2'),
                t('help.clientScenario1Step3'),
              ]}
              actionHref="/"
              actionLabel={t('help.goHome')}
            />
            <HelpScenario
              id="client-tender"
              title={t('help.clientScenario2Title')}
              steps={[
                t('help.clientScenario2Step1'),
                t('help.clientScenario2Step2'),
                t('help.clientScenario2Step3'),
              ]}
              actionHref="/"
              actionLabel={t('help.goHome')}
            />
          </div>
        </section>
      )}

      {role === 'contractor' && (
        <section
          className="help-role-section"
          aria-labelledby="help-contractor-heading"
        >
          <h2 id="help-contractor-heading" className="section-title">
            {t('help.contractorSectionTitle')}
          </h2>
          <p className="muted help-section-lead">
            {t('help.contractorSectionLead')}
          </p>
          <div className="help-scenario-grid">
            <HelpScenario
              id="contractor-profile"
              title={t('help.contractorScenario1Title')}
              steps={[
                t('help.contractorScenario1Step1'),
                t('help.contractorScenario1Step2'),
                t('help.contractorScenario1Step3'),
              ]}
              actionHref="/contractor"
              actionLabel={t('help.openPortal')}
            />
            <HelpScenario
              id="contractor-tender"
              title={t('help.contractorScenario2Title')}
              steps={[
                t('help.contractorScenario2Step1'),
                t('help.contractorScenario2Step2'),
                t('help.contractorScenario2Step3'),
              ]}
              actionHref="/"
              actionLabel={t('help.goHome')}
            />
          </div>
        </section>
      )}

      {role === 'designer' && (
        <section
          className="help-role-section"
          aria-labelledby="help-designer-heading"
        >
          <h2 id="help-designer-heading" className="section-title">
            {t('help.designerSectionTitle')}
          </h2>
          <p className="muted help-section-lead">
            {t('help.designerSectionLead')}
          </p>
          <div className="help-scenario-grid">
            <HelpScenario
              id="designer-profile"
              title={t('help.designerScenario1Title')}
              steps={[
                t('help.designerScenario1Step1'),
                t('help.designerScenario1Step2'),
                t('help.designerScenario1Step3'),
              ]}
              actionHref="/designer"
              actionLabel={t('help.openPortal')}
            />
            <HelpScenario
              id="designer-tender"
              title={t('help.designerScenario2Title')}
              steps={[
                t('help.designerScenario2Step1'),
                t('help.designerScenario2Step2'),
                t('help.designerScenario2Step3'),
              ]}
              actionHref="/"
              actionLabel={t('help.goHome')}
            />
          </div>
        </section>
      )}
    </div>
  );
}
