import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BidStatus,
  DefectEventKind,
  DefectStatus,
  DocumentStatus,
  ProjectStatus,
  Prisma,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContractorProfilesService } from '../tendering/contractor-profiles.service';
import type {
  CreateDefectDto,
  DefectCommentDto,
  DefectDto,
  DefectEventDto,
  DefectsOverviewDto,
} from './defects.types';

const CLIENT_ATTACHMENT_EVENT_KINDS: DefectEventKind[] = [
  DefectEventKind.created,
  DefectEventKind.resubmitted,
  DefectEventKind.completion_rejected,
];

const EXECUTOR_ATTACHMENT_EVENT_KINDS: DefectEventKind[] = [
  DefectEventKind.completed,
];

@Injectable()
export class DefectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string, projectId: string): Promise<DefectsOverviewDto> {
    const ctx = await this.loadContext(userId, projectId);
    const defects = await this.prisma.defect.findMany({
      where: { projectId },
      include: {
        events: {
          orderBy: { createdAt: 'asc' },
          include: {
            actor: { select: { displayName: true, email: true } },
            attachments: {
              where: { status: DocumentStatus.uploaded },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { sequenceNumber: 'desc' },
    });

    return {
      projectId,
      role: ctx.role,
      isDesignProject: ctx.project.projectType === 'design',
      defects: defects.map((defect) => this.toDefectDto(defect)),
    };
  }

  async create(
    userId: string,
    projectId: string,
    dto: CreateDefectDto,
  ): Promise<DefectDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertClient(ctx);
    this.assertActive(ctx.project.status);

    const description = dto.description?.trim();
    if (!description) {
      throw new BadRequestException('Description is required');
    }

    const lastSeq = await this.prisma.defect.findFirst({
      where: { projectId },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });

    const created = await this.prisma.defect.create({
      data: {
        projectId,
        sequenceNumber: (lastSeq?.sequenceNumber ?? 0) + 1,
        description: description.slice(0, 5000),
        status: DefectStatus.reported,
        events: {
          create: {
            kind: DefectEventKind.created,
            actorUserId: userId,
          },
        },
      },
      include: this.defectInclude(),
    });

    void this.notifications.dispatch(
      this.notifications.notifyContractorDefectReported({
        contractorUserId: ctx.bid.contractor.userId,
        projectId,
        projectTitle: ctx.project.title,
        defectNumber: created.sequenceNumber,
      }),
    );

    return this.toDefectDto(created);
  }

  async accept(
    userId: string,
    projectId: string,
    defectId: string,
  ): Promise<DefectDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertContractor(ctx);
    this.assertActive(ctx.project.status);

    const defect = await this.requireDefect(projectId, defectId);
    if (
      defect.status !== DefectStatus.reported &&
      defect.status !== DefectStatus.declined
    ) {
      throw new BadRequestException(
        'Only reported or declined defects can be accepted',
      );
    }

    const updated = await this.prisma.defect.update({
      where: { id: defectId },
      data: {
        status: DefectStatus.in_progress,
        events: {
          create: {
            kind: DefectEventKind.accepted,
            actorUserId: userId,
          },
        },
      },
      include: this.defectInclude(),
    });

    void this.notifications.dispatch(
      this.notifications.notifyClientDefectAccepted({
        clientUserId: ctx.project.clientId,
        projectId,
        projectTitle: ctx.project.title,
        defectNumber: updated.sequenceNumber,
      }),
    );

    return this.toDefectDto(updated);
  }

  async decline(
    userId: string,
    projectId: string,
    defectId: string,
    dto: DefectCommentDto,
  ): Promise<DefectDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertContractor(ctx);
    this.assertActive(ctx.project.status);

    const defect = await this.requireDefect(projectId, defectId);
    if (defect.status !== DefectStatus.reported) {
      throw new BadRequestException('Only reported defects can be declined');
    }

    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Decline reason is required');
    }

    const updated = await this.prisma.defect.update({
      where: { id: defectId },
      data: {
        status: DefectStatus.declined,
        events: {
          create: {
            kind: DefectEventKind.declined,
            comment: reason.slice(0, 2000),
            actorUserId: userId,
          },
        },
      },
      include: this.defectInclude(),
    });

    void this.notifications.dispatch(
      this.notifications.notifyClientDefectDeclined({
        clientUserId: ctx.project.clientId,
        projectId,
        projectTitle: ctx.project.title,
        defectNumber: updated.sequenceNumber,
        reason,
      }),
    );

