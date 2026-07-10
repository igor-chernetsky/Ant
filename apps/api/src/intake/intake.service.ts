import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Prisma, ProjectStatus, TagSource } from '@prisma/client';
import { sanitizeIntakeQuestion } from '../ai/intake-question.utils';
import { IntakeFallbackService } from '../ai/intake-fallback.service';
import {
  INTAKE_OTHER_OPTION_ID,
  InitialIntakeResult,
  IntakeQuestion,
  IntakeState,
  ProjectIntakeContext,
  SubmitAnswerDto,
} from '../ai/intake.types';
import { OpenAiIntakeService } from '../ai/openai-intake.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
} from '../users/locale.types';
import { normalizeSourceLocale } from '../localization/locale.utils';
import {
  ProjectBriefV1,
  buildInitialBrief,
  computeReadinessScore,
} from '../projects/project-brief';
import { buildDocumentIntakeContext } from './intake-document-context';
import { ProjectResponse } from '../projects/projects.types';
import { EstimatesService } from '../estimation/estimates.service';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAi: OpenAiIntakeService,
    private readonly fallback: IntakeFallbackService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
    private readonly estimatesService: EstimatesService,
  ) {}

  async runInitialIntakeForProject(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) return;

    const context = await this.buildContext(
      project,
      (project.briefJson ?? null) as unknown as ProjectBriefV1 | null,
    );
    let result: InitialIntakeResult | null = null;

    if (this.openAi.isConfigured()) {
      result = await this.openAi.runInitialIntake(context);
    }
    if (!result) {
      result = this.fallback.runInitialIntake(context);
    }

    const tagSlugs = this.filterTagSlugs(
      result.tagSlugs,
      context.availableTagSlugs,
    );
    await this.replaceAiTags(projectId, tagSlugs);

    const brief = this.mergeBrief(project.briefJson, {
      summary: result.improvedDescription,
      ai: {
        originalNarrative: project.description ?? '',
        improvedDescription: result.improvedDescription,
        confidence: result.confidence,
        intake: result.intake,
      },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        description: result.improvedDescription,
        status: ProjectStatus.intake,
        briefJson: brief as unknown as Prisma.InputJsonValue,
        readinessScore: computeReadinessScore({
          title: project.title,
          description: result.improvedDescription,
          projectType: project.projectType,
          propertyType: project.propertyType,
          district: project.district,
          tagCount: tagSlugs.length,
          brief,
        }),
      },
    });
  }

  async submitAnswer(
    clientId: string,
    projectId: string,
    dto: SubmitAnswerDto,
    viewerLocale?: import('../users/locale.types').SupportedLocale,
  ): Promise<ProjectResponse> {
    const project = await this.loadOwnedProject(clientId, projectId);
    const brief = (project.briefJson ?? {}) as unknown as ProjectBriefV1;
    const intake = brief.ai?.intake;

    if (
      !intake ||
      intake.status === 'completed' ||
      intake.status === 'processing'
    ) {
      throw new BadRequestException('Intake is not accepting answers');
    }

    const rawCurrent = intake.currentQuestion;
    if (!rawCurrent) {
      throw new BadRequestException('No active question');
    }

    const current = sanitizeIntakeQuestion(rawCurrent);

    if (dto.questionId !== current.id) {
      throw new BadRequestException(
        'Answer does not match the current question. Refresh the page and try again.',
      );
    }

    const parsed = this.parseAnswer(current, dto);

    const answers = [
      ...intake.answers.filter((a) => a.questionId !== current.id),
      {
        questionId: current.id,
        value: parsed.value,
        skipped: parsed.skipped,
        customText: parsed.customText,
        answeredAt: new Date().toISOString(),
      },
    ];

    const context = await this.buildContext(
      {
        ...project,
        description: brief.ai?.improvedDescription ?? project.description,
      },
      brief,
    );
    context.improvedDescription =
      brief.ai?.improvedDescription ?? project.description ?? undefined;
    context.answers = answers;
    context.askedQuestionIds = intake.askedQuestionIds;

    let nextQuestion: IntakeQuestion | null = null;
    let improvedDescription = brief.ai?.improvedDescription;

    if (this.openAi.isConfigured()) {
      const next = await this.openAi.getNextQuestion(context, {
        questionId: current.id,
        value: parsed.value,
        skipped: parsed.skipped,
        customText: parsed.customText,
      });
      if (next) {
        nextQuestion = this.acceptNextQuestion(
          next.nextQuestion,
          intake.askedQuestionIds,
          answers,
        );
        if (next.improvedDescription) {
          improvedDescription = next.improvedDescription;
        }
      }
    }

    if (!nextQuestion) {
      const fallbackNext = this.fallback.getNextQuestion(context);
      nextQuestion = this.acceptNextQuestion(
        fallbackNext.nextQuestion,
        intake.askedQuestionIds,
        answers,
      );
    }

    if (nextQuestion) {
      nextQuestion = sanitizeIntakeQuestion(nextQuestion);
    }

    const askedQuestionIds = [...intake.askedQuestionIds];
    if (nextQuestion && !askedQuestionIds.includes(nextQuestion.id)) {
      askedQuestionIds.push(nextQuestion.id);
    }

    const updatedIntake: IntakeState = {
      ...intake,
      status: nextQuestion ? 'awaiting_answers' : 'ready_to_submit',
      answers,
      currentQuestion: nextQuestion,
      improvedDescription,
      askedQuestionIds,
    };

    const updatedBrief = this.mergeBrief(project.briefJson, {
      summary: improvedDescription ?? brief.summary,
      ai: {
        ...brief.ai,
        improvedDescription,
        intake: updatedIntake,
      },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        description: improvedDescription ?? project.description,
        briefJson: updatedBrief as unknown as Prisma.InputJsonValue,
      },
    });

    return this.projectsService.getForClient(clientId, projectId, viewerLocale);
  }

  async submitForProcessing(
    clientId: string,
    projectId: string,
    viewerLocale?: import('../users/locale.types').SupportedLocale,
  ): Promise<ProjectResponse> {
    const project = await this.loadOwnedProject(clientId, projectId);
    const brief = (project.briefJson ?? {}) as unknown as ProjectBriefV1;
    const intake = brief.ai?.intake;

    if (!intake) {
      throw new BadRequestException('Intake not started');
    }

    if (intake.status === 'completed') {
      return this.projectsService.getForClient(clientId, projectId, viewerLocale);
    }

    if (intake.status === 'awaiting_answers' && intake.currentQuestion) {
      throw new BadRequestException('Please answer the current question first');
    }

    const context = await this.buildContext(project, brief);
    context.improvedDescription =
      brief.ai?.improvedDescription ?? project.description ?? undefined;
    context.answers = intake.answers;

    let final = this.openAi.isConfigured()
      ? await this.openAi.finalizeIntake(context)
      : null;
    if (!final) {
      final = this.fallback.finalizeIntake(context);
    }

    const tagSlugs = this.filterTagSlugs(
      final.tagSlugs,
      context.availableTagSlugs,
    );
    await this.replaceAiTags(projectId, tagSlugs);

    const completedIntake: IntakeState = {
      ...intake,
      status: 'completed',
      currentQuestion: null,
      improvedDescription: final.finalDescription,
    };

    const updatedBrief = this.mergeBrief(project.briefJson, {
      summary: final.summary,
      ai: {
        ...brief.ai,
        improvedDescription: final.finalDescription,
        confidence: final.confidence,
        intake: completedIntake,
      },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        description: final.finalDescription,
        status: ProjectStatus.ready_for_estimate,
        briefJson: updatedBrief as unknown as Prisma.InputJsonValue,
        readinessScore: computeReadinessScore({
          title: project.title,
          description: final.finalDescription,
          projectType: project.projectType,
          propertyType: project.propertyType,
          district: project.district,
          tagCount: tagSlugs.length,
          brief: updatedBrief,
        }),
      },
    });

    await this.estimatesService.generateAndStore(projectId);

    return this.projectsService.getForClient(clientId, projectId, viewerLocale);
  }

  private async loadOwnedProject(clientId: string, projectId: string) {
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

  private acceptNextQuestion(
    candidate: IntakeQuestion | null,
    askedQuestionIds: string[],
    answers: Array<{ questionId: string }>,
  ): IntakeQuestion | null {
    if (!candidate) {
      return null;
    }
    const resolved = sanitizeIntakeQuestion(candidate);
    const seen = new Set([
      ...askedQuestionIds,
      ...answers.map((a) => a.questionId),
    ]);
    if (seen.has(resolved.id)) {
      return null;
    }
    return resolved;
  }

  private async buildContext(
    project: {
      title: string;
      description: string | null;
      projectType: string;
      propertyType: string | null;
      district: string | null;
      sourceLocale?: string;
    },
    brief?: ProjectBriefV1 | null,
  ): Promise<ProjectIntakeContext> {
    const tags = await this.prisma.tag.findMany({ select: { slug: true } });
    const documents = buildDocumentIntakeContext(brief);
    return {
      title: project.title,
      description: project.description,
      projectType: project.projectType,
      propertyType: project.propertyType,
      district: project.district,
      answers: [],
      availableTagSlugs: tags.map((t) => t.slug),
      locale: normalizeSourceLocale(project.sourceLocale),
      ...(documents.length > 0 ? { documents } : {}),
    };
  }

  private filterTagSlugs(slugs: string[], allowed: string[]): string[] {
    const allowedSet = new Set(allowed);
    return [...new Set(slugs.filter((s) => allowedSet.has(s)))];
  }

  private async replaceAiTags(projectId: string, slugs: string[]) {
    await this.prisma.projectTag.deleteMany({
      where: { projectId, source: TagSource.ai },
    });

    if (slugs.length === 0) return;

    const tags = await this.prisma.tag.findMany({
      where: { slug: { in: slugs } },
    });

    await this.prisma.projectTag.createMany({
      data: tags.map((tag) => ({
        projectId,
        tagId: tag.id,
        source: TagSource.ai,
      })),
      skipDuplicates: true,
    });
  }

  private parseAnswer(
    question: IntakeQuestion,
    dto: SubmitAnswerDto,
  ): { value: string | string[]; skipped?: boolean; customText?: string } {
    if (question.type === 'info') {
      return { value: '' };
    }

    if (dto.skipped) {
      if (question.allowSkip === false) {
        throw new BadRequestException('This question cannot be skipped');
      }
      return { value: '', skipped: true };
    }

    const customText = dto.customText?.trim();

    if (question.type === 'text') {
      const value = typeof dto.value === 'string' ? dto.value.trim() : '';
      if (question.required && !value && !customText) {
        throw new BadRequestException('An answer is required');
      }
      return { value: value || customText || '' };
    }

    if (question.type === 'single') {
      const value = typeof dto.value === 'string' ? dto.value : '';
      if (!value && question.required) {
        throw new BadRequestException('Please select an option');
      }
      if (value === INTAKE_OTHER_OPTION_ID) {
        if (question.allowCustom === false) {
          throw new BadRequestException('Custom answers are not allowed');
        }
        if (!customText) {
          throw new BadRequestException('Please enter your answer');
        }
        return { value: INTAKE_OTHER_OPTION_ID, customText };
      }
      if (value && !question.options?.some((o) => o.id === value)) {
        throw new BadRequestException('Invalid option');
      }
      return { value };
    }

    const values = Array.isArray(dto.value)
      ? dto.value.filter((v) => typeof v === 'string')
      : typeof dto.value === 'string' && dto.value
        ? [dto.value]
        : [];

    const hasOther = values.includes(INTAKE_OTHER_OPTION_ID);
    const optionIds = values.filter((v) => v !== INTAKE_OTHER_OPTION_ID);

    if (question.required && optionIds.length === 0 && !hasOther) {
      throw new BadRequestException('Select at least one option');
    }

    for (const value of optionIds) {
      if (!question.options?.some((o) => o.id === value)) {
        throw new BadRequestException('Invalid option selected');
      }
    }

    if (hasOther) {
      if (question.allowCustom === false) {
        throw new BadRequestException('Custom answers are not allowed');
      }
      if (!customText) {
        throw new BadRequestException('Please describe your other option');
      }
      return {
        value: [...optionIds, INTAKE_OTHER_OPTION_ID],
        customText,
      };
    }

    return { value: optionIds };
  }

  private mergeBrief(
    existing: unknown,
    patch: Partial<ProjectBriefV1> & { ai?: ProjectBriefV1['ai'] },
  ): ProjectBriefV1 {
    const base =
      existing && typeof existing === 'object'
        ? (existing as ProjectBriefV1)
        : buildInitialBrief({});

    return {
      ...base,
      ...patch,
      ai: {
        ...base.ai,
        ...patch.ai,
        intake: patch.ai?.intake ?? base.ai?.intake,
      },
    };
  }
}
