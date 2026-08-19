'use client';

import { useMemo } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import {
  demoBids,
  demoBrief,
  demoClarificationQuestions,
  demoCompareBreakdown,
  demoContractorApplication,
  demoContractorApplications,
  demoContractorReviewPreview,
  demoDocuments,
  demoEstimateLines,
  demoMarketplaceTiles,
  demoOwnedProjectTile,
  demoProgressPreviewLines,
  demoProject,
  demoProjectTags,
} from '@/lib/marketing/demo-fixtures';

export function useLocalizedDemoContent() {
  const { t } = useTranslation();
  const { formatTagLabel } = useAppFormatters();

  return useMemo(() => {
    const tags = demoProjectTags.map((tag) => ({
      ...tag,
      label: formatTagLabel(tag.slug, tag.label),
    }));

    const brief = {
      ...demoBrief,
      summary: t('explainer.demo.briefSummary'),
      constraints: t('explainer.demo.constraints'),
      ai: {
        missingFields: [t('explainer.demo.missingKitchenSchedule')],
      },
      packages: [
        {
          trade: t('explainer.demo.packageKitchen'),
          description: t('explainer.demo.packageKitchenDesc'),
          areaSqm: 85,
        },
        {
          trade: t('explainer.demo.packageMep'),
          description: t('explainer.demo.packageMepDesc'),
          areaSqm: 420,
        },
      ],
    };

    const estimateLines = demoEstimateLines.map((line, index) => {
      const descriptions = [
        t('explainer.demo.estimateKitchen'),
        t('explainer.demo.estimateHvac'),
        t('explainer.demo.estimatePlumbing'),
        t('explainer.demo.estimateElectrical'),
        t('explainer.demo.estimateFinishes'),
      ];
      const trades = [
        t('explainer.demo.tradeKitchen'),
        t('explainer.demo.tradeHvac'),
        t('explainer.demo.tradePlumbing'),
        t('explainer.demo.tradeElectrical'),
        t('explainer.demo.tradeFinishes'),
      ];
      return {
        ...line,
        trade: trades[index] ?? line.trade,
        description: descriptions[index] ?? line.description,
      };
    });

    const project = {
      ...demoProject,
      title: t('explainer.demo.projectTitle'),
      description: t('explainer.demo.projectDescription'),
      clarificationSummary: t('explainer.demo.clarificationSummary'),
      scopeSummary: t('explainer.demo.scopeSummary'),
      tags,
      brief,
      estimate: demoProject.estimate
        ? {
            ...demoProject.estimate,
            lines: estimateLines,
            improvementQuestions: [t('explainer.clients.previews.refineQuestion')],
            refinementAnswers: demoProject.estimate.refinementAnswers?.map(
              (item) => ({
                ...item,
                question: t('explainer.clients.previews.refineQuestion'),
                answer: t('explainer.clients.previews.optionReplace'),
              }),
            ),
          }
        : demoProject.estimate,
    };

    const ownedTile = {
      ...demoOwnedProjectTile,
      title: project.title,
      description: project.description,
      tags: tags.map(({ slug, label }) => ({ slug, label })),
    };

    const marketplaceTiles = demoMarketplaceTiles.map((tile, index) => {
      if (index === 0) return ownedTile;
      if (tile.id === 'demo-condo-fitout') {
        return {
          ...tile,
          title: t('explainer.demo.condoTitle'),
          description: t('explainer.demo.condoDescription'),
          tags: tile.tags.map((tag) => ({
            ...tag,
            label: formatTagLabel(tag.slug, tag.label),
          })),
        };
      }
      return {
        ...tile,
        title: t('explainer.demo.resortTitle'),
        description: t('explainer.demo.resortDescription'),
        tags: tile.tags.map((tag) => ({
          ...tag,
          label: formatTagLabel(tag.slug, tag.label),
        })),
      };
    });

    const questions = demoClarificationQuestions.map((question, index) => {
      const texts = [
        t('explainer.demo.q1'),
        t('explainer.demo.q2'),
        t('explainer.demo.q3'),
      ];
      const answers = [
        t('explainer.demo.q1Answer'),
        t('explainer.demo.q2Answer'),
        null,
      ];
      return {
        ...question,
        questionText: texts[index] ?? question.questionText,
        answer: answers[index] ?? question.answer,
      };
    });

    const tradeLabel = (trade: string) => {
      const key = trade.toLowerCase();
      if (key === 'demolition') return t('explainer.demo.tradeDemolition');
      if (key === 'tiling') return t('explainer.demo.tradeTiling');
      if (key === 'joinery') return t('explainer.demo.tradeJoinery');
      if (key === 'mep') return t('explainer.demo.tradeMep');
      return trade;
    };

    const bids = demoBids.map((bid, index) => {
      const scopes = [
        t('explainer.demo.bidAScope'),
        t('explainer.demo.bidBScope'),
        t('explainer.demo.bidCScope'),
      ];
      const notes = [
        t('explainer.demo.bidANotes'),
        t('explainer.demo.bidBNotes'),
        undefined,
      ];
      return {
        ...bid,
        terms: bid.terms
          ? {
              ...bid.terms,
              scopeSummary: scopes[index] ?? bid.terms.scopeSummary,
              notes: notes[index] ?? bid.terms.notes,
              lineItems: bid.terms.lineItems?.map((item) => ({
                ...item,
                trade: tradeLabel(item.trade),
                description:
                  item.trade === 'Tiling' && item.description
                    ? t('explainer.demo.tilingDesc')
                    : item.description,
              })),
            }
          : bid.terms,
      };
    });

    const compareBreakdown = demoCompareBreakdown.map((item) => ({
      ...item,
      trade: tradeLabel(item.trade),
    }));

    const documents = demoDocuments.map((doc, index) => ({
      ...doc,
      fileName: [
        t('explainer.demo.docFloorPlans'),
        t('explainer.demo.docKitchenPhotos'),
        t('explainer.demo.docMep'),
      ][index] ?? doc.fileName,
    }));

    const applications = demoContractorApplications.map((app, index) => ({
      ...app,
      projectTitle:
        index === 0
          ? t('explainer.demo.projectTitle')
          : t('explainer.demo.condoTitle'),
      description:
        index === 0
          ? t('explainer.demo.appPublished')
          : t('explainer.demo.appEnrolled'),
    }));

    const progressLines = demoProgressPreviewLines.map((line) => ({
      ...line,
      trade:
        line.trade === 'Kitchen'
          ? t('explainer.demo.tradeKitchen')
          : line.trade === 'MEP'
            ? t('explainer.demo.tradeMep')
            : t('explainer.demo.tradeFinishes'),
    }));

    const review = {
      ...demoContractorReviewPreview,
      comment: t('explainer.demo.reviewComment'),
    };

    return {
      project,
      brief,
      tags,
      ownedTile,
      marketplaceTiles,
      questions,
      bids,
      compareBreakdown,
      documents,
      applications,
      application: {
        ...demoContractorApplication,
        projectTitle: t('explainer.demo.projectTitle'),
        description: t('explainer.demo.appPublished'),
      },
      progressLines,
      review,
    };
  }, [formatTagLabel, t]);
}
