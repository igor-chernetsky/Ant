import {

  BadRequestException,

  ForbiddenException,

  Inject,

  Injectable,

  NotFoundException,

  forwardRef,

} from '@nestjs/common';

import { BidStatus, ContractStatus, DocumentStatus, Prisma, Project, ProjectLinkKind, ProjectStatus, ProjectTag, ProjectType, Tag } from '@prisma/client';
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
import { isApplicationsDeadlinePassed } from '../tendering/tender-deadline';
import {
  buildProjectTrackFilter,
  buildPropertyTypeFilter,
  normalizePropertyTypeFilterSlugs,
  type ProjectTrack,
} from './discover-filters';
import {
  canEditConstructionProjectType,
  canClientConvertToDesign,
} from './design-permits.utils';
import {
  normalizeConstructionProjectType,
  SELECTABLE_CONSTRUCTION_PROJECT_TYPES,
  suggestProjectTypeFromText,
} from './project-type-inference';

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

  PublicProjectEstimateSummary,

  PublicProjectListPage,

  DISCOVER_PAGE_SIZE,

  DISCOVER_PAGE_SIZE_MAX,

  CompleteProjectDto,
  ConfirmProjectCompletionDto,

  UpdateProjectDto,

  AdminProjectListItem,
  AdminProjectListPage,
  AdminProjectListQuery,

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

