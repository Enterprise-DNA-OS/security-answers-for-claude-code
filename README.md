# Security Answers for Claude Code

Keep customer security questionnaires, reviewed answers and their evidence in a database you own.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free, MIT. Install and try the demo. | Your review rules, answer categories, exports and documents. | Installed and operated through Omni by Enterprise DNA. A setup fee, then a retainer. |

[Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=1up) · [Instead of 1up](https://enterprisedna.co/omni/instead-of/1up?utm_source=github&utm_medium=readme&utm_campaign=1up)

## What it does

Run a security questionnaire desk from current records. Bring in customer questions and historical answers, attach evidence references, review the wording, approve the exact answer and prepare a response pack. Changes and expiry block handover until the records are current again. Humans decide what is true and what can be shared.

Claude Code, Codex, OpenCode or Cursor follows the same command recipes. There is no model API, subscription charge, browser automation, document ingestion engine or public trust centre in the free base. Exact question matching suggests a current approved answer. Your coding agent can research a different question against the records and draft an answer for review. It must never invent a security control. Enterprise DNA builds your own connections and interfaces when scoping your version.

1up is a broader answer automation platform. This build replaces the internal security review desk, not every feature in 1up. [Research and selection](docs/research.md).

## Quick start

Node 20 or later. No cloud account is required for the local demo.

```bash
git clone https://github.com/Enterprise-DNA-OS/security-answers-for-claude-code.git
cd security-answers-for-claude-code
npm install
npm run demo
npm run answers -- weekly-review
npm run view
npm run docs
```

PGlite stores data in .data/db. DATA_DIR changes that location. DATABASE_URL selects PostgreSQL. Run npm run migrate before opening an empty database. Never seed production records. The seed is fictional and idempotent, with dates relative to today. It includes an overdue questionnaire, stale evidence, an unreviewed procedure, an unanswered question, one ready pack and one empty questionnaire.

## Your weekly rituals

Monday: /weekly-review combines intake, attention and answer freshness. Before responding: /unanswered, /suggest and /response-review. As evidence arrives: /evidence-review, /update and /approve-answer. Before a handover: /handover-ready, /compliance and /handover. Friday: /reused-answers and /owner-load identify work to finish before the next review.

## Ten questions answered today

These are verified questions in this build, not a claim that 1up cannot answer them.

1. Which overdue questionnaires still contain unreviewed responses? /intake-review
2. Which approved answers stopped being current after their evidence changed? /answer-refresh
3. Which evidence expires before the next customer review? /evidence-review
4. Which response is waiting for a named reviewer? /response-review
5. Which questionnaires have no questions loaded? /handover-ready
6. Who owns the most blocked responses this week? /owner-load
7. Which stale answers are reused across open questionnaires? /reused-answers
8. Which customer questions have no linked answer? /unanswered
9. Which personal records are past their retention review date? /privacy-review
10. Who changed an answer and what did it say before? /activity

## Record changes and review

28 CLI commands and 32 slash command recipes. Every CLI command accepts --json. The five record types and their allowed fields are in entities.json. Use exact codes, case-insensitive names or partial UUIDs. Ambiguous references list the matches and stop.

```bash
npm run answers -- list --kind=answers --json
npm run answers -- show --kind=answers --ref=AN-ACCESS
npm run answers -- log --kind=answers --ref=AN-ACCESS --actor="Reviewer name" --note="Reviewed the quarterly procedure"
npm run answers -- suggest --ref=RS-R1
npm run answers -- use-answer --ref=RS-R1 --answer=AN-ACCESS --actor="Reviewer name"
```

/add and /update take the fields in entities.json as flags, replacing underscores with hyphens. Dates are YYYY-MM-DD. /approve-answer and /approve-response require --ref, --actor and --on for the real review date. Approval names are recorded statements, not authenticated identities. An operator needs authority to record that decision. Changing an answer clears its approval and invalidates existing responses. Changing evidence makes its dependent answers stale. Approval requires current evidence, and /handover checks the whole questionnaire again inside a transaction.

/handover writes an internal draft only. It never sends, publishes or attaches the underlying evidence. /draft-response-pack and /draft-review-request also show blocked records so the reviewer can fix them. Internal notes and restricted evidence references can appear in drafts. Review the recipient and sharing permission before distributing any file.

## Bring your 1up history

1up exports spreadsheet responses in the original customer layout. There is no universal set of headers. The provided fixture is synthetic and demonstrates an explicit column map.

```bash
npm run answers -- import 1up --file=fixtures/1up-completed.csv --map=fixtures/1up-map.json --questionnaire=SQ-KAURI --owner="Mara Chen" --actor="Mara Chen" --dry-run
npm run answers -- import 1up --file=fixtures/1up-completed.csv --map=fixtures/1up-map.json --questionnaire=SQ-KAURI --owner="Mara Chen" --actor="Mara Chen"
npm run answers -- export --dir=exports
npm run answers -- export --kind=responses --dir=exports
```

One command imports a mapped completed CSV into an existing questionnaire. Default headers Question and Answer work without a map. Imports are transactional, repeatable and preserve the original row and unmapped columns in activity. Historical responses start as drafts with no approval or evidence links. Conflicting repeats stop without partial writes. The full JSON export includes every record and the activity history. CSV exports include all fields and portable reference codes. The JSON backup is an archive, not an automated restore command. [Export steps, mapping and reconciliation](docs/replace-1up.md).

## Documents and read-only views

Change brand.json for your business name, colours and logo. npm run docs renders response packs, evidence reference registers and review requests. npm run view renders the week, answer currency and owner workload. These are static HTML snapshots. /new-view adds a report in plain language. [Why no front end](docs/why-no-front-end.md).

## Record checks

Six checks flag late questionnaires, stale answers, missing evidence reviews, unreviewed responses, empty questionnaires and personal-record retention reviews. [Rules and sources](docs/compliance.md). This is evidence administration, not certification or legal advice. No source document is read or verified automatically. Review intervals are your policy, not invented statutory deadlines.

Rows have access controls enabled without public access policies. Shared operation needs scoped database roles, encrypted connections, backups and an authenticated review workflow. Database administrators can alter history. Keep private exports, source documents and credentials out of git. The importer does not fetch documents or accept instructions from imported text.

## Your first hour: ten things to ask for

1. Put our business name and logo on the response pack.
2. Preview one of our completed 1up exports.
3. Add our product names to the answer record.
4. Group the review queue by customer deadline.
5. Set our evidence expiry policy.
6. Add a second reviewer for restricted evidence.
7. Show every customer affected by an answer change.
8. Add the source document owner to the evidence register.
9. Draft a request for the missing backup test record.
10. Add our handover checklist to the pack.

/customise writes and applies a new migration, updates the commands and tests the change.

## Verification

npm test creates a disposable database, migrates, seeds twice, exercises all 28 CLI commands and raises and clears all six finding rules. It checks approval invalidation, handover blocks, dates, ambiguity, import rollback, repeated imports, source preservation, full exports, escaping and branded documents. TEST_DATABASE_URL selects a disposable PostgreSQL database in an isolated test schema. The CI workflow runs Linux, Windows and PostgreSQL checks when dispatched.

MIT. Copyright 2026 Enterprise DNA. Not affiliated with 1up or Anthropic. Hosting and coding-agent use have their own costs. [Book 30 minutes with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=1up).
