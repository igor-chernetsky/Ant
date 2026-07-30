---
name: ant-i18n
description: >-
  Keeps BuilTHAI web UI copy in sync across en, ru, and th locales. Use when adding
  or changing user-visible strings, translation keys, LocaleProvider/t(),
  message files, or anything involving i18n / localization on apps/web.
---

# BuilTHAI i18n (en / ru / th)

## Rules

1. **Always update all three locales** in the same change:
   - `apps/web/src/lib/i18n/messages/en.ts` (+ `en-extended.ts` when the key lives there)
   - `apps/web/src/lib/i18n/messages/ru.ts` (+ `ru-extended.ts`)
   - `apps/web/src/lib/i18n/messages/th.ts` (+ `th-extended.ts`)
2. **Mirror key structure exactly** — `Messages` is typed from English; missing keys break typecheck.
3. Prefer existing namespaces (`header`, `bid`, `contractTerms`, `notifications`, …). Add a new namespace only when nothing fits.
4. Core short strings → `en.ts` / `ru.ts` / `th.ts`. Domain / long copy → `*-extended.ts`.
5. Interpolate with `{name}` placeholders; call `t('key', { name: value })`.
6. Do not hardcode UI English/Russian/Thai in components when a message key exists or should exist.

## Workflow

```
- [ ] Add/change key in en (+ extended if needed)
- [ ] Same key path in ru and th
- [ ] Use t('namespace.key') in the component
- [ ] Spot-check: no leftover hardcoded user-facing string
```

## API / PDF copy

Server PDF and email strings are separate:

- Commercial proposal PDF: `apps/api/src/tendering/commercial-proposal.i18n.ts`
- Email notifications: `apps/api/src/notifications/notification-i18n.ts` (and inline subjects in `notifications.service.ts`)

When changing PDF/email wording, update **en / ru / th** blocks there too — not only `apps/web` messages.

## In-app notifications

Titles/bodies for the header inbox are keyed under `notifications.*` in `en.ts` / `ru.ts` / `th.ts`. Payload fields stay language-neutral (`projectTitle`, `companyName`, `amount`); the client formats via `apps/web/src/lib/in-app-notification-copy.ts`.
