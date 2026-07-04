'use client';

import Link from 'next/link';
import { formatThb } from '@/lib/estimate';
import {
  formatProjectStatus,
  formatProjectType,
  type ProjectType,
} from '@/lib/projects';
import {
  formatContractorParticipationLabel,
  type ContractorApplicationItem,
} from '@/lib/tendering';

interface ContractorApplicationTileProps {
  application: ContractorApplicationItem;
}

export function ContractorApplicationTile({
  application,
}: ContractorApplicationTileProps) {
  const participationLabel = formatContractorParticipationLabel(application);
  const excerpt =
    application.description && application.description.length > 120
      ? `${application.description.slice(0, 117)}…`
      : application.description;

  return (
    <Link
      href={`/projects/${application.projectId}`}
      className="project-tile project-tile-participating"
    >
      <div className="project-tile-media">
        {application.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={application.coverImageUrl}
            alt=""
            className="project-tile-image"
            loading="lazy"
          />
        ) : (
          <div className="project-tile-placeholder" aria-hidden>
            <span>
              {formatProjectType(application.projectType as ProjectType)}
            </span>
          </div>
        )}
        <span className="project-tile-status">
          {formatProjectStatus(application.projectStatus)}
        </span>
        <span className="project-tile-contractor-badge">{participationLabel}</span>
      </div>
      <div className="project-tile-body">
        <h3 className="project-tile-title">{application.projectTitle}</h3>
        <p className="project-tile-meta muted">
          {formatProjectType(application.projectType as ProjectType)}
          {application.projectDistrict
            ? ` · ${application.projectDistrict}`
            : ''}
        </p>
        {application.bidAmount && (
          <p className="project-tile-participation muted">
            Bid {formatThb(Number(application.bidAmount))}
          </p>
        )}
        {excerpt && <p className="project-tile-description">{excerpt}</p>}
      </div>
    </Link>
  );
}
