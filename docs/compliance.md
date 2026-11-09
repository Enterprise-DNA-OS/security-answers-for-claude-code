# Security questionnaire record checks

Checked 9 November 2026. The build tracks evidence, it does not certify security controls or determine legal compliance. An approved answer is the operator's recorded decision about specific wording. Evidence files remain external and are not inspected by the CLI.

| Rule | Trigger | Basis |
|---|---|---|
| QUESTIONNAIRE-DUE | Open questionnaire past its agreed date | Internal customer service policy |
| ANSWER-CURRENT | Answer unapproved, review overdue, evidence missing, expired or changed | Internal answer governance. NZ IPP8 applies when the answer contains personal information |
| EVIDENCE-REVIEW | Evidence lacks a review date or has expired | Internal document review policy |
| RESPONSE-REVIEW | Open response lacks approval or differs from current approved wording or evidence | Internal handover policy |
| EMPTY-QUESTIONNAIRE | Open questionnaire contains no questions | Internal completeness policy |
| PRIVACY-RETENTION | Personal records lack a retention review date or are past it | NZ IPP9 plus an internal review schedule |

[New Zealand Privacy Act, Principle 8](https://www.privacy.org.nz/privacy-principles/8/) requires reasonable accuracy checks before using or disclosing personal information. It does not prescribe the review intervals used here. A current date alone cannot establish accuracy.

[Principle 9](https://www.privacy.org.nz/privacy-principles/9/) concerns keeping personal information only while needed for a lawful purpose. This build flags a human review, never automatic deletion. Set the date from the business's actual retention purpose and obligations. It is not a statutory retention period.

[Principle 5](https://www.privacy.org.nz/privacy-principles/5/) concerns reasonable safeguards. Public database access is revoked and generated files use restrictive permissions where supported. Shared access controls, encryption, backup testing and document permissions require installation work. These measures are not a passing compliance certificate.

## Approval gates

An answer needs reviewed evidence with an unexpired date and a current answer review date. The approved evidence revision is saved. Editing wording or review scope resets approval. Editing evidence changes its revision and makes existing approvals stale. A response must match the exact current answer and save its revision. Handover rechecks all rows in a transaction and rejects an empty questionnaire. There is no outward send operation.

Approver names are supplied by an operator. The database checks record completeness and currency, not human identity, independence, evidence truth, recipient consent or real security controls. Internal and restricted references remain visible in drafts. Review before sharing.
