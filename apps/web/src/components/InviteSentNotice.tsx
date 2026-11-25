'use client';

/**
 * Confirmation that an invitation email went out.
 *
 * The modal used to print a muted line deep inside a scrollable table, so after
 * pressing "Send email invite" it looked like nothing had happened. This is a small,
 * always-visible banner next to the action buttons, announced politely to screen
 * readers.
 */
export function InviteSentNotice({ message }: { message: string }) {
  return (
    <p className="invite-sent-banner" role="status" aria-live="polite">
      <span className="invite-sent-banner-icon" aria-hidden>
        ✓
      </span>
      <span>{message}</span>
    </p>
  );
}
