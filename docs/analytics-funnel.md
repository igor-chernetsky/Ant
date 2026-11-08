# Acquisition funnel

What we measure, why, and how to judge ad spend. GA4 is loaded with
`send_page_view: false` (`components/GoogleAnalytics.tsx`), so page views are
explicit and product events carry the campaign.

## Entry points

| URL | Purpose |
|-----|---------|
| `/` | Marketplace home (public project grid) |
| `/start` | **Ad landing alias** — redirects to `/?create=1` |
| `/?create=1` | Home with the create-project modal already open (guest estimate flow) |

`/start` exists so an ad's landing URL never has to carry a query string. Both
paths open the create modal; for `?create=1` the query is removed from the URL
right after (`router.replace('/')`), which is why `landing_view` reports the
original `landing_path`.

## Events

| Event | When | Params |
|-------|------|--------|
| `landing_view` | Once per full page load (root layout) | `entry`, `landing_path`, `has_create_param`, `utm_*`, `referrer_host` |
| `cta_click` | Any "create project" click | `placement`: `header` \| `grid_tile` \| `empty_state` \| `ad_deeplink`, `is_guest` |
| `estimate_started` | A project was created from the form | `mode`: `guest` \| `client`, `project_type`, `property_type` |
| `estimate_shown` | A priced estimate is on screen | `project_id`, `is_guest`, `is_owner`, `line_count`, `confidence` |
| `create_project` | Authenticated create (pre-existing) | project/type/location |

All four funnel events go through `trackLandingEvent`, which attaches the
first-touch landing context (`lib/utm.ts`, `sessionStorage` key
`ant_landing_ctx`): `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`,
`utm_term`, `referrer_host`, `entry`, `landing_path`, `has_create_param`.
First touch of the session wins; internal navigations do not overwrite it.
No PII is stored — campaign strings are clamped to 120 chars and control
characters are stripped.

## What to watch in GA4

Segment by `utm_source` (report: Explore → free form, dimension `utm_source`):

| Metric | Paid Social today (Oct 11 – Nov 7, 2026) | Target |
|--------|------------------------------------------|--------|
| Sessions | 795 of 1,190 (66.8 %) | — |
| Engagement rate | 7.4 % | ≥ 25 % |
| Avg engagement time | 2 s | ≥ 20 s |
| `estimate_started` | 0 (not measured yet) | ≥ 5–8 % of paid sessions |
| Key events | 0 | > 0 |

Judging by the other channels (Direct 68 % engagement, Organic Social 84 %),
the product converts when intent matches: ~13 key events per 100 sessions.
Paid Social at 0 key events for ~795 sessions is the leak to fix first.

Stop-loss: if after the ad lands on `/start` and two weeks of data the paid
channel still shows ~2 s and no `estimate_started`, pause that ad set instead of
redesigning the page further.

## Local testing

`lib/utm.ts` is pure (`readLandingContext`, `landingEventParams`) and accepts a
storage stub, so the campaign mapping is unit-tested without a browser. The GA4
`gtag` call itself is a no-op when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is unset.
