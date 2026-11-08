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

## Guest hero (`/`)

A visitor without a session gets an offer above the project grid, rendered on the
**server** from the cookie jar (`lib/guest-request.ts`) so it is part of the first
HTML and the grid does not shift after hydration. It lives **inside the results
column**, so on wide screens it covers the grid only and the filters sidebar starts
at the top instead of leaving an empty gap beside it. One project-tile row tall on
desktop, a compact strip on phones.

The photo sits on the right and fades to transparent towards the left
(`mask-image: linear-gradient(to left, …)`); it is kept faint (50 %) because the
two columns render on top of it. It is `public/home-hero-guest.webp` (44 KB,
generated from `home-hero-bg.png`) and is hidden on phones, where it would cost
bytes without being seen.

Layout: headline and subtitle on the full width, then the two doors of the
platform side by side (`repeat(2, minmax(0, 1fr))`), stacked on phones. The panel
fills the results column, so a wide screen shows two equal offers instead of one
narrow column of text.

| Column | Element | Action | Event |
|--------|---------|--------|-------|
| Client | "Estimate my project — free" | opens the guest create modal | `cta_click` `placement=hero_estimate` |
| Contractor | "Browse open projects" | turns on the *available* filter and scrolls to the grid | `cta_click` `placement=hero_contractor_browse` |
| Contractor | "Sign up as a contractor" | `/?role=contractor` → sign-up dialog with the role pre-selected | `cta_click` `placement=hero_contractor_signup` |

The sign-up role is seeded through `LoginModal`'s `initialRoles`, so a visitor
arriving from a contractor call to action ticks contractor (or designer) without
choosing again. `?role=client` works the same way.

The hero itself is a server component; its buttons live in `GuestHeroActions` and
reach the modal/filters through `ant:open-create` and `ant:browse-contractor`
events, so the home page stays a client island only where it must be.

Because the panel is server-rendered, switching the language calls
`router.refresh()` (`LocaleProvider.setLocale`): the client-rendered columns follow
the context immediately, and the refresh re-renders the server text (headline,
subtitle, footnote, marketing pages) in the new language. Without it a visitor who
switched to Thai saw the headline and subtitle in the previous language while the
columns were already translated.

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
