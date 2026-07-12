import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClarificationMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectScopeSyncService } from '../projects/project-scope-sync.service';
import { BidMessageResponse, SendBidMessageDto } from './tendering.types';

const MAX_BID_MESSAGE_LENGTH = 4000;
/** Skip chat email if recipient was active in this bid within the last N ms. */
export const BID_CHAT_PRESENCE_TTL_MS = 90_000;

@Injectable()
export class BidMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly notifications: NotificationsService,
    private readonly scopeSync: ProjectScopeSyncService,
  ) {}

  private mapMessage(message: {
    id: string;
    bidId: string;
    authorId: string;
    body: string;
    createdAt: Date;
  }): BidMessageResponse {
    return {
      id: message.id,
      bidId: message.bidId,
      authorId: message.authorId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private async assertBidAccess(
    userId: string,
    bidId: string,
    projectId?: string,
  ) {
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        contractor: true,
        tender: { include: { project: true } },
      },
    });

    if (!bid) {
      throw new NotFoundException('Bid not found');
    }

    if (projectId && bid.tender.projectId !== projectId) {
      throw new NotFoundException('Bid not found for this project');
    }

    const isClient = bid.tender.project.clientId === userId;
    const profile = await this.contractorProfiles.getByUserId(userId);
    const isContractor = profile?.id === bid.contractorId;

    if (!isClient && !isContractor) {
      throw new ForbiddenException('Access denied');
    }

    return { bid, isClient };
  }

  private async isUserViewingBidChat(
    userId: string,
    bidId: string,
  ): Promise<boolean> {
    const presence = await this.prisma.bidChatPresence.findUnique({
      where: { userId_bidId: { userId, bidId } },
    });
    if (!presence) return false;
    return Date.now() - presence.lastSeenAt.getTime() < BID_CHAT_PRESENCE_TTL_MS;
  }

  async touchPresence(
    userId: string,
    bidId: string,
    projectId?: string,
  ): Promise<void> {
    await this.assertBidAccess(userId, bidId, projectId);
    await this.prisma.bidChatPresence.upsert({
      where: { userId_bidId: { userId, bidId } },
      create: { userId, bidId, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });
  }

  async listMessages(
    userId: string,
    bidId: string,
    projectId?: string,
  ): Promise<BidMessageResponse[]> {
    await this.touchPresence(userId, bidId, projectId);

    const messages = await this.prisma.bidMessage.findMany({
      where: { bidId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((message) => this.mapMessage(message));
  }

  async sendMessage(
    userId: string,
    bidId: string,
    dto: SendBidMessageDto,
    projectId?: string,
  ): Promise<BidMessageResponse> {
    const { bid, isClient } = await this.assertBidAccess(userId, bidId, projectId);

    if (
      bid.tender.project.clarificationMode === ClarificationMode.structured_qa
    ) {
      throw new BadRequestException(
        'This project uses structured clarification questions instead of chat',
      );
    }

    const body = dto.body?.trim();
    if (!body) {
      throw new BadRequestException('Message cannot be empty');
    }
    if (body.length > MAX_BID_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Message must be at most ${MAX_BID_MESSAGE_LENGTH} characters`,
      );
    }

    const message = await this.prisma.bidMessage.create({
      data: { bidId, authorId: userId, body },
    });

    await this.touchPresence(userId, bidId, projectId);

    if (isClient) {
      this.scopeSync.dispatch(
        bid.tender.projectId,
        this.scopeSync.buildClientChatUpdate(body),
      );
    }

    const recipientUserId = isClient
      ? bid.contractor.userId
      : bid.tender.project.clientId;
    const recipientRole = isClient ? 'contractor' : 'client';

    const recipientViewing = await this.isUserViewingBidChat(
      recipientUserId,
      bidId,
    );

    if (!recipientViewing) {
      this.notifications.dispatch(
        this.notifications.notifyBidMessage({
          recipientUserId,
          recipientRole,
          projectId: bid.tender.projectId,
          projectTitle: bid.tender.project.title,
          preview: body,
        }),
      );
    }

    return this.mapMessage(message);
  }
}
