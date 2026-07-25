import {

  BadRequestException,

  ForbiddenException,

  Inject,

  Injectable,

  NotFoundException,

  forwardRef,

} from '@nestjs/common';

import { BidStatus, DocumentStatus, Prisma, Project, ProjectLinkKind, ProjectStatus, ProjectTag, ProjectType, Tag } from '@prisma/client';
import { IntakeService } from '../intake/intake.service';
import { EstimatesService } from '../estimation/estimates.service';
import { LocationsService } from '../locations/locations.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  isPubliclyDiscoverable,
  isPubliclyViewable,
  canOpenProjectDetail,
  CLIENT_WORKSPACE_STATUSES,
  DISCOVERY_FILTER_HIDDEN,
  DISCOVERY_STATUSES,
} from './projects.constants';
import { shouldHideProjectFromPublicDiscovery } from '../tendering/tender-deadline';
import {
  buildOwnershipFilter,
  buildServiceFilter,
  normalizeOwnershipFilterSlugs,
  normalizeServiceFilterSlugs,
} from './discover-filters';
import { isConvertibleToDesign } from './design-permits.utils';

import {

  buildInitialBrief,

  computeReadinessScore,

  type ProjectBriefV1,

} from './project-brief';

import {

  CreateProjectDto,

  ProjectResponse,

  ProjectTagResponse,

  PublicProjectCard,

  CompleteProjectDto,

  UpdateProjectDto,

} from './projects.types';

import { ProjectReviewsService } from './project-reviews.service';
import type { DiscoverLocationFilter } from './discover.types';
import { ProjectLocalizationService } from '../localization/project-localization.service';
import { normalizeSourceLocale } from '../localization/locale.utils';
import type { SupportedLocale } from '../users/locale.types';
import { DocumentsService } from '../documents/documents.service';
import { TenderInvitesService } from '../supply-directory/tender-invites.service';

const DELETABLE_STATUSES: ProjectStatus[] = [
  ProjectStatus.draft,
  ProjectStatus.intake,
  ProjectStatus.ready_for_estimate,
];



type ProjectWithTags = Project & {

  tags: Array<

    ProjectTag & {

      tag: Tag & { group: { slug: string } | null };

    }

  >;

};



@Injectable()

