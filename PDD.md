# Product Definition Document (PDD)

## Product Name
Construction Marketplace Platform

## Document Version
v1.0 (Initial draft)

## Product Overview
Construction Marketplace Platform is a web and mobile-accessible product for private homeowners, professional developers, and companies involved in residential and commercial construction or renovation.

The platform streamlines the full project lifecycle, from idea formulation and project preparation to contractor tendering, contract generation, and progress monitoring. It is designed to make construction services more transparent, accessible, and efficient for both professional and non-professional users.

## Problem Statement
Construction and renovation projects are often fragmented across multiple channels and tools. Clients frequently face:
- unclear project scoping,
- slow and unreliable contractor discovery,
- inconsistent pricing and limited transparency,
- poor communication and progress tracking,
- high administrative overhead for contracts and coordination.

In many Southeast Asian markets, sourcing still relies on social platforms and word-of-mouth, while many existing professional tools are too complex for typical homeowners.

## Product Vision
Create a unified construction ecosystem that combines professional-grade workflows with consumer-level usability, enabling clients to confidently plan, source, execute, and monitor projects within one platform.

## Target Users
- Private homeowners (non-professional users)
- Professional developers
- Construction and renovation companies
- Contractors and subcontractors
- Designers and licensed design companies
- Suppliers and materials vendors
- Professional support providers (legal, PM, QS)

## Core Value Proposition
- Simplifies project preparation and requirement collection
- Accelerates contractor and supplier sourcing
- Provides rapid preliminary cost estimates
- Improves transparency in pricing and offer comparison
- Enables access to verified professionals
- Supports both small repairs and complex construction projects
- Centralizes communication, updates, and reporting

## Product Scope

### In Scope (MVP+)
1. AI-powered project preparation assistant (text and audio input)
2. Guided requirement collection and project package assembly
3. Automated preliminary cost estimation
4. Automated contractor tender distribution and bid collection
5. Tender clarification Q&A workflow
6. Structured bid comparison
7. Automated draft contract generation
8. Integrated messaging/progress reporting workflow
9. Ratings and reviews for service providers
10. Customer support for platform usage
11. Localization with English primary language and auto-translation

### Future/Optional Scope
1. Integrated construction materials marketplace
2. Free AI-powered DIY educational guides
3. Direct hiring of legal, PM, and QS specialists

## Key Features and Functional Requirements

### 1) AI-Powered Project Preparation
The system shall:
- Accept text and voice user requests.
- Guide users to provide missing project details.
- Support project-related attachments, including photos, blueprints, sketches, survey reports, and specifications.
- Convert unstructured input into a structured technical task package suitable for estimation and tendering.

### 2) Preliminary Cost Estimation
The system shall:
- Generate preliminary estimates automatically based on:
  - calculated work volumes,
  - local market unit pricing,
  - open market metadata.
- Clearly mark estimates as preliminary and subject to project clarifications.
- Recommend a licensed design tender path for technically complex projects.

### 3) Automated Tender Process
The system shall:
- Automatically distribute tender requests to pre-screened registered contractors once minimum project data is available.
- Allow contractors to ask clarification questions through the platform.
- Aggregate and highlight frequent questions to help clients improve project information quality.
- Enable client-controlled tender start when enough participants join.
- Collect and present offers including:
  - price proposals,
  - estimated duration,
  - contractor-specific conditions.
- Provide structured side-by-side offer comparison for decision support.

### 4) Automated Contract Generation
The system shall:
- Generate a draft contract after contractor selection.
- Use legal information from both parties, project details, archived templates, local standards, and market metadata.
- Reduce administrative effort and speed up project kickoff.

### 5) Project Monitoring and Reporting
The system shall:
- Allow contractors, designers, suppliers, and PM/QS specialists to submit progress updates.
- Provide a centralized activity timeline and communication log.
- Improve transparency and traceability for clients.

### 6) Ratings and Reviews
The system shall:
- Support ratings and reviews for contractors, designers, and suppliers.
- Expose relevant historical performance indicators to improve selection quality.

### 7) Customer Support
The system shall:
- Provide free on-call support for:
  - platform navigation,
  - account and usage issues,
  - application functionality questions.
