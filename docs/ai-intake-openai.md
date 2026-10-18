# AI intake (OpenAI)

Initial OpenAI integration for project scope intake: improved description, AI tags, and a one-question-at-a-time follow-up wizard.

## Flow

```mermaid
sequenceDiagram
  participant User
  participant Web
  participant API
  participant OpenAI

  User->>Web: Create project (title + description)
  Web->>API: POST /v1/projects
  API->>OpenAI: initial intake
  OpenAI-->>API: improvedDescription, tagSlugs, firstQuestion
  API-->>Web: project with intake state

  loop One question at a time
    User->>Web: answer question
    Web->>API: POST .../intake/answer
    API->>OpenAI: next question (context + answers)
    OpenAI-->>API: nextQuestion or done
  end

  User->>Web: Submit for processing
  Web->>API: POST .../intake/submit
  API->>OpenAI: finalize
  API-->>Web: final description + tags
```

## Why one question at a time?

Answers can change what should be asked next (e.g. renovation scope → ask about area; new build → ask about land). A single static form cannot adapt. One question per step also keeps the UX focused.

## Configuration

| Variable | Required | Default |
|----------|----------|---------|
| `OPENAI_API_KEY` | no* | — |
| `OPENAI_MODEL` | no | `gpt-4o-mini` |

\* Without API key, a **rule-based fallback** runs (keyword tags + fixed question queue).

Set in `infra/.env` on EC2:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Restart API after change.

## Question types

| Type | UI | Example |
|------|-----|---------|
| `single` | Radio | Property size band |
| `multi` | Checkbox | Trades involved |
| `text` | Textarea | Material notes |
| `info` | Continue button | Upload floor plans |

State is stored in `brief_json.ai.intake`.

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/projects` | Create + run initial AI intake |
| POST | `/v1/projects/:id/intake/answer` | Submit answer, get next question |
| POST | `/v1/projects/:id/intake/submit` | Finalize description and tags |

## UI

- **Create project:** no tag picker — tags assigned by AI on detail page
- **Project detail:** intake wizard until completed; tags shown in wizard then on page

## Scope gating of the wet-point question

The sanitary / wet-point count is the question clients most often see on projects
that have nothing to do with wet areas, so it is gated in three places that used
to disagree:

| Where | What is gated |
|-------|---------------|
| Intake prompt (`OpenAiIntakeService.buildingSystemsIntakeRules`) | Asked **only** when the scope names a bathroom, kitchen, sanitary ware or plumbing, or a whole dwelling is built/renovated. Never for a repair or replacement of a single element or fixture, a carport/shed/workshop, or an outdoor amenity |
| Intake queue | `shouldAskSanitaryPointsQuestions` → `wetPointsInScope` decides for the fallback queue and for model-authored questions (`SCOPE_RELEVANCE_RULES`), including paraphrases like "how many bathrooms and sinks?" |
| Estimate improvement questions | `normalizeResult` drops wet-point questions from the model unless `wetPointsInScope` says the scope needs them |

`wetPointsInScope(narrative, projectType)` (`intake-scope-heuristics.ts`) takes
plain text so the intake and the estimate apply the same rule:

- whole building ("whole house", "all rooms") → **yes**;
- bathroom/kitchen being renovated or built ("new kitchen", "bathroom
  renovation") → **yes**;
- new dwelling, even when only bedrooms and plot size are described → **yes**;
- extension or fit-out → only when a wet room or fixture is actually named;
- one element or one fixture (roof, windows, paint, tiles, one toilet, one tap)
  → **no**, however the sentence mentions a room;
- outdoor amenity / landscaping → **no**.

The intake decision uses the client's own words (title, description, uploaded
plan text), not `improvedDescription` or prior answers, so an AI rewrite that
invents a bathroom cannot pull the question in. If the client already stated a
count ("2 bathrooms"), the question is skipped.

## Scope gating of the area question

"What is the approximate area involved?" was the **first** entry in the fallback
queue and was asked unconditionally (only skipped when an uploaded document
already stated an area), which is why an air-conditioner repair got it as its
second question. It is now gated by `shouldAskApproxAreaQuestion`:

| Scope | Area question |
|-------|---------------|
| Area already in the description or plan ("35 sqm", "20 x 40 m") | no |
| Building works: `new_build`, `extension`, `commercial_fitout` (not amenity-only) | yes |
| Pool in scope (pool size is what the pool questions and the estimate need) | yes |
| Area-priced trades: roofing, tiling, flooring, painting, plastering, ceilings, insulation, paving/paths/driveways, landscaping, demolition | yes |
| Repair or service of equipment or a fixture: air conditioner, pump, water heater, toilet, tap, socket, door lock, one door | **no** — the unit count matters, not square metres |
| Anything else of type `repair` | no |
| Anything else of another type (e.g. a bathroom renovation without a stated size) | yes |

The queue (`fallbackQuestionQueue`) and the model (`SCOPE_RELEVANCE_RULES`, prompt
rule in `buildingSystemsIntakeRules`) both use the predicate, so a paraphrase such
as "what is the approximate area of the property in sqm?" is dropped too. The
prompt tells the model to ask for the element's width/depth/length instead when
the size of a specific element matters.

### Device scope also silences the utility and electrical questions

A job about one piece of equipment or fixture — an air-conditioner repair, a
replaced pump, a new toilet — does not decide how the building is supplied or how
deep its electrical package goes, yet the fallback queue asked
`utility-connections` and `electrical-scope` for it, because both gates keyed on
the project type (`repair`) and on "single element" (roof/windows/paint), not on
"device".

`isSingleDeviceScope` (`intake-scope-heuristics.ts`) matches equipment (air
conditioner, pump, compressor, motor, water heater, boiler, fan) and hard fixtures
(toilet, tap, socket, breaker, light fixture, door lock) — deliberately **not**
shower/sink/basin/vanity, which appear in a bathroom renovation where those
questions are needed. When it matches, and the project is not building-scale
(`new_build`/`extension`/`commercial_fitout`), not area-priced work (tiling,
painting, flooring…) and not a pool, both gates return `false`. An installation
of one unit counts too: it plugs into what exists.

Before → after on the same predicates:

| Scope | utility-connections | electrical-scope |
|-------|---------------------|------------------|
| AC repair | yes → no | yes → no |
| Leaking toilet | yes → no | yes → no |
| Kitchen tap replacement | yes → no | yes → no |
| New house | yes → yes | yes → yes |
| Bathroom renovation (with shower/vanity) | yes → yes | yes → yes |
| Repainting the house | yes → yes | yes → yes |

The fallback queue for an air-conditioner repair is now `timeline`,
`materials-notes` — the two questions that actually move the estimate.



