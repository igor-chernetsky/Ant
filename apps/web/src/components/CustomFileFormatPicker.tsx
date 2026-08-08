'use client';

import { useTranslation } from '@/components/LocaleProvider';
import type { CustomFileDownloadFormat } from '@/lib/contracts';

interface CustomFileFormatPickerProps {
  hasPdf: boolean;
  hasDocx: boolean;
  formats: CustomFileDownloadFormat[];
  onChange: (formats: CustomFileDownloadFormat[]) => void;
  disabled?: boolean;
  className?: string;
}

export function CustomFileFormatPicker({
  hasPdf,
  hasDocx,
  formats,
  onChange,
  disabled = false,
  className,
}: CustomFileFormatPickerProps) {
  const { t } = useTranslation();

  if (!hasPdf || !hasDocx) {
    return null;
  }

  const toggle = (format: CustomFileDownloadFormat) => {
    if (formats.includes(format)) {
      if (formats.length === 1) return;
      onChange(formats.filter((item) => item !== format));
      return;
    }
    onChange([...formats, format]);
  };

  return (
    <fieldset
      className={
        className
          ? `custom-file-format-picker ${className}`
          : 'custom-file-format-picker'
      }
    >
      <legend>{t('contractPanel.downloadFormatsLabel')}</legend>
      <div className="custom-file-format-picker-list">
        <label className="custom-file-format-picker-option">
          <input
            type="checkbox"
            checked={formats.includes('pdf')}
            disabled={disabled}
            onChange={() => toggle('pdf')}
          />
          <span>PDF</span>
        </label>
        <label className="custom-file-format-picker-option">
          <input
            type="checkbox"
            checked={formats.includes('docx')}
            disabled={disabled}
            onChange={() => toggle('docx')}
          />
          <span>DOCX</span>
        </label>
      </div>
      <p className="muted custom-file-format-picker-hint">
        {t('contractPanel.downloadDocxHint')}
      </p>
    </fieldset>
  );
}
