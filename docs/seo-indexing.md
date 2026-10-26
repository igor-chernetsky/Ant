# Search indexing (Search Console)

Notes behind the rules that keep Google's crawl of this site focused, written
after the Search Console export of October 2026: 30 indexed pages, 70 excluded,
of which **60 were "Discovered — currently not indexed"**. That bucket is a crawl
budget signal, not a markup error: Google knew the URLs from the sitemap and
simply did not fetch them.

## What the sitemap advertises

`app/sitemap.ts` lists the nine marketing pages plus project pages. Project URLs
are filtered by `shouldListProjectInSitemap` (`lib/sitemap-crawl-policy.ts`):

| Project | Listed? |
|---------|---------|
| `isHidden` | no — not public |
| `completed` | no — archived example, nobody can bid, nothing to rank for |
| no description | no — the anonymous view is a title and a location, so the page is thin |
| published with a description | yes, priority 0.6 with trades / 0.4 without |

Before this rule the sitemap promised ~90 project URLs, which is what produced
the 60 deferred ones. Fewer, better URLs are crawled sooner.

`/projects/:id` pages of discoverable projects stay indexable even for anonymous
visitors (the API serves a locked projection with title, description, location,
trades and tags), while `?invite=` URLs are `noindex` and hidden projects are
`noindex`.

## Real 404s for dead project URLs

The public endpoint answers 404 both for a deleted project and for one that is not
public yet (a guest draft), and server rendering cannot tell them apart without
the caller's cookies. `resolveProjectPageDecision` (`lib/project-page-state.ts`)
therefore answers an HTTP 404 only when all of these hold:

- the public endpoint said 404,
- the request carries no invite token,
- the request carries no session and no guest token for this project.

Everything else renders: a loaded project, a backend failure (the client retries
after a session refresh), an invite flow, or a caller who might still own the
project. This replaced a 200 response with a client-side "not found" screen,
which search engines treat as a soft 404.

## Known follow-ups (not done yet)

- Marketing pages still render per request because the root layout reads the
  locale cookie; making them static/ISR would cut TTFB and crawl cost.
- The CSVs exported so far (`report/Metadata.csv`, `report/Non-critical issues.csv`)
  were empty, so the URL-level lists for the 2 × 404, 2 × duplicate-without-canonical,
  1 × blocked-by-robots and 3 × redirect entries are still unknown.
