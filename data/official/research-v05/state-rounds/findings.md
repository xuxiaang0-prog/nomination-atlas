# Recent state invitation releases: WA, ACT, SA, TAS

Checked on 9 October 2026, Australia/Sydney. This is a bounded official-source recheck, not proof that unpublished data does not exist.

## Result

No newer invitation release was verified for any of these four states relative to the existing manifest. `latest-round-status.json` contains `newRecords: []`. Do not import the reverified arrays as additional invitations.

| State | Latest verified invitation data | Granularity | Points and counts |
|---|---|---|---|
| WA | May 2026, existing occupation PDF | Six-digit occupation / stream / residence | Last-invited EOI points; occupational counts not published |
| ACT | 11 June 2026 | Four-digit ANZSCO unit group / residence / visa | Canberra Matrix scores; invitation counts only by pathway / residence / visa |
| SA | 21 May 2026 | 17 two-digit ANZSCO sub-major groups | Group counts, 190 161 / 491 77; no invited EOI points |
| TAS | 8 October 2026 | All occupations / visa / priority pass | 190 37 / priority score 323; 491 24 / priority score 89 |

## Evidence and recheck details

### WA

- Live program: https://migration.wa.gov.au/our-services-support/state-nominated-migration-program
- Linked occupational PDF: https://migration.wa.gov.au/sites/default/files/2026-05/Last%20invited%20expression%20of%20interest%20-%20Priority%20trade%20occupations%20-%20May%202026.pdf
- Both original downloads have exactly the same SHA-256 as the existing manifest snapshots. No newer occupational PDF is linked on the current program page.
- Existing May PDF has 18 occupation/cohort records covering 13 occupations. The total existing WA occupation coverage across historical PDFs remains 181 occupations; that is not 181 occupations all invited in May 2026.
- The latest program summary's stream counts (167 + 5 + 37 = 209) differ from the monthly-history column (167 + 5 + 34 = 206). Preserve this conflict. Do not infer which is correct or distribute stream counts among occupations.
- Browser-search fetch of WA page/PDF failed, but direct HTTP retrieval succeeded and original bytes are saved.

### ACT

- Live round: https://www.act.gov.au/migration/resources/canberra-matrix-invitation-round
- Rankings index: https://www.act.gov.au/migration/resources/library-guidelines-and-invitations
- Rankings original PDF: https://www.act.gov.au/__data/assets/pdf_file/0009/2920554/2025-26-Invitation-round-rankings.pdf
- Latest completed round remains 11 June 2026. The week starting 12 October 2026 is a tentative *future* 190-only round as of the check date.
- Original 23-page PDF is downloaded successfully: 776,507 bytes, SHA-256 `de40dae177198fcf81339eafc4808a24a9bce4d4d92fc76815af09ac50df5b9d`.
- Independent original-PDF check of the June table: 105 groups × 4 residence/visa columns = 420 cells, 83 published scores and 337 N/A cells. All points and statuses match the existing manifest: zero discrepancies.
- N/A means Matrix submissions were not considered, not a zero point score or a disclosed occupation invitation count.
- June pathway totals sum to 190 77 and 491 5. These do not provide invitation counts for any specific unit group.
- `act-june-reverified-cells.json` is a verification artifact, not new records.
- The original PDF can strengthen source preservation by being stored as a separate verification source. Keep the old text source hash true to its text bytes; do not replace its hash with the PDF hash while leaving its local path unchanged.

### SA

- Category index: https://migration.sa.gov.au/news?category=invitations-issued
- Latest article: https://migration.sa.gov.au/news/invitations-issued-late-may-2026
- Both current original HTML snapshots match the existing hashes.
- Independent re-extraction matched all 17 groups, 34 visa cells: 190 161 + 491 77 = 238 for the round.
- The same article reports fiscal-year-to-date cumulative 190 1767 + 491 1086 = 2853. Full group cumulative columns are preserved in `sa-late-may-reverified-groups.json` if a separate cumulative view is desired. Do not add cumulative numbers to the individual round numbers.
- Published exact invitation date and publication date are both 21 May 2026.
- The article says final scheduled 2025–26 round, while allowing possible further activity to optimise remaining allocation. That does not prove there were no later invitations; no later disclosed round was located in this bounded check.
- Neither points, six-digit occupation breakdowns, nor onshore/offshore pathway splits are published in this table.

### TAS

- Current processing/invitation page: https://www.migration.tas.gov.au/news/processing_times_and_allocation_usage
- Page explicitly dates invitations and its update to 8 October 2026.
- 190 37 = 13 Gold + 24 Green; 491 24 = 2 Gold + 22 further invitations. Do not sum pass subsets with the subclass total.
- Round minimum priority scores are 323 and 89. The separately described rolling three-month assessment figures are 440 and 81; those are not this round's minimum invited score.
- TAS priority score is not federal EOI points. There is no occupation count or occupation invitation-point table on this page.

## Files

- `sources.json`: metadata and hashes for eight original downloads, all designated recheck evidence rather than new invitation records.
- `latest-round-status.json`: machine-readable coverage and status, with no new records.
- `act-june-reverified-cells.json`: 420 verified cells against the manifest.
- `sa-late-may-reverified-groups.json`: original round and fiscal-year-to-date group counts, with source rows.
- Original PDFs, HTML, metadata, and text extractions are retained beside these files.

## Web references for parent verification

Parent must open URLs before using source references in its own final response. Retrieved references here: ACT current round `turn107view1`; SA invitation index `turn107view2`; TAS current statistics `turn107view3`; ACT rankings index `turn116view0`; ACT original PDF `turn117view0`; SA latest article `turn116view2`.