- Explicitly exclude technical consultation on project engineering/construction decisions.

## User Journeys

### Journey A: Homeowner Project Launch
1. User submits an idea via text or voice.
2. AI assistant requests additional details and files.
3. System builds technical task package.
4. Preliminary estimate is generated.
5. Tender invitations are sent to verified contractors.
6. User reviews offers and selects contractor.
7. Draft contract is generated.
8. User tracks progress and communication in-platform.
9. User leaves rating/review after completion.

### Journey B: Contractor Participation
1. Contractor receives tender invitation.
2. Contractor reviews project package and asks clarifying questions.
3. Contractor submits price, timeline, and conditions.
4. If selected, contractor proceeds with contract and periodic reporting.
5. Contractor receives review upon project completion.

## Business Model
Revenue streams:
- **Client-paid platform fees** on closed deals:
  - **Platform access fee:** USD 100 (local equivalent at an indicative FX rate), unlocks contract signing and is **credited toward** the success fee
  - **Success fee:** 2% of the awarded contract amount minus the access-fee credit, due within one calendar month after signing (typically after the client’s advance to the contractor)
- During trial / soft-launch: fees are **shown in full** with a temporary **100% discount** (amount due = 0) until billing via a legal entity is enabled
- Advertising placements within the platform ecosystem
- Optional premium memberships for clients

## Localization and Internationalization
- Primary language: English
- Automatic translation to local languages (including Thai)
- Architecture should support scalable localization for additional markets

## Competitive Positioning
- Direct benchmark competitor: Angi (USA/Canada), with AI introduced in May 2026 and currently focused on simpler user flows.
- Market gap in many regions: informal sourcing via social media and personal referrals.
- Existing B2B construction tools are often optimized for professionals and may be too complex for homeowners.
- Strategic differentiation: combine professional workflow depth with accessibility for non-professional users.

## Non-Functional Requirements
- Cross-platform accessibility for desktop and mobile devices
- Secure handling of user data, legal documents, and project artifacts
- Scalable architecture to support multi-region pricing and localization
- High availability for tendering and communication workflows
- Auditability for project updates, bids, and contract drafts

## Risks and Mitigations
- Data quality risk in early project descriptions  
  Mitigation: AI-guided intake with iterative clarification prompts.
- Estimate accuracy risk due to market volatility  
  Mitigation: dynamic local pricing sources and transparent estimate disclaimers.
- Low tender participation in early market stages  
  Mitigation: pre-screened contractor onboarding and improved project clarity scoring.
- Legal/regulatory variance by region  
  Mitigation: template versioning and country-specific legal metadata.

## Success Metrics (Initial)
- Time from project idea submission to tender-ready package
- Number of valid bids per tender
- Tender-to-contract conversion rate
- Average time to contractor selection
- User satisfaction score (clients and contractors)
- Repeat usage rate
- Support resolution satisfaction

## Assumptions
- Sufficient supply-side onboarding (contractors, designers, suppliers) is achievable per launch market.
- Local market pricing metadata can be sourced and maintained.
- Users accept AI-assisted workflows for initial planning and estimation.

## Open Questions
- What are the exact minimum required fields for automatic tender launch?
- Which legal jurisdictions will be supported in Phase 1 contract templates?
- What verification criteria define a "pre-screened" contractor?
- What exact premium membership features will be offered at launch?

## Release Approach (High Level)
1. Phase 1: AI intake, estimation, tender basics, bid comparison
2. Phase 2: Contract automation, monitoring/reporting, ratings
3. Phase 3: Marketplace, DIY education, professional support expansion

## Technical Documentation
Implementation and deployment details are maintained in the `docs/` directory:
- [docs/README.md](./docs/README.md) — documentation index
- [Backend Architecture — MVP](./docs/backend-architecture-mvp.md)
- [Deployment — MVP](./docs/deployment-mvp.md)
- [Deployment — EC2 + Keycloak](./docs/deployment-ec2-keycloak.md)
- [Auth — Keycloak](./docs/auth-keycloak.md)
- [Domain State Machines](./docs/domain-state-machines.md)

