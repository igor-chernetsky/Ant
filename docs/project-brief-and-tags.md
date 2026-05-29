# Project brief and tags

Hybrid project model: structured core fields plus versioned `brief_json`, with a tag catalog for scope and search.

## Core project fields

| Field | Purpose |
|-------|---------|
| `title`, `description` | Human-readable summary |
| `projectType` | renovation, new_build, extension, … |
| `propertyType` | apartment, house, commercial, … |
| `district` | Location hint for contractors |
| `regionCode` | Country/region (default `TH`) |
| `readinessScore` | 0–100 completeness for intake |
| `briefJson` | Structured brief v1 (see schema) |

## Brief v1 (`packages/contracts-schemas/brief.v1.schema.json`)

Sections: `summary`, `packages[]`, `property`, `materials`, `timeline`, `design`, `constraints`, `ai`.

On create, the API builds an initial brief from the form and stores AI metadata (`missingFields`, `confidence`).

## Tags

### Catalog

- **System tags** — seeded in migration (English slugs): `electrical`, `plumbing`, `roofing`, `finishing`, …
- **Custom tags** — created by clients via `POST /v1/tags` or inline when creating a project (`newTagLabels`).

### Groups

Tags belong to optional groups (`trade`, `phase`). Groups support future UI grouping and filtered search.

### Assignment

`project_tags` links projects to tags with `source`:

- `client` — selected in the create form
- `ai` — suggested from title/description via keyword rules (MVP stub until LLM intake)

Client selections take precedence; AI only adds tags the client did not pick.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/tags` | Tag catalog |
| POST | `/v1/tags` | Create custom tag |
| POST | `/v1/projects` | Create project with `tagSlugs`, optional `newTagLabels` |

## Future

- Tag groups for search filters
- LLM-based tag and brief enrichment
- Contractor matching by tag overlap
