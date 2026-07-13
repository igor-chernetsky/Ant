import {

  BadRequestException,

  ForbiddenException,

  Inject,

  Injectable,

  NotFoundException,

  forwardRef,

} from '@nestjs/common';

import { DocumentStatus, Prisma, Project, ProjectStatus, ProjectTag, ProjectType, Tag } from '@prisma/client';
import { IntakeService } from '../intake/intake.service';
import { EstimatesService } from '../estimation/estimates.service';
import { LocationsService } from '../locations/locations.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { isPubliclyDiscoverable, isPubliclyViewable, DISCOVERY_FILTER_HIDDEN, DISCOVERY_STATUSES } from './projects.constants';
import { shouldHideProjectFromPublicDiscovery } from '../tendering/tender-deadline';
import {
  buildOwnershipFilter,
  buildServiceFilter,
  normalizeOwnershipFilterSlugs,
  normalizeServiceFilterSlugs,
} from './discover-filters';

import {

  buildInitialBrief,

  computeReadinessScore,

} from './project-brief';

import {

  CreateProjectDto,

  ProjectResponse,

  ProjectTagResponse,

  PublicProjectCard,

  CompleteProjectDto,

} from './projects.types';

import { ProjectReviewsService } from './project-reviews.service';
import type { DiscoverLocationFilter } from './discover.types';
import { ProjectLocalizationService } from '../localization/project-localization.service';
import { normalizeSourceLocale } from '../localization/locale.utils';
import type { SupportedLocale } from '../users/locale.types';

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
  ): Promise<PublicProjectCard[]> {
    return this.listDiscover(
      null,
      tagSlugs,
      statuses,
      location,
      serviceSlugs,
      ownershipSlugs,
    );
  }

  async listDiscover(
    userId: string | null,
    tagSlugs: string[] = [],
    statuses: string[] = [],
    location?: DiscoverLocationFilter,
    serviceSlugs: string[] = [],
    ownershipSlugs: string[] = [],
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
      const allowed = statusFilters.filter((status): status is ProjectStatus =>
        DISCOVERY_STATUSES.includes(status),
      );
      if (allowed.length > 0) {
        orClauses.push({
          status: { in: allowed },
          isHidden: false,
        });
      }
    }

    if (orClauses.length === 0 && !includesCompleted) {
      orClauses.push({
        status: { in: DISCOVERY_STATUSES },
        isHidden: false,
      });
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

    return this.mapPublicProjectCards(visibleProjects);
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

    return this.mapPublicProjectCards(projects);
  }

  private async mapPublicProjectCards(
    projects: Array<
      ProjectWithTags & {
        tender?: { status: string; closesAt: Date | null } | null;
      }
    >,
  ): Promise<PublicProjectCard[]> {
    const projectIds = projects.map((p) => p.id);
    const coverByProject = await this.loadCoverUrls(projectIds);

    return projects.map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
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
    }));
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

  private async userHasActiveTenderParticipation(
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

    const bid = await this.prisma.bid.findFirst({
      where: {
        contractorId: profile.id,
        status: { not: 'withdrawn' },
        tender: { projectId },
      },
      select: { id: true },
    });

    return Boolean(bid);
  }

  async getPublicById(
    projectId: string,
    userId: string | null = null,
    viewerLocale?: SupportedLocale,
  ): Promise<ProjectResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        ...this.includeTags(),
        tender: { select: { status: true, closesAt: true } },
      },
    });

    if (!project || !isPubliclyViewable(project.status)) {
      throw new NotFoundException('Project not found');
    }

    if (!isPubliclyDiscoverable(project)) {
      const participantProjectIds = userId
        ? await this.loadParticipantProjectIds(userId)
        : new Set<string>();
      if (
        !userId ||
        (project.clientId !== userId &&
          !participantProjectIds.has(project.id))
      ) {
        throw new NotFoundException('Project not found');
      }
    }

    if (
      project.tender &&
      shouldHideProjectFromPublicDiscovery({
        tenderStatus: project.tender.status,
        closesAt: project.tender.closesAt,
      })
    ) {
      const participantProjectIds = userId
        ? await this.loadParticipantProjectIds(userId)
        : new Set<string>();
      if (
        !this.canViewExpiredDiscoverProject(
          project,
          userId,
          participantProjectIds,
        )
      ) {
        throw new NotFoundException('Project not found');
      }
    }

    return this.buildPublicProjectResponse(project, viewerLocale);
  }

  async getPublicByIdForParticipant(
    userId: string,
    projectId: string,
    viewerLocale?: SupportedLocale,
  ): Promise<ProjectResponse> {
    const hasParticipation = await this.userHasActiveTenderParticipation(
      userId,
      projectId,
    );
    if (!hasParticipation) {
      throw new NotFoundException('Project not found');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: this.includeTags(),
    });

    if (!project || !isPubliclyViewable(project.status)) {
      throw new NotFoundException('Project not found');
    }

    return this.buildPublicProjectResponse(project, viewerLocale);
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
        const { downloadUrl } = await this.storage.createPresignedDownload(
          doc.storageKey,
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
