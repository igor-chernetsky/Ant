import { Injectable, NotFoundException } from '@nestjs/common';
import { ContractStatus, Prisma, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AdminClientDetail,
  AdminClientLegalSnapshot,
  AdminClientListItem,
  AdminClientListPage,
  AdminClientListQuery,
  AdminClientProjectSummary,
} from './admin-clients.types';

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.active,
  ProjectStatus.awarded,
  ProjectStatus.in_tender,
  ProjectStatus.clarification,
];

@Injectable()
export class AdminClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async listClients(query: AdminClientListQuery): Promise<AdminClientListPage> {
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);

    const where: Prisma.UserWhereInput = {
      projects: { some: {} },
    };

    const term = query.q?.trim();
    if (term) {
      where.AND = [
        {
          OR: [
            { email: { contains: term, mode: 'insensitive' } },
            { displayName: { contains: term, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          displayName: true,
          preferredLocale: true,
          createdAt: true,
          projects: {
            select: {
              status: true,
              updatedAt: true,
              createdAt: true,
            },
            orderBy: { updatedAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    const items = rows.map((row) => this.toListItem(row));
    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  async getClient(clientId: string): Promise<AdminClientDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        email: true,
        displayName: true,
        preferredLocale: true,
        createdAt: true,
        updatedAt: true,
        projects: {
          select: {
            id: true,
            title: true,
            status: true,
            projectType: true,
            isHidden: true,
            locationRegionSlug: true,
            createdAt: true,
            updatedAt: true,
            platformFeePaid: true,
            tenderContractTermsJson: true,
            contract: {
              select: {
                status: true,
                clientSignedAt: true,
                contractorSignedAt: true,
                bid: { select: { amount: true } },
              },
            },
            _count: {
              select: { paymentSlipAttachments: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!user || user.projects.length === 0) {
      throw new NotFoundException('Client not found');
    }

    const listBase = this.toListItem({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      preferredLocale: user.preferredLocale,
      createdAt: user.createdAt,
      projects: user.projects.map((p) => ({
        status: p.status,
        updatedAt: p.updatedAt,
        createdAt: p.createdAt,
      })),
    });

    const projects: AdminClientProjectSummary[] = user.projects.map((project) => {
      let contractAmount: number | null = null;
      const raw = project.contract?.bid?.amount;
      if (raw != null) {
        const n = Number(raw);
        if (Number.isFinite(n)) contractAmount = n;
      }

      return {
        id: project.id,
        title: project.title,
        status: project.status,
        projectType: project.projectType,
        isHidden: project.isHidden,
        locationRegionSlug: project.locationRegionSlug,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        contractAmount,
        contractFullySignedAt: this.fullySignedAt(project.contract),
        platformFeePaid: project.platformFeePaid,
      };
    });

    const paymentSlipCount = user.projects.reduce(
      (sum, p) => sum + p._count.paymentSlipAttachments,
      0,
    );

    return {
      ...listBase,
      updatedAt: user.updatedAt.toISOString(),
      legal: this.pickLegalSnapshot(user.projects),
      projects,
      invoices: [],
      vatCertificates: [],
      paymentInfo: null,
      paymentSlipCount,
    };
  }

  private toListItem(row: {
    id: string;
    email: string | null;
    displayName: string | null;
    preferredLocale: string;
    createdAt: Date;
    projects: Array<{
      status: ProjectStatus;
      updatedAt: Date;
      createdAt: Date;
    }>;
  }): AdminClientListItem {
    const lastProjectAt =
      row.projects.length > 0
        ? row.projects
            .map((p) => p.updatedAt.getTime())
            .reduce((a, b) => Math.max(a, b), 0)
        : null;

    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      preferredLocale: row.preferredLocale,
      createdAt: row.createdAt.toISOString(),
      projectCount: row.projects.length,
      activeProjectCount: row.projects.filter((p) =>
        ACTIVE_PROJECT_STATUSES.includes(p.status),
      ).length,
      lastProjectAt:
        lastProjectAt != null ? new Date(lastProjectAt).toISOString() : null,
    };
  }

  private fullySignedAt(
    contract: {
      status: ContractStatus;
      clientSignedAt: Date | null;
      contractorSignedAt: Date | null;
    } | null,
  ): string | null {
    if (contract?.status !== ContractStatus.fully_signed) return null;
    const times = [
      contract.clientSignedAt,
      contract.contractorSignedAt,
    ].filter((d): d is Date => d != null);
    if (times.length === 0) return null;
    return new Date(
      Math.max(...times.map((d) => d.getTime())),
    ).toISOString();
  }

  private pickLegalSnapshot(
    projects: Array<{
      id: string;
      title: string;
      tenderContractTermsJson: unknown;
      updatedAt: Date;
    }>,
  ): AdminClientLegalSnapshot | null {
    for (const project of projects) {
      const terms = this.readEmployerTerms(project.tenderContractTermsJson);
      if (!terms) continue;
      return {
        ...terms,
        sourceProjectId: project.id,
        sourceProjectTitle: project.title,
      };
    }
    return null;
  }

  private readEmployerTerms(
    raw: unknown,
  ): Omit<
    AdminClientLegalSnapshot,
    'sourceProjectId' | 'sourceProjectTitle'
  > | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;
    const employerName =
      typeof obj.employerName === 'string' ? obj.employerName.trim() : '';
    const employerAddress =
      typeof obj.employerAddress === 'string'
        ? obj.employerAddress.trim()
        : '';
    const employerRegistrationNo =
      typeof obj.employerRegistrationNo === 'string'
        ? obj.employerRegistrationNo.trim()
        : '';
    if (!employerName && !employerAddress && !employerRegistrationNo) {
      return null;
    }
    return {
      employerName: employerName || null,
      employerAddress: employerAddress || null,
      employerRegistrationNo: employerRegistrationNo || null,
    };
  }
}
