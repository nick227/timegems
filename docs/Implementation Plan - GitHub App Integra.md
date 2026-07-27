Implementation Plan - GitHub App Integration Foundation
Implement the foundation for GitHub integration in TimeGems using a GitHub App. This enables:

GitHub App installation for personal/organization accounts (authentic once per installation).
Repository browsing of authorized repositories.
Repository binding to one or more TimeGems projects.
Webhook processing (signature verification, deduplication, payload persistence).
Activity normalization of push, pull request, review, issue, comment, workflow run, and release events into durable ProjectEvent records.
User Review Required
IMPORTANT

Webhook Security & Bypassing Bearer Auth The /webhooks/github endpoint will be registered with security: [] in openapi.yaml to allow GitHub to post webhooks without session cookies. Request integrity is verified using the SHA256 signature of the raw request payload signed with the GITHUB_WEBHOOK_SECRET.

WARNING

Database Changes We are updating GithubBinding (unused in V1) to make linkedProjectId required and include an immutable repoId (string). We are adding two tables: GithubInstallation (to track App installations) and ProjectEvent (to store normalized activity). We are also adding GithubWebhookDelivery to persist and deduplicate raw webhook payloads.

Open Questions
Do we have a specific GitHub App name or URL in mind for the redirect? By default, we will look up process.env.GITHUB_APP_NAME to generate the installation setup redirect URL.
Are there specific events we should support for webhook normalization? The plan covers the requested list: push, pull_request, pull_request_review (review), issues (issue), issue_comment (comment), workflow_run (workflow), and release.
Proposed Changes
Database & Prisma
[MODIFY] 
schema.prisma
Update GithubBinding model:
Add repoId String (immutable GitHub repository ID).
Add repoFullName String (e.g. "owner/repo").
Make linkedProjectId String required (a binding must map to a project).
Add installationId String referencing GithubInstallation.
Add @@unique([tenantId, linkedProjectId, repoId]) to enforce project-level uniqueness for repo binding.
Add GithubInstallation model:
Track installationId (unique), tenantId, accountName, accountAvatarUrl.
Add GithubWebhookDelivery model:
Deduplicate by githubDeliveryId (unique string; raw `X-GitHub-Delivery`).
Store raw webhook payload (Json), event type, processed state, and potential error.
Add ProjectEvent model:
Fields: id, tenantId, projectId, source, kind, externalId, payload (Json), occurredAt (DateTime).
`externalId` is not a bare commit SHA; canonical GitHub idempotency uses `github:{deliveryId}:{event}:{entityId}:{action}`.
Unique constraint `@@unique([projectId, source, externalId])` to guarantee event-level idempotency per project.
API Contracts
[MODIFY] 
openapi.yaml
Add schemas for:

GithubInstallation, GithubBinding, ProjectEvent.
Request inputs: RegisterGithubInstallationInput, BindGithubRepoInput. Add paths for:
GET /integrations/github/installations: List installations.
POST /integrations/github/installations: Register installation.
DELETE /integrations/github/installations/{installationId}: Disconnect installation.
GET /integrations/github/installations/{installationId}/repositories: Fetch authorized repos.
GET /projects/{projectId}/github/bindings: List project bindings.
POST /projects/{projectId}/github/bindings: Bind a repo.
DELETE /projects/{projectId}/github/bindings/{bindingId}: Remove binding.
POST /webhooks/github: Signature-verified webhook receiver (security: []).
Server Services & Handlers
[NEW] 
GithubService.ts
Implement server service layer:

registerInstallation(tenantId, installationId): Register or reuse. Calls GitHub API to fetch org name/avatar.
disconnectInstallation(tenantId, installationId): Clears installation and deletes all related project bindings.
listInstallations(tenantId): Lists registered installations for a tenant.
listRepositories(tenantId, installationId): Fetches repos accessible to the installation.
bindRepository(tenantId, projectId, body): Enforces tenant/project access, verifies the installation belongs to the tenant, and creates GithubBinding.
unbindRepository(tenantId, projectId, bindingId): Removes binding.
handleWebhook(githubDeliveryId, event, signatureHeader, rawBody):
Verifies signature using GITHUB_WEBHOOK_SECRET.
Saves/deduplicates raw payload in GithubWebhookDelivery (returns 200 immediately if already processed).
Parses event. Resolves installationId and repository information.
Matches repository (repoId) against active GithubBinding records to find target projects.
Normalizes payloads into provider-neutral ProjectEvent records and hands them to `ProjectEventService.record(...)`, which owns event persistence, unified-feed broadcasting, and ProjectUpdateJob scheduling.
[NEW] 
github.ts
Expose endpoints mapped from openapi.yaml:

listGithubInstallations, registerGithubInstallation, disconnectGithubInstallation, listGithubInstallationRepositories
listProjectGithubBindings, bindProjectGithubRepository, unbindProjectGithubRepository
handleGithubWebhook
[MODIFY] 
index.ts
Export all handlers from ./github.
[MODIFY] 
index.ts
Replace JSON parser with custom parser that retains req.rawBody for webhook signature verification.
Client SDK Hooks
[NEW] 
useGithub.ts
Expose React Query hooks for:

useGithubInstallations(), useRegisterGithubInstallation(), useDisconnectGithubInstallation(), useGithubInstallationRepositories(installationId)
useProjectGithubBindings(projectId), useBindProjectGithubRepository(projectId), useUnbindProjectGithubRepository(projectId)
[MODIFY] 
index.ts
Export the new GitHub hooks.
Frontend UI
[MODIFY] 
IntegrationsRoute.tsx
Replaces static GitHub display with a functional interface showing connected installations.
Connect button redirects to GitHub App installation URL.
Setup a callback hook/effect to capture installation_id from URL query parameter, register it, and clear URL parameters.
[NEW] 
GithubRepositoryBindings.tsx
Mounts inside ProjectRoute (project details).
Lists bound repositories for the project.
Exposes a borderless selection interface to bind available repositories from any connected installation.
Allows unbinding repositories with a confirmation step.
[MODIFY] 
ProjectRoute.tsx
Mounts the GithubRepositoryBindings component in the project settings tab/section.
Verification Plan
Automated Tests
Create apps/server/src/__tests__/github.test.ts to test:
Signature Verification: Valid signature succeeds; invalid signature throws 400/401.
Webhook Deduplication & Idempotency: Repeated posts of same X-GitHub-Delivery do not create duplicate deliveries or project events.
Repository Binding & Authorization: Correct binding creation, and 404/403 errors when trying to bind to unauthorized projects/tenants.
Installation Reuse: Verify registering an installation twice updates details/re-uses the existing record without crashing.
Cross-Tenant Isolation: Webhooks only normalize events into projects belonging to the tenant that owns the installation.
Manual Verification
Run local dev server using pnpm dev.
Connect to local database, view installations UI, trigger simulated installation callback.
Browse mock repository lists, bind repositories to projects, and unbind them.
Send mock webhook requests to POST /webhooks/github and verify ProjectEvent rows in database.