---
name: ant-notifications
description: >-
  BuilTHAI email and in-app notification system. Use when adding notify* methods,
  InAppNotification kinds, header bell/toasts, notification preferences, or
  changing bid/tender/contract events that should alert users.
---

# BuilTHAI notifications (email + in-app)

## Two channels

| Channel | Storage | Delivery |
|---------|---------|----------|
| Email | SMTP + `NotificationEmailLog` | `NotificationsService.sendToUser` (respects prefs; no-op if SMTP off) |
| In-app | `InAppNotification` | Created independently of SMTP; polled by web while logged in |

Never use `NotificationEmailLog` as an inbox.

## Key files

- Service: `apps/api/src/notifications/notifications.service.ts`
- Types: `apps/api/src/notifications/notification.types.ts`
- Schema: `InAppNotification` / `InAppNotificationKind` in `apps/api/prisma/schema.prisma`
- API: `GET /v1/me/notifications`, `POST /v1/me/notifications/read` (`users.controller.ts`)
- Web poll/UI: `InAppNotificationsProvider`, `HeaderNotifications`, `NotificationToasts`
- Copy formatting: `apps/web/src/lib/in-app-notification-copy.ts`
- i18n: `notifications.*` in `en.ts` / `ru.ts` / `th.ts`

## Adding a new event

1. Add enum value to **both** Prisma `InAppNotificationKind` (and migration) **and** web `InAppNotificationKind` / DTO unions if needed.
2. In the `notify*` method, call `createInAppNotification` **before** (or regardless of) `sendToUser`:
   - `userId`, `kind`, `href` (app path like `/projects/{id}/bids`), `projectId`, language-neutral `payload`.
3. Add title/body keys under `notifications.kinds.*` in **en / ru / th**.
4. Extend `formatInAppNotificationTitle` / `Body` in `in-app-notification-copy.ts`.
5. Wire `this.notifications.dispatch(this.notifications.notify…())` from the domain service (same pattern as existing bid submit).

## Payload conventions

- Store facts, not translated sentences: `projectTitle`, `companyName`, `amount`, etc.
- `href` is a **relative** web path (not absolute `WEB_APP_URL`).

## In-app kinds already wired

- `client_bid_submitted` — KP received (primary)
- `client_bid_enrolled`
- `client_tender_deadline_reached`
- `client_contractor_declined_proposal`

Enum also reserves contractor/contract kinds; wire them when adding those notify paths to in-app.

## Web behavior

- Poll ~20s while tab visible; toast on newly seen unread ids.
- Header bell: badge + list; mark one or all read.
- Email remains the offline fallback; do not skip creating in-app when mail is disabled.

## Checklist

```
- [ ] In-app row created even if SMTP is unset
- [ ] Prisma enum + migration + TS unions updated together
- [ ] en/ru/th notification strings added
- [ ] href points at the right client page
```
