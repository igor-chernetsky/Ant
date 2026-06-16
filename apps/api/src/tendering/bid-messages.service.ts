import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import { BidMessageResponse, SendBidMessageDto } from './tendering.types';

const MAX_BID_MESSAGE_LENGTH = 4000;

@Injectable()
export class BidMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractorProfiles: ContractorProfilesService,
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

  async listMessages(
    userId: string,
    bidId: string,
    projectId?: string,
  ): Promise<BidMessageResponse[]> {
    await this.assertBidAccess(userId, bidId, projectId);

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
    await this.assertBidAccess(userId, bidId, projectId);

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

    return this.mapMessage(message);
  }
}
