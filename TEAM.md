# Team

Org chart for the agent team that builds web apps from a single rough idea. Each
specialist is a single file in `.opencode/agents/`, consumes one part of Specter's
spec, and produces one clear deliverable. **Atlas** is the entry point — a primary
agent you talk to directly — and orchestrates the rest. You can still invoke any
specialist directly with `@agent-name` if you want to run a single step by hand.

**Default stack assumed by Coder, Security, DevOps, Data, and Integration Scout:**
Next.js (JavaScript, not TypeScript) on Node.js, Supabase (Postgres + Auth + Storage)
as the backend/data layer, deployed on Vercel. Confirm with the user if a project uses
something else.

**Memory:** every agent below keeps a long-term log via the shared `memory-log` skill
(`.opencode/skills/memory-log/SKILL.md`), each pointing at its own file in
`.opencode/memory/<agent-name>.log` (gitignored — local state, not source).

| Invoke | Agent file | Role | Consumes (Specter's spec) | Produces |
|---|---|---|---|---|
| `@atlas` (`pm-orchestrator.md`) | [pm-orchestrator.md](.opencode/agents/pm-orchestrator.md) | PM / Orchestrator ("Atlas") | A rough idea, end to end | Runs the whole pipeline below and a final Project Report (blockers, what was built, open questions, next step) |
| `@spec-writer` | [spec-writer.md](.opencode/agents/spec-writer.md) | Spec Writer ("Specter") | A rough idea | The full spec (§1–§8), including the Task Breakdown by Spoke every other agent reads from |
| `@ui-ux-designer` | [ui-ux-designer.md](.opencode/agents/ui-ux-designer.md) | UI/UX Designer ("Nova") | §6 UI/UX, §3 Users & Context | Screens, flows, states, component specs, design direction — no code |
| `@coder-engineer` | [coder-engineer.md](.opencode/agents/coder-engineer.md) | Coder / Engineer ("Forge") | §6 Coding, §5 Requirements (+ Nova's screens/states when available) | Implementation: components, API routes, data access, logic |
| `@security-cyber` | [security-cyber.md](.opencode/agents/security-cyber.md) | Security / Cyber ("Warden") | §6 Security/Cyber, but reviews the whole spec/build | Threat review: findings, auth model summary, data-handling notes |
| `@qa-reviewer` | [qa-reviewer.md](.opencode/agents/qa-reviewer.md) | QA / Reviewer ("Sentinel") | §7 Acceptance Criteria | Test plan + pass/fail review of the build, with gaps called out |
| `@devops-cloud` | [devops-cloud.md](.opencode/agents/devops-cloud.md) | DevOps & Cloud Architect ("Anchor") | §5 Requirements, deploy-relevant notes in §6 | Environments, CI/CD, infra changes, rollout/rollback plan |
| `@data-analytics` | [data-analytics.md](.opencode/agents/data-analytics.md) | Data & Analytics Specialist ("Ledger") | Data-related parts of §5/§6, success criteria in §2 | Schema, relationships, key queries, events/metrics |
| `@integration-scout` | [integration-scout.md](.opencode/agents/integration-scout.md) | Integration & Automation Scout ("Relay") | Integration needs in §5/§6 | Recommended 3rd-party service(s), integration points, secrets needed, risks |
| `@tech-writer` | [tech-writer.md](.opencode/agents/tech-writer.md) | Technical Writer ("Quill") | Whole spec + the actual finished build | README, API docs, user guides, changelog entries |

## How Atlas runs the pipeline

Talk to Atlas directly with your rough idea. It invokes the specialists below in
order, skipping any spoke that genuinely has no work, and only stops mid-flight for
an irreversible action (a production deploy, a destructive command) that needs your
explicit confirmation — otherwise it runs end-to-end and reports at the end.

```
@spec-writer (Specter)  →  produces the spec
     │
     ├─→ @ui-ux-designer        (§6 UI/UX)            → design spec
     ├─→ @data-analytics        (§5/§6 data)           → schema + events
     ├─→ @integration-scout     (§5/§6 integrations)   → service picks + glue
     │
     └─→ @coder-engineer  (reads spec + design + schema + integrations)  → implementation
              │
              ├─→ @security-cyber   → threat review
              ├─→ @qa-reviewer      → test plan + pass/fail
              └─→ @devops-cloud     (reads Security + QA results)  → deploy plan

@tech-writer  (reads spec + finished build, runs last)  → docs

Atlas  →  final Project Report (blockers first, then what was built, open
          questions, next step)
```

## Running a step manually

You can still invoke any specialist directly with `@agent-name` instead of going
through Atlas — useful for re-running one step, or if you just need one deliverable
in isolation. Hand it the spec (and any upstream agent's output it depends on)
yourself in that case; there's no shared state between agents except what's in their
own memory log and what you paste in.
