'use client';

import { useEffect, useState } from 'react';
import {
  fetchContractorClarificationAttachments,
  getContractorClarificationAttachmentDownloadUrl,
  type ContractorClarificationAttachmentQuestion,
} from '@/lib/clarification-attachments';
import { formatFileSize } from '@/lib/documents';

interface ContractorClarificationAttachmentsProps {
  projectId: string;
  enabled?: boolean;
}

export function ContractorClarificationAttachments({
  projectId,
  enabled = true,
}: ContractorClarificationAttachmentsProps) {
  const [questions, setQuestions] = useState<
    ContractorClarificationAttachmentQuestion[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setQuestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchContractorClarificationAttachments(projectId);
        if (!cancelled) {
          setQuestions(data.questions);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load attachments',
          );
          setQuestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, enabled]);

  const handleDownload = async (
    questionId: string,
    attachmentId: string,
  ) => {
    setError(null);
    setDownloadingId(attachmentId);
    try {
      const { downloadUrl } = await getContractorClarificationAttachmentDownloadUrl(
        projectId,
        questionId,
        attachmentId,
      );
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!enabled || loading || questions.length === 0) {
    return null;
  }

  return (
    <div className="contractor-clarification-attachments">
      <h3 className="tender-subsection-title">Answer attachments</h3>
      <p className="muted contractor-clarification-attachments-hint">
        Files the client added when answering clarification questions.
      </p>
      <ul className="contractor-clarification-attachments-groups">
        {questions.map((question) => (
          <li
            key={question.id}
            className="contractor-clarification-attachments-group"
          >
            <p className="contractor-clarification-attachments-question">
              {question.questionText}
            </p>
            <ul className="clarification-answer-attachments-list">
              {question.attachments.map((file) => (
                <li
                  key={file.id}
                  className="clarification-answer-attachments-item"
                >
                  <button
                    type="button"
                    className="text-link clarification-answer-attachments-name"
                    disabled={downloadingId === file.id}
                    onClick={() => void handleDownload(question.id, file.id)}
                  >
                    {downloadingId === file.id
                      ? 'Preparing download…'
                      : file.originalName}
                  </button>
                  <span className="muted clarification-answer-attachments-meta">
                    {formatFileSize(file.sizeBytes)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
