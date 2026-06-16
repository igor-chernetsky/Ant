'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchBidMessages,
  sendBidMessage,
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
  title = 'Questions & answers',
}: BidChatProps) {
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
      setError(err instanceof Error ? err.message : 'Failed to load messages');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [bidId, projectId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

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
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bid-chat">
      <h4 className="bid-chat-title">{title}</h4>
      <p className="muted bid-chat-hint">
        Ask clarifying questions about scope, access, or timeline.
      </p>

      <div className="bid-chat-messages" ref={listRef}>
        {loading && <p className="muted">Loading messages…</p>}
        {!loading && messages.length === 0 && (
          <p className="muted">No messages yet. Start the conversation.</p>
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
          placeholder="Write a message…"
          rows={3}
          disabled={busy}
        />
        <button type="submit" className="primary" disabled={busy || !draft.trim()}>
          {busy ? 'Sending…' : 'Send'}
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
