'use client';

import { DocumentImage } from '@/components/DocumentImage';
import { DocumentInsightCollapsible } from '@/components/DocumentInsightCollapsible';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import {
  formatFileSize,
  type ProjectDocument,
} from '@/lib/documents';
import { isImageDocument } from '@/lib/document-images';

export interface BriefScopePackage {
  trade: string;
  description: string;
  quantity?: number;
  unit?: string;
  areaSqm?: number;
  sourceDocumentId?: string;
}

interface DocumentInsight {
  summary: string;
  confidence: number;
  provider: 'openai' | 'fallback';
  omittedNote?: string;
  keyFacts?: string[];
}

interface DocumentTileProps {
  projectId: string;
  document: ProjectDocument;
  publicView: boolean;
  scopePackages?: BriefScopePackage[];
  insight?: DocumentInsight;
  showDelete?: boolean;
  deleting?: boolean;
  onDownload: () => void;
  onDelete?: () => void;
  formatDateTime: (iso: string) => string;
}

function fileExtension(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext && ext.length <= 8 ? ext : 'file';
}

function ScopePackagesList({ packages }: { packages: BriefScopePackage[] }) {
  const { t } = useTranslation();

  if (packages.length === 0) {
    return null;
  }

  return (
    <div className="doc-tile-scope">
      <p className="doc-tile-scope-label">{t('documents.inferredScope')}</p>
      <ul className="doc-tile-scope-list">
        {packages.map((pkg, index) => (
          <li
            key={`${pkg.trade}-${index}`}
            className="doc-tile-scope-item"
          >
            <span className="package-trade">{pkg.trade}</span>
            <span>{pkg.description}</span>
            {(pkg.quantity ?? pkg.areaSqm) != null && (
              <span className="muted package-qty">
                {pkg.quantity ?? pkg.areaSqm}{' '}
                {pkg.unit ?? (pkg.areaSqm != null ? t('documents.sqm') : '')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DocumentTile({
  projectId,
  document,
  publicView,
  scopePackages = [],
  insight,
  showDelete = false,
  deleting = false,
  onDownload,
  onDelete,
  formatDateTime,
}: DocumentTileProps) {
  const { t } = useTranslation();
  const { formatDocumentCategory } = useAppFormatters();
  const isImage = isImageDocument(document);
  const ext = fileExtension(document.originalName);
  const category = formatDocumentCategory(document.category);

  return (
    <figure className="doc-tile">
      <div className="doc-tile-preview">
        {isImage ? (
          <DocumentImage
            projectId={projectId}
            document={document}
            variant="gallery"
            publicView={publicView}
            onOpen={onDownload}
          />
        ) : (
          <button
            type="button"
            className="doc-file-tile"
            onClick={onDownload}
            title={document.originalName}
          >
            <span className="doc-file-tile-ext" aria-hidden>
              {ext.toUpperCase()}
            </span>
            <span className="doc-file-tile-label">{category}</span>
          </button>
        )}
      </div>

      <figcaption className="doc-tile-caption" title={document.originalName}>
        {document.originalName}
      </figcaption>

      <p className="muted doc-tile-meta">
        {category}
        {' · '}
        {formatFileSize(document.sizeBytes)}
        {document.uploadedAt &&
          ` · ${formatDateTime(document.uploadedAt)}`}
      </p>

      <ScopePackagesList packages={scopePackages} />

      {insight && <DocumentInsightCollapsible insight={insight} />}

      {showDelete && onDelete && (
        <button
          type="button"
          className="text-link doc-remove"
          disabled={deleting}
          onClick={onDelete}
        >
          {deleting ? t('documents.removing') : t('common.remove')}
        </button>
      )}
    </figure>
  );
}

export function OrphanScopePackages({
  packages,
}: {
  packages: BriefScopePackage[];
}) {
  const { t } = useTranslation();

  if (packages.length === 0) {
    return null;
  }

  return (
    <div className="doc-scope-orphans">
      <h3 className="doc-scope-orphans-title">
        {t('documents.generalInferredScope')}
      </h3>
      <p className="muted doc-scope-orphans-hint">
        {t('documents.orphanScopeHint')}
      </p>
      <ul className="doc-tile-scope-list doc-tile-scope-list--standalone">
        {packages.map((pkg, index) => (
          <li key={`${pkg.trade}-${index}`} className="doc-tile-scope-item">
            <span className="package-trade">{pkg.trade}</span>
            <span>{pkg.description}</span>
            {(pkg.quantity ?? pkg.areaSqm) != null && (
              <span className="muted package-qty">
                {pkg.quantity ?? pkg.areaSqm}{' '}
                {pkg.unit ?? (pkg.areaSqm != null ? t('documents.sqm') : '')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
