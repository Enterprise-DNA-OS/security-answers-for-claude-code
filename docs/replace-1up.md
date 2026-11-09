# Replace the security review desk in 1up

## Export while you still have access

Open the completed questionnaire in 1up, review its answer placement in Document Editor, then export. Its [official guide](https://help.1up.ai/en/articles/12997286-exporting-answers), checked 9 November 2026, documents Excel and CSV exports, the completed questionnaire and a references folder. Existing answers may remain in their original columns, while new answers can appear at the right. Check the actual selected answer column. Browser-based questionnaires cannot be exported through this route.

Keep the original export and references folder in a private location. For Excel, save the relevant sheet as UTF-8 CSV after checking formulas and answer placement. This importer reads CSV, not Excel, Word, PDF or portal content. It does not copy files from the references folder or reconstruct review history.

## Prepare the destination

Create an account and questionnaire with /add, including an owner and real due date. Inspect the CSV headers. A map is a JSON object whose keys are question, answer_text and optionally code, and whose values are exact source headers. There is no universal 1up export layout because the export follows the customer's document.

```json
{"code":"Reference","question":"Security question","answer_text":"Selected answer"}
```

The fixture uses these demonstration headings only. They are not a claim about vendor default headers. Without a map, the importer expects Question and Answer. Without a source code it derives a stable identifier from the questionnaire and question text. Duplicate questions need distinct source codes.

## Preview and import in one command

```bash
npm run answers -- import 1up --file=fixtures/1up-completed.csv --map=fixtures/1up-map.json --questionnaire=SQ-KAURI --owner="Mara Chen" --actor="Mara Chen" --dry-run
```

Remove --dry-run to save. The entire file rolls back on malformed CSV, missing columns, blank questions, duplicate codes or conflicting existing records. Repeating the same file leaves matching records unchanged. Original rows, file names, column maps and unmapped cells are retained in activity. A changed row requires an explicit reviewed update instead of a silent overwrite.

## Reconcile before ending the subscription

Compare the question count and selected answer text with the original completed file. Imported responses are drafts, without approval or evidence links. Add the reviewed evidence references and approved library answers. Link them using /use-answer, then record a human review with /approve-response. Run /compliance and /handover-ready. Compare one response pack with the original and back up the database before switching.

What does not carry over: attachments, original workbook formatting, dropdown selections as controls, comments, permissions, portal questionnaires, integrations, automated answer generation, source document contents or vendor approval history. Preserve these in a separate archive or scope a migration with Enterprise DNA. One command loads a mapped CSV, it does not promise a complete platform migration in one click.

/export writes all records and activity to JSON, or one record type to CSV. The backup is an archive; test a restore procedure with your chosen database before relying on it. Never commit real exports or evidence to git.