export class ProjectsService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(forwardRef(() => IntakeService))
    private readonly intakeService: IntakeService,
    private readonly estimatesService: EstimatesService,
    private readonly projectReviews: ProjectReviewsService,
    private readonly locations: LocationsService,
    private readonly projectLocalization: ProjectLocalizationService,
    @Inject(forwardRef(() => DocumentsService))
    private readonly documents: DocumentsService,
    private readonly tenderInvites: TenderInvitesService,
  ) {}



  private mapTags(project: ProjectWithTags): ProjectTagResponse[] {

    return project.tags.map((pt) => ({

      slug: pt.tag.slug,

      label: pt.tag.label,

      source: pt.source,

      groupSlug: pt.tag.group?.slug ?? null,

    }));

  }



  toResponse(
    project: ProjectWithTags,
    estimate: ProjectResponse['estimate'] = null,
  ): ProjectResponse {

    return {

      id: project.id,

      title: project.title,

      description: project.description,

      projectType: project.projectType,

      propertyType: project.propertyType,

      district: project.district,

      locationRegionSlug: project.locationRegionSlug,
      locationAreaSlug: project.locationAreaSlug,
      locationNote: project.locationNote,

      regionCode: project.regionCode,

      status: project.status,

      isHidden: project.isHidden,

      readinessScore: project.readinessScore,

      linkedProjectId: project.linkedProjectId ?? null,
      linkKind: project.linkKind ?? 'none',
      designFeePercent: project.designFeePercent ?? null,
      canConvertToDesign:
        isConvertibleToDesign(project.projectType) &&
        (
          [
            ProjectStatus.draft,
            ProjectStatus.intake,
            ProjectStatus.ready_for_estimate,
            ProjectStatus.estimated,
          ] as ProjectStatus[]
        ).includes(project.status) &&
        project.linkKind !== ProjectLinkKind.design_active &&
        project.linkKind !== ProjectLinkKind.construction_pending,

      brief: project.briefJson as ProjectResponse['brief'],

      clarificationMode: project.clarificationMode,

      clarificationSummary: project.clarificationSummary,

      scopeSummary: project.scopeSummary,

      tags: this.mapTags(project),

      estimate,

      createdAt: project.createdAt.toISOString(),

      updatedAt: project.updatedAt.toISOString(),

    };

  }



  private includeTags() {

    return {

      tags: {

        include: {

          tag: { include: { group: true } },

        },

      },

    } satisfies Prisma.ProjectInclude;

  }



  async listForClient(clientId: string): Promise<ProjectResponse[]> {

    const projects = await this.prisma.project.findMany({

      where: { clientId },

      orderBy: { updatedAt: 'desc' },

      include: this.includeTags(),

    });

    return projects.map((project) => this.toResponse(project, null));

  }

  async listPublic(
    tagSlugs: string[] = [],
    statuses: string[] = [],
    location?: DiscoverLocationFilter,
    serviceSlugs: string[] = [],
    ownershipSlugs: string[] = [],
    viewerLocale?: SupportedLocale,
  ): Promise<PublicProjectCard[]> {
    return this.listDiscover(
      null,
      tagSlugs,
      statuses,
      location,
      serviceSlugs,
      ownershipSlugs,
      viewerLocale,
    );
  }

  async listDiscover(
    userId: string | null,
    tagSlugs: string[] = [],
    statuses: string[] = [],
    location?: DiscoverLocationFilter,
    serviceSlugs: string[] = [],
    ownershipSlugs: string[] = [],
    viewerLocale?: SupportedLocale,
  ): Promise<PublicProjectCard[]> {
    const includesHidden = statuses.includes(DISCOVERY_FILTER_HIDDEN);
    const includesCompleted = statuses.includes(ProjectStatus.completed);
    const statusFilters = statuses.filter(
      (status) =>
        status !== DISCOVERY_FILTER_HIDDEN &&
        status !== ProjectStatus.completed,
    ) as ProjectStatus[];

    if (includesHidden) {
      if (!userId) {
        return [];
      }
      return this.listHiddenForClient(
        userId,
        tagSlugs,
        location,
        serviceSlugs,
        ownershipSlugs,
        viewerLocale,
      );
    }

    const participantProjectIds = userId
      ? await this.loadParticipantProjectIds(userId)
      : new Set<string>();

    const tagFilter: Prisma.ProjectWhereInput | undefined =
      tagSlugs.length > 0
        ? {
            tags: {
              some: {
                tag: { slug: { in: tagSlugs } },
              },
            },
          }
        : undefined;

    const orClauses: Prisma.ProjectWhereInput[] = [];

    if (statusFilters.length > 0) {
      const publicAllowed = statusFilters.filter((status): status is ProjectStatus =>
        DISCOVERY_STATUSES.includes(status),
      );
      if (publicAllowed.length > 0) {
        orClauses.push({
          status: { in: publicAllowed },
          isHidden: false,
        });
      }

      if (userId) {
        const ownAllowed = statusFilters.filter((status): status is ProjectStatus =>
          CLIENT_WORKSPACE_STATUSES.includes(status),
        );
        if (ownAllowed.length > 0) {
          orClauses.push({
            clientId: userId,
            status: { in: ownAllowed },
            isHidden: false,
          });
        }
      }
    }

    if (orClauses.length === 0 && !includesCompleted) {
      orClauses.push({
        status: { in: DISCOVERY_STATUSES },
        isHidden: false,
      });
      if (userId) {
        orClauses.push({
          clientId: userId,
          status: { in: CLIENT_WORKSPACE_STATUSES },
          isHidden: false,
        });
      }
    }

    if (includesCompleted) {
      if (!userId) {
        if (orClauses.length === 0) {
          return [];
        }
      } else {
        orClauses.push({
          status: ProjectStatus.completed,
          isHidden: false,
          OR: [
            { clientId: userId },
            { id: { in: [...participantProjectIds] } },
          ],
        });
      }
    }

    if (orClauses.length === 0) {
      return [];
    }

    const normalizedServices = normalizeServiceFilterSlugs(serviceSlugs);
    const normalizedOwnership = normalizeOwnershipFilterSlugs(ownershipSlugs);
    const serviceFilter = buildServiceFilter(normalizedServices);
    const ownershipFilter = buildOwnershipFilter(normalizedOwnership);

    const where = this.buildDiscoverWhere(
      orClauses,
      tagFilter,
      location,
      serviceFilter,
      ownershipFilter,
    );

    const projects = await this.prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        ...this.includeTags(),
        tender: { select: { status: true, closesAt: true } },
      },
    });

    const now = new Date();
    const visibleProjects = projects.filter((project) => {
      if (project.isHidden) {
        return false;
      }
      if (project.status === ProjectStatus.completed) {
        return true;
      }
      if (!project.tender) {
        return true;
      }
      const deadlinePassed = shouldHideProjectFromPublicDiscovery({
        tenderStatus: project.tender.status,
        closesAt: project.tender.closesAt,
        now,
      });
      if (!deadlinePassed) {
        return true;
      }
      return this.canViewExpiredDiscoverProject(
        project,
        userId,
        participantProjectIds,
      );
    });

    return this.mapPublicProjectCards(visibleProjects, viewerLocale);
  }

  private buildDiscoverWhere(
    orClauses: Prisma.ProjectWhereInput[],
    tagFilter: Prisma.ProjectWhereInput | undefined,
    location?: DiscoverLocationFilter,
    serviceFilter?: Prisma.ProjectWhereInput,
    ownershipFilter?: Prisma.ProjectWhereInput,
  ): Prisma.ProjectWhereInput {
    const andParts: Prisma.ProjectWhereInput[] = [{ OR: orClauses }];

    if (tagFilter) {
      andParts.push(tagFilter);
    }

    if (serviceFilter) {
      andParts.push(serviceFilter);
    }

    if (ownershipFilter) {
      andParts.push(ownershipFilter);
    }

    const locationFilter = this.buildLocationFilter(location);
    if (locationFilter) {
      andParts.push(locationFilter);
    }

    return andParts.length === 1 ? andParts[0] : { AND: andParts };
  }

  private buildLocationFilter(
    location?: DiscoverLocationFilter,
  ): Prisma.ProjectWhereInput | undefined {
    const regionSlug = location?.regionSlug?.trim();
    if (!regionSlug) {
      return undefined;
    }

    this.locations.assertRegionSlug(regionSlug);
    const areaSlug = location?.areaSlug?.trim();
    if (areaSlug) {
      this.locations.assertAreaSlug(regionSlug, areaSlug);
      return {
        locationRegionSlug: regionSlug,
        AND: {
          OR: [{ locationAreaSlug: areaSlug }, { locationAreaSlug: null }],
        },
      };
    }

    return { locationRegionSlug: regionSlug };
  }

  private async listHiddenForClient(
    clientId: string,
    tagSlugs: string[],
    location?: DiscoverLocationFilter,
    serviceSlugs: string[] = [],
    ownershipSlugs: string[] = [],
    viewerLocale?: SupportedLocale,
  ): Promise<PublicProjectCard[]> {
    const andParts: Prisma.ProjectWhereInput[] = [
      { clientId, isHidden: true },
    ];

    const locationFilter = this.buildLocationFilter(location);
    if (locationFilter) {
      andParts.push(locationFilter);
    }

    if (tagSlugs.length > 0) {
      andParts.push({
        tags: {
          some: {
            tag: { slug: { in: tagSlugs } },
          },
        },
      });
    }

    const normalizedServices = normalizeServiceFilterSlugs(serviceSlugs);
    const normalizedOwnership = normalizeOwnershipFilterSlugs(ownershipSlugs);
    const serviceFilter = buildServiceFilter(normalizedServices);
    const ownershipFilter = buildOwnershipFilter(normalizedOwnership);

    if (serviceFilter) {
      andParts.push(serviceFilter);
    }

    if (ownershipFilter) {
      andParts.push(ownershipFilter);
    }

    const where: Prisma.ProjectWhereInput =
      andParts.length === 1 ? andParts[0] : { AND: andParts };

    const projects = await this.prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: this.includeTags(),
    });

    return this.mapPublicProjectCards(projects, viewerLocale);
  }

  private async mapPublicProjectCards(
    projects: Array<
      ProjectWithTags & {
        tender?: { status: string; closesAt: Date | null } | null;
      }
    >,
    viewerLocale?: SupportedLocale,
  ): Promise<PublicProjectCard[]> {
    const projectIds = projects.map((p) => p.id);
    const coverByProject = await this.loadCoverUrls(projectIds);

    return Promise.all(
      projects.map(async (project) => {
        let title = project.title;
        let description = project.description;

        if (viewerLocale) {
          const localized = await this.projectLocalization.localizePublicCard(
            project,
            viewerLocale,
          );
          title = localized.title;
          description = localized.description;
          if (localized.cacheMiss) {
            this.projectLocalization.scheduleWarmProjectTranslations(project.id);
          }
        }

        return {
          id: project.id,
          title,
          description,
          projectType: project.projectType,
          district: project.district,
          locationRegionSlug: project.locationRegionSlug,
          locationAreaSlug: project.locationAreaSlug,
          locationNote: project.locationNote,
          regionCode: project.regionCode,
          status: project.status,
          isHidden: project.isHidden,
          readinessScore: project.readinessScore,
          tags: this.mapTags(project).map((t) => ({
            slug: t.slug,
            label: t.label,
          })),
          coverImageUrl: coverByProject.get(project.id) ?? null,
          updatedAt: project.updatedAt.toISOString(),
          applicationsDeadlinePassed:
            this.shouldShowApplicationDeadlineWarning(project) &&
            this.isApplicationsDeadlinePassedForProject(project),
        };
      }),
    );
  }

  private shouldShowApplicationDeadlineWarning(project: {
    status: ProjectStatus;
  }): boolean {
    return (
      project.status !== ProjectStatus.awarded &&
      project.status !== ProjectStatus.active &&
      project.status !== ProjectStatus.completed
    );
  }

  private canViewExpiredDiscoverProject(
    project: { id: string; clientId: string },
    userId: string | null,
    participantProjectIds: Set<string>,
  ): boolean {
    if (!userId) {
      return false;
    }
    if (project.clientId === userId) {
      return true;
    }
    return participantProjectIds.has(project.id);
  }

  private isApplicationsDeadlinePassedForProject(project: {
    tender?: { status: string; closesAt: Date | null } | null;
  }): boolean {
    if (!project.tender) {
      return false;
    }
    return shouldHideProjectFromPublicDiscovery({
      tenderStatus: project.tender.status,
      closesAt: project.tender.closesAt,
    });
  }

  private async loadParticipantProjectIds(
    userId: string,
  ): Promise<Set<string>> {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      return new Set();
    }

    const bids = await this.prisma.bid.findMany({
      where: {
        contractorId: profile.id,
        status: { not: 'withdrawn' },
      },
      select: {
        tender: { select: { projectId: true } },
      },
    });

    return new Set(bids.map((bid) => bid.tender.projectId));
  }

  private async userIsContractor(userId: string): Promise<boolean> {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
      select: { id: true, kind: true },
    });
    return Boolean(profile && profile.kind === 'contractor');
  }

  private async userIsDesigner(userId: string): Promise<boolean> {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
      select: { id: true, kind: true },
    });
    return Boolean(profile && profile.kind === 'designer');
  }

  private async userIsAwardedContractor(
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      return false;
    }

    const selectedBid = await this.prisma.bid.findFirst({
      where: {
        contractorId: profile.id,
        status: BidStatus.selected,
        tender: { projectId },
      },
      select: { id: true },
    });
    if (selectedBid) {
      return true;
    }

    // Fallback: tender points at this contractor's bid even if status lag.
    const awarded = await this.prisma.tender.findFirst({
      where: {
        projectId,
        awardedBidId: { not: null },
        awardedBid: { contractorId: profile.id },
      },
      select: { id: true },
    });
    return Boolean(awarded);
  }

  /**
   * Enforce open-card ACL. Cards may be listed publicly; detail requires
   * matching supply-side role (Accepting bids) or owner/awarded/admin.
   */
  async assertCanOpenProject(
    projectId: string,
    userId: string | null,
    options?: {
      isAdmin?: boolean;
      isContractorRole?: boolean;
      isDesignerRole?: boolean;
      inviteToken?: string | null;
    },
  ): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tender: { select: { status: true, closesAt: true, awardedBidId: true } },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isAdmin = Boolean(options?.isAdmin);
    const isOwner = Boolean(userId && project.clientId === userId);

    if (isAdmin) {
      return project;
    }

    if (isOwner) {
      if (
        !isPubliclyViewable(project.status) &&
        !CLIENT_WORKSPACE_STATUSES.includes(project.status)
      ) {
        throw new NotFoundException('Project not found');
      }
      return project;
    }

    const hasValidInvite = await this.tenderInvites.assertValidInviteToken(
      projectId,
      options?.inviteToken,
    );
    if (hasValidInvite && project.status === ProjectStatus.in_tender) {
      return project;
    }

    if (!isPubliclyViewable(project.status)) {
      throw new NotFoundException('Project not found');
    }

    const isContractor =
      Boolean(options?.isContractorRole) ||
      (userId ? await this.userIsContractor(userId) : false);
    const isDesigner =
      Boolean(options?.isDesignerRole) ||
      (userId ? await this.userIsDesigner(userId) : false);
    const isAwardedContractor = userId
      ? await this.userIsAwardedContractor(userId, projectId)
      : false;

    if (
      !canOpenProjectDetail(
        project.status,
        {
          isOwner: false,
          isAdmin: false,
          isContractor,
          isDesigner,
          isAwardedContractor,
        },
        project.projectType,
      )
    ) {
      throw new NotFoundException('Project not found');
    }

    const isSupplySide =
      (isContractor && project.projectType !== ProjectType.design) ||
      (isDesigner && project.projectType === ProjectType.design);

    // Hidden projects stay off the public list but may still open for allowed roles.
    if (
      project.isHidden &&
      !isAwardedContractor &&
      !(isSupplySide && project.status === ProjectStatus.in_tender)
    ) {
      throw new NotFoundException('Project not found');
    }

    // Past applications deadline: keep listing hide for guests; supply side
    // may still open Accepting bids cards; restricted stages use award ACL above.
    if (
      project.status === ProjectStatus.in_tender &&
      project.tender &&
      shouldHideProjectFromPublicDiscovery({
        tenderStatus: project.tender.status,
        closesAt: project.tender.closesAt,
      }) &&
      !isSupplySide
    ) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async getPublicById(
    projectId: string,
    userId: string | null = null,
    viewerLocale?: SupportedLocale,
    options?: {
      isAdmin?: boolean;
      isContractorRole?: boolean;
      isDesignerRole?: boolean;
      inviteToken?: string | null;
    },
  ): Promise<ProjectResponse> {
    const project = await this.assertCanOpenProject(projectId, userId, options);

    const withTags = await this.prisma.project.findUnique({
      where: { id: project.id },
      include: this.includeTags(),
    });
    if (!withTags) {
      throw new NotFoundException('Project not found');
    }

    const response = await this.buildPublicProjectResponse(withTags, viewerLocale);
    if (options?.inviteToken?.trim()) {
      const valid = await this.tenderInvites.assertValidInviteToken(
        projectId,
        options.inviteToken,
      );
      if (valid && (!userId || project.clientId !== userId)) {
        return {
          ...response,
          guestInviteAccess: {
            canView: true,
            canSubmitProposal: false,
          },
        };
      }
    }
    return response;
  }

  async getPublicByIdForParticipant(
    userId: string,
    projectId: string,
    viewerLocale?: SupportedLocale,
    options?: { isAdmin?: boolean; isContractorRole?: boolean; isDesignerRole?: boolean },
  ): Promise<ProjectResponse> {
    // Same open ACL as public detail (supply side for in_tender, awarded later).
    return this.getPublicById(projectId, userId, viewerLocale, {
      isAdmin: options?.isAdmin,
      isContractorRole: options?.isContractorRole ?? true,
      isDesignerRole: options?.isDesignerRole ?? true,
    });
  }

  private async buildPublicProjectResponse(
    project: Parameters<ProjectsService['toResponse']>[0] & {
      sourceLocale?: string;
    },
    viewerLocale?: SupportedLocale,
  ): Promise<ProjectResponse> {
    const response = this.toResponse(project, null);

    const sanitized = {
      ...response,
      brief: this.sanitizeBriefForPublic(response.brief),
    };

    return this.applyViewerLocale(sanitized, project, viewerLocale);
  }

  private async applyViewerLocale(
    response: ProjectResponse,
    project: { id: string; sourceLocale?: string },
    viewerLocale?: SupportedLocale,
  ): Promise<ProjectResponse> {
    const sourceLocale = normalizeSourceLocale(project.sourceLocale);
    if (!viewerLocale || viewerLocale === sourceLocale) {
      return response;
    }

    const { response: localized, cacheMiss } =
      await this.projectLocalization.localizeProjectResponse(
        response,
        sourceLocale,
        viewerLocale,
      );

    if (cacheMiss) {
      this.projectLocalization.scheduleWarmProjectTranslations(project.id);
    }

    return localized;
  }

  async getCoverUrlsForProjects(
    projectIds: string[],
  ): Promise<Map<string, string>> {
    return this.loadCoverUrls(projectIds);
  }

  private async loadCoverUrls(
    projectIds: string[],
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (projectIds.length === 0 || !this.storage.isConfigured()) {
      return result;
    }

    const docs = await this.prisma.document.findMany({
      where: {
        projectId: { in: projectIds },
        status: DocumentStatus.uploaded,
        contentType: { startsWith: 'image/' },
      },
      orderBy: { uploadedAt: 'asc' },
    });

    const seen = new Set<string>();
    for (const doc of docs) {
      if (seen.has(doc.projectId)) continue;
      seen.add(doc.projectId);
      try {
        const storageKey = doc.thumbnailStorageKey ?? doc.storageKey;
        if (!doc.thumbnailStorageKey) {
          this.documents.scheduleThumbnailGeneration(doc);
        }
        const { downloadUrl } = await this.storage.createPresignedDownload(
          storageKey,
        );
        result.set(doc.projectId, downloadUrl);
      } catch {
        // skip broken cover
      }
    }

    return result;
  }

  private sanitizeBriefForPublic(
    brief: ProjectResponse['brief'],
  ): ProjectResponse['brief'] {
    if (!brief?.ai) {
      return brief;
    }

    const { intake: _intake, ...aiPublic } = brief.ai;
    return {
      ...brief,
      ai: aiPublic,
    };
  }

  async createForClient(

    clientId: string,

    dto: CreateProjectDto,

    sourceLocale: SupportedLocale = 'en',

  ): Promise<ProjectResponse> {

    const title = dto.title.trim();

    if (title.length < 3) {

      throw new BadRequestException('Title must be at least 3 characters');

    }



    const brief = buildInitialBrief({

      description: dto.description,

      propertyType: dto.propertyType ?? null,

      originalNarrative: dto.description,

    });

    const location = this.locations.normalizeProjectLocation({
      locationRegionSlug: dto.locationRegionSlug,
      locationAreaSlug: dto.locationAreaSlug,
      locationNote: dto.locationNote,
    });



    const project = await this.prisma.project.create({

      data: {

        clientId,

        title,

        description: dto.description?.trim() || null,

        projectType: dto.projectType ?? ProjectType.other,

        propertyType: dto.propertyType ?? null,

        district: location.district,

        locationRegionSlug: location.locationRegionSlug,
        locationAreaSlug: location.locationAreaSlug,
        locationNote: location.locationNote,

        regionCode: location.regionCode,

        clarificationMode:
          dto.clarificationMode ?? undefined,

        sourceLocale,

        readinessScore: computeReadinessScore({

          title,

          description: dto.description,

          projectType: dto.projectType ?? ProjectType.other,

          propertyType: dto.propertyType ?? null,

          district: location.district,

          tagCount: 0,

          brief,

        }),

        briefJson: brief as unknown as Prisma.InputJsonValue,

      },

      include: this.includeTags(),

    });



    await this.intakeService.runInitialIntakeForProject(project.id);



    return this.getForClient(clientId, project.id);

  }



  async getForClient(

    clientId: string,

    projectId: string,

    viewerLocale?: SupportedLocale,

  ): Promise<ProjectResponse> {

    const project = await this.prisma.project.findUnique({

      where: { id: projectId },

      include: this.includeTags(),

    });



    if (!project) {

      throw new NotFoundException('Project not found');

    }



    if (project.clientId !== clientId) {

      throw new ForbiddenException('Access denied');

    }



    const estimate = await this.prisma.estimate.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    const response = this.toResponse(
      project,
      estimate ? this.estimatesService.toResponse(estimate) : null,
    );

    return this.applyViewerLocale(response, project, viewerLocale);
  }

  /**
   * Owner may correct card title/description at any status.
   * Does not rewrite frozen KP snapshots on submitted bids.
   */
  async updateCardForClient(
    clientId: string,
    projectId: string,
    dto: UpdateProjectDto,
    viewerLocale?: SupportedLocale,
  ): Promise<ProjectResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: this.includeTags(),
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }

    if (dto.title === undefined && dto.description === undefined) {
      throw new BadRequestException('Nothing to update');
    }

    const nextTitle =
      dto.title !== undefined ? dto.title.trim() : project.title;
    if (nextTitle.length < 3) {
      throw new BadRequestException('Title must be at least 3 characters');
    }
    if (nextTitle.length > 200) {
      throw new BadRequestException('Title must be at most 200 characters');
    }

    let nextDescription = project.description;
    if (dto.description !== undefined) {
      if (dto.description === null) {
        nextDescription = null;
      } else {
        const trimmed = dto.description.trim();
        nextDescription = trimmed.length > 0 ? trimmed : null;
      }
    }
    if (nextDescription && nextDescription.length > 20_000) {
      throw new BadRequestException(
        'Description must be at most 20000 characters',
      );
    }

    const brief = (project.briefJson as ProjectBriefV1 | null) ?? buildInitialBrief({
      description: nextDescription ?? undefined,
      propertyType: project.propertyType,
      originalNarrative: nextDescription ?? undefined,
    });

    const readinessScore = computeReadinessScore({
      title: nextTitle,
      description: nextDescription,
      projectType: project.projectType,
      propertyType: project.propertyType,
      district: project.district,
      tagCount: project.tags.length,
      brief,
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        title: nextTitle,
        description: nextDescription,
        readinessScore,
        ...(project.status === ProjectStatus.pending
          ? {
              status:
                project.statusBeforePending &&
                project.statusBeforePending !== ProjectStatus.pending
                  ? project.statusBeforePending
                  : ProjectStatus.estimated,
              statusBeforePending: null,
              isHidden: false,
              linkKind: ProjectLinkKind.none,
            }
          : {}),
      },
    });

    this.projectLocalization.scheduleWarmProjectTranslations(projectId);

    return this.getForClient(clientId, projectId, viewerLocale);
  }

  async deleteForClient(clientId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { documents: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }

    if (!DELETABLE_STATUSES.includes(project.status)) {
      throw new BadRequestException(
        'Project cannot be deleted after estimation or tendering has started',
      );
    }

    if (this.storage.isConfigured()) {
      for (const doc of project.documents) {
        try {
          await this.storage.deleteObject(doc.storageKey);
        } catch {
          // Best-effort S3 cleanup
        }
      }
    }

    await this.prisma.project.delete({ where: { id: projectId } });
  }

  async hideForClient(clientId: string, projectId: string): Promise<ProjectResponse> {
    const project = await this.assertClientProject(clientId, projectId);
    if (project.isHidden) {
      return this.getForClient(clientId, projectId);
    }
    if (project.status === ProjectStatus.completed) {
      throw new BadRequestException('Completed projects cannot be hidden');
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { isHidden: true },
      include: this.includeTags(),
    });

    return this.getForClient(clientId, updated.id);
  }

  async unhideForClient(
    clientId: string,
    projectId: string,
  ): Promise<ProjectResponse> {
    await this.assertClientProject(clientId, projectId);

    await this.prisma.project.update({
      where: { id: projectId },
      data: { isHidden: false },
    });

    return this.getForClient(clientId, projectId);
  }

  async closeForClient(
    clientId: string,
    projectId: string,
    dto: CompleteProjectDto,
  ): Promise<ProjectResponse> {
    await this.projectReviews.completeProject(clientId, projectId, dto);
    return this.getForClient(clientId, projectId);
  }

  /**
   * Convert a construction/modernization/repair card into Design & Permits.
   * Clones the current construction state into a linked Pending sibling.
   */
  async convertToDesign(
    clientId: string,
    projectId: string,
    viewerLocale?: SupportedLocale,
  ): Promise<ProjectResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tags: true,
        documents: {
          where: { status: { not: DocumentStatus.deleted } },
        },
        estimates: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }
    if (!isConvertibleToDesign(project.projectType)) {
      throw new BadRequestException(
        'Only construction, modernization, or repair projects can convert to Design & Permits',
      );
    }
    if (
      project.status === ProjectStatus.in_tender ||
      project.status === ProjectStatus.awarded ||
      project.status === ProjectStatus.active ||
      project.status === ProjectStatus.completed ||
      project.status === ProjectStatus.pending
    ) {
      throw new BadRequestException(
        'Cannot convert after the tender starts or while the project is pending',
      );
    }
    if (
      project.linkKind === ProjectLinkKind.design_active ||
      project.linkKind === ProjectLinkKind.construction_pending ||
      project.linkedProjectId
    ) {
      throw new BadRequestException('Project is already linked to a design conversion');
    }

    const statusBeforePending = project.status;
    const brief = (project.briefJson ?? {}) as unknown as ProjectBriefV1;

    const snapshot = await this.prisma.$transaction(async (tx) => {
      const clone = await tx.project.create({
        data: {
          clientId: project.clientId,
          title: project.title,
          description: project.description,
          projectType: project.projectType,
          propertyType: project.propertyType,
          propertyOwnershipForm: project.propertyOwnershipForm,
          district: project.district,
          locationRegionSlug: project.locationRegionSlug,
          locationAreaSlug: project.locationAreaSlug,
          locationNote: project.locationNote,
          regionCode: project.regionCode,
          status: ProjectStatus.pending,
          statusBeforePending,
          isHidden: true,
          readinessScore: project.readinessScore,
          briefJson: project.briefJson ?? Prisma.JsonNull,
          clarificationMode: project.clarificationMode,
          clarificationSummary: project.clarificationSummary,
          scopeSummary: project.scopeSummary,
          sourceLocale: project.sourceLocale,
          tenderContractTermsJson: project.tenderContractTermsJson ?? Prisma.JsonNull,
          linkKind: ProjectLinkKind.construction_pending,
        },
      });

      if (project.tags.length) {
        await tx.projectTag.createMany({
          data: project.tags.map((tag) => ({
            projectId: clone.id,
            tagId: tag.tagId,
            source: tag.source,
          })),
        });
      }

      // Documents stay on the active design card; snapshot keeps brief/estimate/tags.

      for (const estimate of project.estimates) {
        await tx.estimate.create({
          data: {
            projectId: clone.id,
            version: estimate.version,
            type: estimate.type,
            currency: estimate.currency,
            totalsJson: estimate.totalsJson as Prisma.InputJsonValue,
            linesJson: estimate.linesJson as Prisma.InputJsonValue,
            confidence: estimate.confidence,
            disclaimer: estimate.disclaimer,
          },
        });
      }

      const designBrief: ProjectBriefV1 = {
        ...brief,
        design: {
          ...(brief.design ?? {}),
          needsDesignTender: true,
        },
      };

      await tx.project.update({
        where: { id: project.id },
        data: {
          projectType: ProjectType.design,
          linkKind: ProjectLinkKind.design_active,
          linkedProjectId: clone.id,
          briefJson: designBrief as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.project.update({
        where: { id: clone.id },
        data: { linkedProjectId: project.id },
      });

      return clone;
    });

    const tagSlugs = project.tags.map((t) => t.tagId);
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagSlugs } },
      select: { slug: true },
    });
    const slugs = tags.map((t) => t.slug);

    if (project.estimates.length > 0) {
      const applied = await this.estimatesService.applyDesignFeeFromExisting(
        project.id,
        project.propertyType,
        slugs,
      );
      await this.prisma.project.update({
        where: { id: project.id },
        data: {
          designFeePercent: applied.percent,
          baseConstructionTotalsJson:
            applied.baseTotals as unknown as Prisma.InputJsonValue,
          status: ProjectStatus.estimated,
        },
      });
    } else {
      await this.estimatesService.generateAndStore(project.id);
    }

    void snapshot;
    return this.getForClient(clientId, projectId, viewerLocale);
  }

  /**
   * Resume a Pending construction snapshot after Design conversion.
   */
  async resumePending(
    clientId: string,
    projectId: string,
    viewerLocale?: SupportedLocale,
  ): Promise<ProjectResponse> {
    const project = await this.assertClientProject(clientId, projectId);
    if (project.status !== ProjectStatus.pending) {
      throw new BadRequestException('Project is not pending');
    }

    const nextStatus =
      project.statusBeforePending &&
      project.statusBeforePending !== ProjectStatus.pending
        ? project.statusBeforePending
        : ProjectStatus.estimated;

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: nextStatus,
        statusBeforePending: null,
        isHidden: false,
        linkKind: ProjectLinkKind.none,
      },
    });

    return this.getForClient(clientId, projectId, viewerLocale);
  }

  private async assertClientProject(
    clientId: string,
    projectId: string,
  ): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }

    return project;
  }
}
