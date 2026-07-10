'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  fetchBidMessages,
  sendBidMessage,
  touchBidChatPresence,
  BID_CHAT_PRESENCE_INTERVAL_MS,
  type BidMessage,
} from '@/lib/tendering';

interface BidChatProps {
  bidId: string;
  projectId?: string;
  currentUserId: string;
  title?: string;
}

export function BidChat({
  bidId,
  projectId,
  currentUserId,
  title,
}: BidChatProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('bid.chatTitle');
  const [messages, setMessages] = useState<BidMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBidMessages(bidId, projectId);
      setMessages(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('bid.loadMessagesFailed'),
      );
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [bidId, projectId, t]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const ping = () => {
      if (document.visibilityState === 'visible') {
        touchBidChatPresence(bidId, projectId);
      }
    };

    const startHeartbeat = () => {
      ping();
      intervalId = setInterval(ping, BID_CHAT_PRESENCE_INTERVAL_MS);
    };

    const stopHeartbeat = () => {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    };

    if (document.visibilityState === 'visible') {
      startHeartbeat();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopHeartbeat();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [bidId, projectId]);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;

    setBusy(true);
    setError(null);
    try {
      const message = await sendBidMessage(bidId, body, projectId);
      setMessages((prev) => [...prev, message]);
      setDraft('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('bid.sendMessageFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bid-chat">
      <h4 className="bid-chat-title">{resolvedTitle}</h4>
      <p className="muted bid-chat-hint">{t('bid.chatHint')}</p>

      <div className="bid-chat-messages" ref={listRef}>
        {loading && <p className="muted">{t('bid.loadingMessages')}</p>}
        {!loading && messages.length === 0 && (
          <p className="muted">{t('bid.noMessages')}</p>
        )}
        {messages.map((message) => {
          const mine = message.authorId === currentUserId;
          return (
            <div
              key={message.id}
              className={`bid-chat-message${mine ? ' bid-chat-message-mine' : ''}`}
            >
              <p className="bid-chat-message-body">{message.body}</p>
              <time className="bid-chat-message-time" dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleString()}
              </time>
            </div>
          );
        })}
      </div>

      <form
        className="bid-chat-compose"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('bid.messagePlaceholder')}
          rows={3}
          disabled={busy}
        />
        <button type="submit" className="primary" disabled={busy || !draft.trim()}>
          {busy ? t('common.sending') : t('common.send')}
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
