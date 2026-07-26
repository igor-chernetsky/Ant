'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { dismissHelpTip, isHelpTipDismissed } from '@/lib/help-tips';

interface HelpTipProps {
  tipId: string;
  title: string;
  body: string;
  learnMoreHref: string;
  className?: string;
}

export function HelpTip({
  tipId,
  title,
  body,
  learnMoreHref,
  className = '',
}: HelpTipProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!isHelpTipDismissed(tipId));
  }, [tipId]);

  if (!visible) return null;

  return (
    <aside
      className={`help-tip${className ? ` ${className}` : ''}`}
      role="note"
    >
      <div className="help-tip-body">
        <h3 className="help-tip-title">{title}</h3>
        <p className="help-tip-text muted">{body}</p>
        <Link href={learnMoreHref} className="text-link help-tip-link">
          {t('help.learnMore')}
        </Link>
      </div>
      <button
        type="button"
        className="icon-button help-tip-dismiss"
        aria-label={t('help.dismiss')}
        onClick={() => {
          dismissHelpTip(tipId);
          setVisible(false);
        }}
      >
        ×
      </button>
    </aside>
  );
}