    return this.toDefectDto(updated);
  }

  async resubmit(
    userId: string,
    projectId: string,
    defectId: string,
    dto: DefectCommentDto,
  ): Promise<DefectDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertClient(ctx);
    this.assertActive(ctx.project.status);

    const defect = await this.requireDefect(projectId, defectId);
    if (defect.status !== DefectStatus.declined) {
      throw new BadRequestException('Only declined defects can be resubmitted');
    }

    const comment = dto.comment?.trim()
      ? dto.comment.trim().slice(0, 2000)
      : null;

    const updated = await this.prisma.defect.update({
      where: { id: defectId },
      data: {
        status: DefectStatus.reported,
        events: {
          create: {
            kind: DefectEventKind.resubmitted,
            comment,
            actorUserId: userId,
          },
        },
      },
      include: this.defectInclude(),
    });

    void this.notifications.dispatch(
      this.notifications.notifyContractorDefectResubmitted({
        contractorUserId: ctx.bid.contractor.userId,
        projectId,
        projectTitle: ctx.project.title,
        defectNumber: updated.sequenceNumber,
      }),
    );

    return this.toDefectDto(updated);
  }

  async complete(
    userId: string,
    projectId: string,
    defectId: string,
    dto: DefectCommentDto,
  ): Promise<DefectDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertContractor(ctx);
    this.assertActive(ctx.project.status);

    const defect = await this.requireDefect(projectId, defectId);
    if (defect.status !== DefectStatus.in_progress) {
      throw new BadRequestException(
        'Only in-progress defects can be marked complete',
      );
    }

    const comment = dto.comment?.trim()
      ? dto.comment.trim().slice(0, 2000)
      : null;

    const updated = await this.prisma.defect.update({
      where: { id: defectId },
      data: {
        status: DefectStatus.submitted,
        events: {
          create: {
            kind: DefectEventKind.completed,
            comment,
            actorUserId: userId,
          },
        },
      },
      include: this.defectInclude(),
    });

    void this.notifications.dispatch(
      this.notifications.notifyClientDefectCompleted({
        clientUserId: ctx.project.clientId,
        projectId,
        projectTitle: ctx.project.title,
        defectNumber: updated.sequenceNumber,
      }),
    );

    return this.toDefectDto(updated);
  }

  async acceptCompletion(
    userId: string,
    projectId: string,
    defectId: string,
  ): Promise<DefectDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertClient(ctx);

    const defect = await this.requireDefect(projectId, defectId);
    if (defect.status !== DefectStatus.submitted) {
      throw new BadRequestException(
        'Only submitted defects can be accepted as fixed',
      );
    }

    const updated = await this.prisma.defect.update({
      where: { id: defectId },
      data: {
        status: DefectStatus.closed,
        events: {
          create: {
            kind: DefectEventKind.closed,
            actorUserId: userId,
          },
        },
      },
      include: this.defectInclude(),
    });

    void this.notifications.dispatch(
      this.notifications.notifyContractorDefectClosed({
        contractorUserId: ctx.bid.contractor.userId,
        projectId,
        projectTitle: ctx.project.title,
        defectNumber: updated.sequenceNumber,
      }),
    );

    return this.toDefectDto(updated);
  }

  async rejectCompletion(
    userId: string,
    projectId: string,
    defectId: string,
    dto: DefectCommentDto,
  ): Promise<DefectDto> {
    const ctx = await this.loadContext(userId, projectId);
    this.assertClient(ctx);

    const defect = await this.requireDefect(projectId, defectId);
    if (defect.status !== DefectStatus.submitted) {
      throw new BadRequestException(
        'Only submitted defects can have completion rejected',
      );
    }

    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const updated = await this.prisma.defect.update({
      where: { id: defectId },
      data: {
        status: DefectStatus.in_progress,
        events: {
          create: {
            kind: DefectEventKind.completion_rejected,
            comment: reason.slice(0, 2000),
            actorUserId: userId,
          },
        },
      },
      include: this.defectInclude(),
    });

    void this.notifications.dispatch(
      this.notifications.notifyContractorDefectCompletionRejected({
        contractorUserId: ctx.bid.contractor.userId,
        projectId,
        projectTitle: ctx.project.title,
        defectNumber: updated.sequenceNumber,
        reason,
      }),
    );

    return this.toDefectDto(updated);
  }

  async assertCanAttachToEvent(
    projectId: string,
    userId: string,
    defectEventId: string,
  ): Promise<{ defectId: string; defectEventId: string }> {
    const event = await this.prisma.defectEvent.findFirst({
      where: { id: defectEventId },
      include: {
        defect: {
          include: {
            project: {
              include: {
                tender: {
                  include: {
                    awardedBid: {
                      include: {
                        contractor: {
                          select: { id: true, userId: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!event || event.defect.projectId !== projectId) {
      throw new NotFoundException('Defect event not found');
    }

    if (event.defect.project.status !== ProjectStatus.active) {
      throw new BadRequestException(
        'Defect attachments are only allowed on active projects',
      );
    }

    const bid = event.defect.project.tender?.awardedBid;
    if (!bid || bid.status !== BidStatus.selected) {
      throw new BadRequestException('No awarded contractor on this project');
    }

    const isClient = event.defect.project.clientId === userId;
    let isContractor = false;
    if (!isClient) {
      const profile = await this.contractorProfiles.getByUserId(userId);
      isContractor = Boolean(profile && profile.id === bid.contractorId);
    }

    if (CLIENT_ATTACHMENT_EVENT_KINDS.includes(event.kind)) {
      if (!isClient) {
        throw new ForbiddenException('Only the project owner can attach here');
      }
    } else if (EXECUTOR_ATTACHMENT_EVENT_KINDS.includes(event.kind)) {
      if (!isContractor) {
        throw new ForbiddenException(
          'Only the awarded contractor can attach here',
        );
      }
    } else {
      throw new BadRequestException('This event does not accept attachments');
    }

    return { defectId: event.defectId, defectEventId: event.id };
  }

  private defectInclude() {
    return {
      events: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          actor: { select: { displayName: true, email: true } },
          attachments: {
            where: { status: DocumentStatus.uploaded },
            orderBy: { createdAt: 'asc' as const },
          },
        },
      },
    };
  }

  private assertClient(ctx: { role: 'client' | 'contractor' | null }) {
    if (ctx.role !== 'client') {
      throw new ForbiddenException('Only the project owner can do this');
    }
  }

  private assertContractor(ctx: { role: 'client' | 'contractor' | null }) {
    if (ctx.role !== 'contractor') {
      throw new ForbiddenException('Only the awarded contractor can do this');
    }
  }

  private assertActive(status: ProjectStatus) {
    if (status !== ProjectStatus.active) {
      throw new BadRequestException(
        'Defect tracking is available while the project is active',
      );
    }
  }

  private async requireDefect(projectId: string, defectId: string) {
    const defect = await this.prisma.defect.findFirst({
      where: { id: defectId, projectId },
    });
    if (!defect) {
      throw new NotFoundException('Defect not found');
    }
    return defect;
  }

  private async loadContext(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tender: {
          include: {
            awardedBid: {
              include: {
                contractor: {
                  select: { id: true, userId: true, companyName: true },
                },
              },
            },
          },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const bid = project.tender?.awardedBid;
    if (!bid || bid.status !== BidStatus.selected) {
      throw new BadRequestException('No awarded contractor bid on this project');
    }

    let role: 'client' | 'contractor' | null = null;
    if (project.clientId === userId) {
      role = 'client';
    } else {
      const profile = await this.contractorProfiles.getByUserId(userId);
      if (profile && profile.id === bid.contractorId) {
        role = 'contractor';
      }
    }
    if (!role) {
      throw new ForbiddenException('Access denied');
    }

    if (project.status !== ProjectStatus.active) {
      throw new BadRequestException(
        'Defect tracking is available while the project is active',
      );
    }

    return { project, bid, role };
  }

  private toDefectDto(
    defect: Prisma.DefectGetPayload<{
      include: {
        events: {
          include: {
            actor: { select: { displayName: true; email: true } };
            attachments: true;
          };
        };
      };
    }>,
  ): DefectDto {
    return {
      id: defect.id,
      projectId: defect.projectId,
      sequenceNumber: defect.sequenceNumber,
      description: defect.description,
      status: defect.status,
      createdAt: defect.createdAt.toISOString(),
      updatedAt: defect.updatedAt.toISOString(),
      events: defect.events.map((event) => this.toEventDto(event)),
    };
  }

  private toEventDto(
    event: Prisma.DefectEventGetPayload<{
      include: {
        actor: { select: { displayName: true; email: true } };
        attachments: true;
      };
    }>,
  ): DefectEventDto {
    return {
      id: event.id,
      kind: event.kind,
      comment: event.comment,
      actorUserId: event.actorUserId,
      actorDisplayName:
        event.actor.displayName?.trim() ||
        event.actor.email?.trim() ||
        null,
      createdAt: event.createdAt.toISOString(),
      attachments: event.attachments.map((doc) => ({
        id: doc.id,
        projectId: doc.projectId,
        originalName: doc.originalName,
        contentType: doc.contentType,
        sizeBytes: doc.sizeBytes,
        category: doc.category,
        status: doc.status,
        createdAt: doc.createdAt.toISOString(),
        uploadedAt: doc.uploadedAt?.toISOString() ?? null,
        hasThumbnail: Boolean(doc.thumbnailStorageKey),
      })),
    };
  }
}