type DiscoverViewerContext = {
  userId: string | null;
  isAdmin: boolean;
  isContractor: boolean;
  isDesigner: boolean;
  awardedProjectIds: Set<string>;
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
    tenderBidCount = 0,
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
      canConvertToDesign: canClientConvertToDesign({
        projectType: project.projectType,
        status: project.status,
        linkKind: project.linkKind ?? ProjectLinkKind.none,
        linkedProjectId: project.linkedProjectId,
        tenderBidCount,
      }),

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

    return projects.map((project) =>
      this.toResponse(project, null),
    );

  }

  async listPublic(
    tagSlugs: string[] = [],
    statuses: string[] = [],
    location?: DiscoverLocationFilter,
    projectTrack: ProjectTrack | null = null,
    propertyTypeSlugs: string[] = [],
    viewerLocale?: SupportedLocale,
    pagination?: { limit?: number; offset?: number },
  ): Promise<PublicProjectListPage> {
    return this.listDiscover(
      null,
      tagSlugs,
      statuses,
      location,
      projectTrack,
      propertyTypeSlugs,
      viewerLocale,
      undefined,
      pagination,
    );
  }

  async listDiscover(
    userId: string | null,
    tagSlugs: string[] = [],
    statuses: string[] = [],
    location?: DiscoverLocationFilter,
    projectTrack: ProjectTrack | null = null,
    propertyTypeSlugs: string[] = [],
    viewerLocale?: SupportedLocale,
    viewerOptions?: { isAdmin?: boolean },
    pagination?: { limit?: number; offset?: number },
  ): Promise<PublicProjectListPage> {
    const { limit, offset } = normalizeDiscoverPagination(pagination);
    const emptyPage = (): PublicProjectListPage => ({
      items: [],
      total: 0,
      limit,
      offset,
      hasMore: false,
    });

    const includesHidden = statuses.includes(DISCOVERY_FILTER_HIDDEN);
    const includesCompleted = statuses.includes(ProjectStatus.completed);
    const statusFilters = statuses.filter(
      (status) =>
        status !== DISCOVERY_FILTER_HIDDEN &&
        status !== ProjectStatus.completed,
    ) as ProjectStatus[];

    if (includesHidden) {
      if (!userId) {
        return emptyPage();
      }
      return this.listHiddenForClient(
        userId,
        tagSlugs,
        location,
        projectTrack,
        propertyTypeSlugs,
        viewerLocale,
        { limit, offset },
      );
    }

    const participantProjectIds = userId
      ? await this.loadParticipantProjectIds(userId)
      : new Set<string>();
    const viewer = await this.resolveDiscoverViewer(
      userId,
      viewerOptions?.isAdmin ?? false,
    );

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
          return emptyPage();
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
      return emptyPage();
    }

    const trackFilter = buildProjectTrackFilter(projectTrack);
    const normalizedPropertyTypes =
      normalizePropertyTypeFilterSlugs(propertyTypeSlugs);
    const propertyTypeFilter = buildPropertyTypeFilter(normalizedPropertyTypes);

    const where = this.buildDiscoverWhere(
      orClauses,
      trackFilter,
      tagFilter,
      location,
      propertyTypeFilter,
    );

    const [total, projects] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          ...this.includeTags(),
          tender: { select: { status: true, closesAt: true } },
        },
      }),
    ]);

    const items = await this.mapPublicProjectCards(
      projects,
      viewerLocale,
      viewer,
    );

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  private buildDiscoverWhere(
    orClauses: Prisma.ProjectWhereInput[],
    projectTrackFilter: Prisma.ProjectWhereInput | undefined,
    tagFilter: Prisma.ProjectWhereInput | undefined,
    location?: DiscoverLocationFilter,
    propertyTypeFilter?: Prisma.ProjectWhereInput,
  ): Prisma.ProjectWhereInput {
    const andParts: Prisma.ProjectWhereInput[] = [{ OR: orClauses }];

    if (projectTrackFilter) {
      andParts.push(projectTrackFilter);
    }

    if (tagFilter) {
      andParts.push(tagFilter);
    }

    if (propertyTypeFilter) {
      andParts.push(propertyTypeFilter);
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
    projectTrack: ProjectTrack | null = null,
    propertyTypeSlugs: string[] = [],
    viewerLocale?: SupportedLocale,
    pagination: { limit: number; offset: number } = {
      limit: DISCOVER_PAGE_SIZE,
      offset: 0,
    },
  ): Promise<PublicProjectListPage> {
    const { limit, offset } = pagination;
    const andParts: Prisma.ProjectWhereInput[] = [
      { clientId, isHidden: true },
    ];
    const trackFilter = buildProjectTrackFilter(projectTrack);
    if (trackFilter) {
      andParts.push(trackFilter);
    }

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

    const normalizedPropertyTypes =
      normalizePropertyTypeFilterSlugs(propertyTypeSlugs);
    const propertyTypeFilter = buildPropertyTypeFilter(normalizedPropertyTypes);

    if (propertyTypeFilter) {
      andParts.push(propertyTypeFilter);
    }

    const where: Prisma.ProjectWhereInput =
      andParts.length === 1 ? andParts[0] : { AND: andParts };

    const [total, projects] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
        include: this.includeTags(),
      }),
    ]);

    const viewer = await this.resolveDiscoverViewer(clientId, false);
    const items = await this.mapPublicProjectCards(
      projects,
      viewerLocale,
      viewer,
    );

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  private async resolveDiscoverViewer(
    userId: string | null,
    isAdmin = false,
  ): Promise<DiscoverViewerContext> {
    if (!userId) {
      return {
        userId: null,
        isAdmin,
        isContractor: false,
        isDesigner: false,
        awardedProjectIds: new Set(),
      };
    }

    const [isContractor, isDesigner, awardedProjectIds] = await Promise.all([
      this.userIsContractor(userId),
      this.userIsDesigner(userId),
      this.loadAwardedProjectIds(userId),
    ]);

    return {
      userId,
      isAdmin,
      isContractor,
      isDesigner,
      awardedProjectIds,
    };
  }

  private async loadAwardedProjectIds(userId: string): Promise<Set<string>> {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      return new Set();
    }

    const [selectedBids, awardedTenders] = await Promise.all([
      this.prisma.bid.findMany({
        where: {
          contractorId: profile.id,
          status: BidStatus.selected,
        },
        select: { tender: { select: { projectId: true } } },
      }),
      this.prisma.tender.findMany({
        where: { awardedBid: { contractorId: profile.id } },
        select: { projectId: true },
      }),
    ]);

    return new Set([
      ...selectedBids.map((bid) => bid.tender.projectId),
      ...awardedTenders.map((tender) => tender.projectId),
    ]);
  }

  private canViewerOpenDiscoverCard(
    project: Project & {
      tender?: { status: string; closesAt: Date | null } | null;
    },
    viewer: DiscoverViewerContext,
  ): boolean {
    const isOwner = Boolean(
      viewer.userId && project.clientId === viewer.userId,
    );
    const isAwardedContractor = viewer.awardedProjectIds.has(project.id);

    return canOpenProjectDetail(
      project.status,
      {
        isOwner,
        isAdmin: viewer.isAdmin,
        isContractor: viewer.isContractor,
        isDesigner: viewer.isDesigner,
        isAwardedContractor,
      },
      project.projectType,
    );
  }

  private async mapPublicProjectCards(
    projects: Array<
      ProjectWithTags & {
        tender?: { status: string; closesAt: Date | null } | null;
      }
    >,
    viewerLocale?: SupportedLocale,
    viewer?: DiscoverViewerContext,
  ): Promise<PublicProjectCard[]> {
    const projectIds = projects.map((p) => p.id);
    // Ballpark is client-private: only include totals for projects the viewer owns.
    const ownedProjects = viewer?.userId
      ? projects.filter((project) => project.clientId === viewer.userId)
      : [];
    const [coverByProject, estimateByProject] = await Promise.all([
      this.loadCoverUrls(projectIds),
      this.loadEstimateSummaries(ownedProjects),
    ]);

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

        const canOpenDetail = viewer
          ? this.canViewerOpenDiscoverCard(project, viewer)
          : false;
        const tags = this.mapTags(project).map((t) => ({
          slug: t.slug,
          label: t.label,
        }));
        const isOwner = Boolean(
          viewer?.userId && project.clientId === viewer.userId,
        );

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
          tags,
          coverImageUrl: coverByProject.get(project.id) ?? null,
          updatedAt: project.updatedAt.toISOString(),
          applicationsDeadlinePassed:
            this.shouldShowApplicationDeadlineWarning(project) &&
            this.isApplicationsDeadlinePassedForProject(project),
          canOpenDetail,
          estimate: isOwner
            ? (estimateByProject.get(project.id) ?? null)
            : null,
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

  private isApplicationsDeadlinePassedForProject(project: {
    tender?: { status: string; closesAt: Date | null } | null;
  }): boolean {
    if (!project.tender || project.tender.status === 'draft') {
      return false;
    }
    return isApplicationsDeadlinePassed(project.tender.closesAt);
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
    if (
      hasValidInvite &&
      (project.status === ProjectStatus.in_tender ||
        project.status === ProjectStatus.clarification)
    ) {
      return project;
    }

    if (!isPubliclyViewable(project.status)) {
      throw new NotFoundException('Project not found');
    }

    // Prefer the realm-role flags derived from the validated JWT (when the
    // caller provides them) so a self-created DB profile cannot grant
    // supply-side read access without the matching Keycloak realm role.
    const isContractor =
      options?.isContractorRole ??
      (userId ? await this.userIsContractor(userId) : false);
    const isDesigner =
      options?.isDesignerRole ??
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
      !(
        isSupplySide &&
        (project.status === ProjectStatus.in_tender ||
          project.status === ProjectStatus.clarification)
      )
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

  private async loadEstimateSummaries(
    projects: Array<{
      id: string;
      status: ProjectStatus;
      projectType: ProjectType;
      title: string;
      description: string | null;
      briefJson: unknown;
      estimateAdjustmentsJson: unknown;
      designFeePercent: number | null;
    }>,
  ): Promise<Map<string, PublicProjectEstimateSummary>> {
    const result = new Map<string, PublicProjectEstimateSummary>();
    if (projects.length === 0) {
      return result;
    }

    const projectIds = projects.map((project) => project.id);
    const projectById = new Map(projects.map((project) => [project.id, project]));

    const estimates = await this.prisma.estimate.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { createdAt: 'desc' },
    });

    for (const estimate of estimates) {
      if (result.has(estimate.projectId)) continue;
      const project = projectById.get(estimate.projectId);
      if (!project) continue;

      const presented = this.estimatesService.presentForProject(
        project,
        this.estimatesService.toResponse(estimate),
      );
      const { totals } = presented;
      if (
        typeof totals?.minAmount !== 'number' ||
        typeof totals?.maxAmount !== 'number' ||
        typeof totals?.midAmount !== 'number'
      ) {
        continue;
      }

      result.set(estimate.projectId, {
        minAmount: totals.minAmount,
        maxAmount: totals.maxAmount,
        midAmount: totals.midAmount,
        currency:
          typeof totals.currency === 'string' && totals.currency.trim()
            ? totals.currency.trim()
            : presented.currency || 'THB',
        confidence: presented.confidence,
      });
    }

    return result;
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



    const narrativeForType = [title, dto.description?.trim() ?? '']
      .filter(Boolean)
      .join('\n');
    let projectType = dto.projectType ?? ProjectType.other;
    if (projectType === ProjectType.design) {
      // Design track stays design.
    } else if (narrativeForType.trim()) {
      projectType = suggestProjectTypeFromText(narrativeForType);
    } else {
      projectType = normalizeConstructionProjectType(projectType);
    }

    const project = await this.prisma.project.create({

      data: {

        clientId,

        title,

        description: dto.description?.trim() || null,

        projectType,

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

          projectType,

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

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      select: { _count: { select: { bids: true } } },
    });

    const response = this.toResponse(
      project,
      estimate
        ? this.estimatesService.presentForProject(
            project,
            this.estimatesService.toResponse(
              estimate,
              this.estimatesService.refinementAnswersFrom(
                project.estimateRefinementQaJson,
              ),
            ),
          )
        : null,
      tender?._count.bids ?? 0,
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

    if (
      dto.title === undefined &&
      dto.description === undefined &&
      dto.propertyType === undefined &&
      dto.projectType === undefined
    ) {
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

    const nextPropertyType =
      dto.propertyType !== undefined ? dto.propertyType : project.propertyType;

    let nextProjectType = project.projectType;
    const typeEditable = canEditConstructionProjectType(
      project.projectType,
      project.status,
    );

    if (dto.projectType !== undefined) {
      if (!typeEditable) {
        throw new BadRequestException(
          'Project/Work type can only be changed before the tender starts',
        );
      }
      if (dto.projectType === ProjectType.design) {
        throw new BadRequestException(
          'Cannot switch to the Design & Permits track from card edit',
        );
      }
      const normalized = normalizeConstructionProjectType(dto.projectType);
      if (
        !(SELECTABLE_CONSTRUCTION_PROJECT_TYPES as readonly string[]).includes(
          normalized,
        )
      ) {
        throw new BadRequestException('Invalid Project/Work type');
      }
      nextProjectType = normalized;
    } else if (typeEditable && dto.description !== undefined) {
      // Re-infer only when the client did not send an explicit type.
      const narrative = [nextTitle, nextDescription ?? '']
        .filter(Boolean)
        .join('\n');
      nextProjectType = narrative.trim()
        ? suggestProjectTypeFromText(narrative)
        : normalizeConstructionProjectType(project.projectType);
    }

    const brief = (project.briefJson as ProjectBriefV1 | null) ?? buildInitialBrief({
      description: nextDescription ?? undefined,
      propertyType: nextPropertyType,
      originalNarrative: nextDescription ?? undefined,
    });
    if (dto.propertyType !== undefined) {
      brief.property = {
        ...(brief.property ?? {}),
        type: nextPropertyType ?? undefined,
      };
    }

    const readinessScore = computeReadinessScore({
      title: nextTitle,
      description: nextDescription,
      projectType: nextProjectType,
      propertyType: nextPropertyType,
      district: project.district,
      tagCount: project.tags.length,
      brief,
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        title: nextTitle,
        description: nextDescription,
        projectType: nextProjectType,
        propertyType: nextPropertyType,
        briefJson: brief as unknown as Prisma.InputJsonValue,
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

    await this.deleteProjectWithDocuments(project.id, project.documents);
  }

  async deleteForAdmin(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { documents: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.deleteProjectWithDocuments(project.id, project.documents);
  }

  async hideForAdmin(projectId: string): Promise<{ ok: true; isHidden: true }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true, isHidden: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.isHidden) {
      return { ok: true, isHidden: true };
    }
    if (project.status === ProjectStatus.completed) {
      throw new BadRequestException('Completed projects cannot be hidden');
    }
    if (project.status === ProjectStatus.active) {
      throw new BadRequestException('Signed projects cannot be hidden');
    }
    const contract = await this.prisma.contract.findUnique({
      where: { projectId },
      select: { status: true },
    });
    if (contract?.status === ContractStatus.fully_signed) {
      throw new BadRequestException('Signed projects cannot be hidden');
    }
    await this.prisma.project.update({
      where: { id: projectId },
      data: { isHidden: true },
    });
    return { ok: true, isHidden: true };
  }

  async unhideForAdmin(
    projectId: string,
  ): Promise<{ ok: true; isHidden: false }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.prisma.project.update({
      where: { id: projectId },
      data: { isHidden: false },
    });
    return { ok: true, isHidden: false };
  }

  async listForAdmin(
    query: AdminProjectListQuery,
  ): Promise<AdminProjectListPage> {
    const limit = Math.min(
      Math.max(Number(query.limit) || 30, 1),
      100,
    );
    const offset = Math.max(Number(query.offset) || 0, 0);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const where: Prisma.ProjectWhereInput = {};

    if (query.q) {
      where.title = { contains: query.q, mode: 'insensitive' };
    }
    if (query.status) {
      where.status = query.status as ProjectStatus;
    }
    if (query.projectType) {
      where.projectType = query.projectType as ProjectType;
    }
    if (query.hidden === true) {
      where.isHidden = true;
    } else if (query.hidden === false) {
      where.isHidden = false;
    }
    if (query.locationRegionSlug) {
      where.locationRegionSlug = query.locationRegionSlug;
    }
    if (query.clientQ) {
      const term = query.clientQ;
      where.client = {
        OR: [
          { email: { contains: term, mode: 'insensitive' } },
          { displayName: { contains: term, mode: 'insensitive' } },
        ],
      };
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) {
        const from = new Date(query.createdFrom);
        if (!Number.isNaN(from.getTime())) {
          where.createdAt.gte = from;
        }
      }
      if (query.createdTo) {
        const to = new Date(query.createdTo);
        if (!Number.isNaN(to.getTime())) {
          // inclusive end-of-day if date-only
          if (/^\d{4}-\d{2}-\d{2}$/.test(query.createdTo.trim())) {
            to.setHours(23, 59, 59, 999);
          }
          where.createdAt.lte = to;
        }
      }
    }
    if (query.hasEstimate === true) {
      where.estimates = { some: {} };
    } else if (query.hasEstimate === false) {
      where.estimates = { none: {} };
    }

    const contractAmountMin =
      query.contractAmountMin != null &&
      Number.isFinite(query.contractAmountMin)
        ? query.contractAmountMin
        : undefined;
    const contractAmountMax =
      query.contractAmountMax != null &&
      Number.isFinite(query.contractAmountMax)
        ? query.contractAmountMax
        : undefined;
    const hasAmountFilter =
      contractAmountMin != null || contractAmountMax != null;
    const hasSignedFilter = Boolean(query.signedFrom || query.signedTo);

    if (hasAmountFilter || hasSignedFilter) {
      const contractClauses: Prisma.ContractWhereInput[] = [
        { status: ContractStatus.fully_signed },
      ];

      if (hasAmountFilter) {
        const amount: Prisma.DecimalFilter = {};
        if (contractAmountMin != null) amount.gte = contractAmountMin;
        if (contractAmountMax != null) amount.lte = contractAmountMax;
        contractClauses.push({ bid: { amount } });
      }

      if (query.signedFrom) {
        const from = new Date(query.signedFrom);
        if (!Number.isNaN(from.getTime())) {
          // max(client, contractor) >= from ⇔ at least one signature >= from
          contractClauses.push({
            OR: [
              { clientSignedAt: { gte: from } },
              { contractorSignedAt: { gte: from } },
            ],
          });
        }
      }
      if (query.signedTo) {
        const to = new Date(query.signedTo);
        if (!Number.isNaN(to.getTime())) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(query.signedTo.trim())) {
            to.setHours(23, 59, 59, 999);
          }
          // max(client, contractor) <= to ⇔ both signatures <= to
          contractClauses.push({
            AND: [
              { clientSignedAt: { lte: to } },
              { contractorSignedAt: { lte: to } },
            ],
          });
        }
      }

      where.contract = { is: { AND: contractClauses } };
    }

    const include = {
      client: { select: { id: true, displayName: true, email: true } },
      tender: {
        select: {
          status: true,
          awardedBid: {
            select: {
              contractor: { select: { companyName: true } },
            },
          },
          _count: { select: { bids: true } },
        },
      },
      contract: {
        select: {
          status: true,
          clientSignedAt: true,
          contractorSignedAt: true,
          bid: { select: { amount: true } },
        },
      },
    } satisfies Prisma.ProjectInclude;

    type AdminRow = Prisma.ProjectGetPayload<{ include: typeof include }>;
    let rows: AdminRow[];
    let total: number;

    const needsInMemorySort =
      sortBy === 'estimate' ||
      sortBy === 'contractAmount' ||
      sortBy === 'signedAt';

    if (needsInMemorySort) {
      const allMatching = await this.prisma.project.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
      });
      const estimates =
        sortBy === 'estimate'
          ? await this.loadEstimateSummaries(allMatching)
          : null;
      const decorated = allMatching.map((project) => {
        let sortValue: number | null = null;
        if (sortBy === 'estimate') {
          sortValue = estimates?.get(project.id)?.midAmount ?? null;
        } else if (sortBy === 'contractAmount') {
          const raw = project.contract?.bid?.amount;
          if (raw != null) {
            const n = Number(raw);
            sortValue = Number.isFinite(n) ? n : null;
          }
        } else {
          sortValue = this.adminContractFullySignedMs(project.contract);
        }
        return { project, sortValue };
      });
      decorated.sort((a, b) => {
        const av = a.sortValue;
        const bv = b.sortValue;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
      total = decorated.length;
      rows = decorated.slice(offset, offset + limit).map((row) => row.project);
      const pageEstimates = await this.loadEstimateSummaries(rows);
      const covers = await this.loadCoverUrls(rows.map((p) => p.id));
      const items = rows.map((project) =>
        this.toAdminListItem(
          project,
          covers.get(project.id) ?? null,
          pageEstimates.get(project.id) ?? null,
        ),
      );
      return {
        items,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      };
    }

    const orderBy: Prisma.ProjectOrderByWithRelationInput =
      sortBy === 'title'
        ? { title: sortDir }
        : { createdAt: sortDir };

    [total, rows] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        include,
        orderBy,
        skip: offset,
        take: limit,
      }),
    ]);

    const [covers, estimates] = await Promise.all([
      this.loadCoverUrls(rows.map((p) => p.id)),
      this.loadEstimateSummaries(rows),
    ]);

    const items = rows.map((project) =>
      this.toAdminListItem(
        project,
        covers.get(project.id) ?? null,
        estimates.get(project.id) ?? null,
      ),
    );

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  private adminContractFullySignedMs(
    contract: {
      status: ContractStatus;
      clientSignedAt: Date | null;
      contractorSignedAt: Date | null;
    } | null,
  ): number | null {
    if (contract?.status !== ContractStatus.fully_signed) return null;
    const times = [
      contract.clientSignedAt,
      contract.contractorSignedAt,
    ].filter((d): d is Date => d != null);
    if (times.length === 0) return null;
    return Math.max(...times.map((d) => d.getTime()));
  }

  private toAdminListItem(
    project: {
      id: string;
      title: string;
      description: string | null;
      projectType: ProjectType;
      status: ProjectStatus;
      isHidden: boolean;
      platformFeePaid: boolean;
      readinessScore: number;
      locationRegionSlug: string;
      locationAreaSlug: string | null;
      locationNote: string | null;
      district: string | null;
      createdAt: Date;
      updatedAt: Date;
      client: {
        id: string;
        displayName: string | null;
        email: string | null;
      };
      tender: {
        status: string;
        awardedBid: {
          contractor: { companyName: string | null };
        } | null;
        _count: { bids: number };
      } | null;
      contract: {
        status: ContractStatus;
        clientSignedAt: Date | null;
        contractorSignedAt: Date | null;
        bid?: { amount: Prisma.Decimal | null } | null;
      } | null;
    },
    coverImageUrl: string | null,
    estimate: PublicProjectEstimateSummary | null,
  ): AdminProjectListItem {
    const signedMs = this.adminContractFullySignedMs(project.contract);
    const contractFullySignedAt =
      signedMs != null ? new Date(signedMs).toISOString() : null;

    let contractAmount: number | null = null;
    const rawAmount = project.contract?.bid?.amount;
    if (rawAmount != null) {
      const n = Number(rawAmount);
      if (Number.isFinite(n)) contractAmount = n;
    }

    return {
      id: project.id,
      title: project.title,
      description: project.description,
      projectType: project.projectType,
      status: project.status,
      isHidden: project.isHidden,
      platformFeePaid: project.platformFeePaid,
      readinessScore: project.readinessScore,
      coverImageUrl,
      estimate,
      client: {
        id: project.client.id,
        displayName: project.client.displayName,
        email: project.client.email,
      },
      locationRegionSlug: project.locationRegionSlug,
      locationAreaSlug: project.locationAreaSlug,
      locationNote: project.locationNote,
      district: project.district,
      awardedContractorName:
        project.tender?.awardedBid?.contractor.companyName?.trim() || null,
      tenderStatus: project.tender?.status ?? null,
      bidCount: project.tender?._count.bids ?? 0,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      contractAmount,
      contractFullySignedAt,
      completedAt:
        project.status === ProjectStatus.completed
          ? project.updatedAt.toISOString()
          : null,
    };
  }

  private async deleteProjectWithDocuments(
    projectId: string,
    documents: Array<{ storageKey: string }>,
  ): Promise<void> {

    if (this.storage.isConfigured()) {
      for (const doc of documents) {
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
    if (project.status === ProjectStatus.active) {
      throw new BadRequestException(
        'Signed projects cannot be hidden',
      );
    }

    const contract = await this.prisma.contract.findUnique({
      where: { projectId },
      select: { status: true },
    });
    if (contract?.status === ContractStatus.fully_signed) {
      throw new BadRequestException('Signed projects cannot be hidden');
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
    await this.projectReviews.requestCompletionByClient(clientId, projectId, dto);
    return this.getForClient(clientId, projectId);
  }

  async confirmCompletionForClient(
    clientId: string,
    projectId: string,
    dto?: ConfirmProjectCompletionDto,
  ): Promise<ProjectResponse> {
    await this.projectReviews.confirmCompletionByClient(
      clientId,
      projectId,
      dto,
    );
    return this.getForClient(clientId, projectId);
  }

  async completeForAdmin(projectId: string): Promise<void> {
    await this.projectReviews.completeProjectByAdmin(projectId);
  }

  /**
   * Convert a construction/modernization/repair card into Design & Permits
   * in place. After design is complete, the client starts a new construction
   * project with the updated scope and drawings.
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
        estimates: { orderBy: { createdAt: 'asc' } },
        tender: { include: { _count: { select: { bids: true } } } },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }
    if (
      !canClientConvertToDesign({
        projectType: project.projectType,
        status: project.status,
        linkKind: project.linkKind,
        linkedProjectId: project.linkedProjectId,
        tenderBidCount: project.tender?._count.bids ?? 0,
      })
    ) {
      throw new BadRequestException(
        'This project cannot be converted to Design & Permits at its current stage',
      );
    }

    const originalProjectType = project.projectType;
    const brief = (project.briefJson ?? {}) as unknown as ProjectBriefV1;
    const designBrief: ProjectBriefV1 = {
      ...brief,
      design: {
        ...(brief.design ?? {}),
        needsDesignTender: true,
      },
    };
    const resumeStatus =
      project.status === ProjectStatus.clarification ||
      project.status === ProjectStatus.in_tender
        ? ProjectStatus.estimated
        : project.status;

    await this.prisma.$transaction(async (tx) => {
      const clone = await tx.project.create({
        data: {
          clientId: project.clientId,
          title: project.title,
          description: project.description,
          projectType: originalProjectType,
          propertyType: project.propertyType,
          propertyOwnershipForm: project.propertyOwnershipForm,
          district: project.district,
          locationRegionSlug: project.locationRegionSlug,
          locationAreaSlug: project.locationAreaSlug,
          locationNote: project.locationNote,
          regionCode: project.regionCode,
          status: ProjectStatus.pending,
          statusBeforePending: resumeStatus,
          isHidden: false,
          readinessScore: project.readinessScore,
          briefJson: project.briefJson as Prisma.InputJsonValue,
          clarificationMode: project.clarificationMode,
          clarificationSummary: project.clarificationSummary,
          scopeSummary: project.scopeSummary,
          sourceLocale: project.sourceLocale,
          tenderContractTermsJson:
            project.tenderContractTermsJson as Prisma.InputJsonValue,
          estimateRefinementQaJson:
            project.estimateRefinementQaJson as Prisma.InputJsonValue,
          estimateAdjustmentsJson:
            project.estimateAdjustmentsJson as Prisma.InputJsonValue,
          linkKind: ProjectLinkKind.construction_pending,
        },
      });

      if (project.tags.length > 0) {
        await tx.projectTag.createMany({
          data: project.tags.map((tag) => ({
            projectId: clone.id,
            tagId: tag.tagId,
            source: tag.source,
          })),
        });
      }

      for (const estimate of project.estimates) {
        await tx.estimate.create({
          data: {
            projectId: clone.id,
            type: estimate.type,
            currency: estimate.currency,
            totalsJson: estimate.totalsJson as Prisma.InputJsonValue,
            linesJson: estimate.linesJson as Prisma.InputJsonValue,
            confidence: estimate.confidence,
            disclaimer: estimate.disclaimer,
            metaJson: estimate.metaJson as Prisma.InputJsonValue,
          },
        });
      }

      if (project.tender) {
        await tx.tender.delete({ where: { id: project.tender.id } });
      }

      await tx.project.update({
        where: { id: project.id },
        data: {
          projectType: ProjectType.design,
          linkKind: ProjectLinkKind.design_active,
          linkedProjectId: clone.id,
          status: resumeStatus,
          briefJson: designBrief as unknown as Prisma.InputJsonValue,
          designFeePercent: null,
          baseConstructionTotalsJson: Prisma.JsonNull,
          estimateAdjustmentsJson: Prisma.JsonNull,
        },
      });
    });

    const tagSlugs = (
      await this.prisma.tag.findMany({
        where: { id: { in: project.tags.map((t) => t.tagId) } },
        select: { slug: true },
      })
    ).map((t) => t.slug);

    if (project.estimates.length > 0) {
      const applied = await this.estimatesService.applyDesignFeeFromExisting(
        project.id,
        project.propertyType,
        tagSlugs,
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

    this.projectLocalization.scheduleWarmProjectTranslations(projectId);

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

function normalizeDiscoverPagination(pagination?: {
  limit?: number;
  offset?: number;
}): { limit: number; offset: number } {
  const rawLimit = pagination?.limit ?? DISCOVER_PAGE_SIZE;
  const limit = Math.min(
    DISCOVER_PAGE_SIZE_MAX,
    Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : DISCOVER_PAGE_SIZE),
  );
  const rawOffset = pagination?.offset ?? 0;
  const offset = Math.max(
    0,
    Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0,
  );
  return { limit, offset };
}
