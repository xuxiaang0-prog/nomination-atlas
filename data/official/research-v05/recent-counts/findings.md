# Recent Home Affairs occupational counts, checked 9 October 2026

## Import-ready dataset

`recent-activity.json` contains one dataset, 2,165 populated state/visa/occupation cells covering **372 state-nominated occupations**, and its official source metadata. All eight states/territories are covered. Across the raw source there are 373 distinct six-digit ANZSCO occupations, with 315 occupation rows for subclass 190 and 316 for subclass 491. Radiation Oncologist (253918) appears only under 491 Not specified (family-sponsored) and is excluded from the state board. Each state table shows the occupations with a populated or privacy-suppressed cell for that state; no industry preselection is imposed.

**Metric: primary visa applications lodged, FY 2025–26 (1 July 2025 through 30 June 2026).** This is not EOI invitation events, invitations to apply for state nomination, state nomination approvals, or granted visas. No points scores are present. The actual PDF title and p.30 note 3 explicitly restrict occupational data to primary applicants, even though the request-log description omits the word "primary".

Main source: [DA 26/07/00344](https://www.homeaffairs.gov.au/foi/files/data-request-2026/da-260700344-document-released.PDF), disclosed 21 August 2026, request-log entry last modified 5 October 2026.

- Original retained as `da-260700344-document-released.PDF`, 30 pages, SHA-256 `12068a59b51f2edc971cf8204a165ccd2e18c8d647a36327a242e869d3d2c3e7`.
- 1,381 cells have original `<5` values, stored as `count: null, countStatus: suppressed_below_5`.
- 784 cells have exact published values. Their sum, 17,350, is only an **incomplete subtotal**, never an exact complete total.
- 2,883 dash/blank-text state cells are excluded, not converted to zero. Original rendered PDF displays dashes where the text layer omits characters.
- The source has **no grand-total or state-total row**, so no official exact `stateTotals` are available. Summing masked cells to produce totals would require estimation and is not done.
- 25 nonblank `Not specified` cells are excluded. All are subclass 491; source note 2 says they represent the family-sponsored stream.
- Counts are per primary visa application, not an estimate of unique migrants across visas or years. Classification edition is not specified, so historical codes are retained and no cross-version relabelling is applied.

## Parse and verification

`parse_recent_counts.py` parses original text using page, six-digit occupation code, row coordinates, and state-column right edges. Wrapped occupational titles begin at the code column on continuation lines; this is handled explicitly. Every output record has a page and cell bounding-box locator. All 30 pages were processed with no duplicate same-visa occupation rows, no unassigned numeric cells and no remaining column anomalies.

The PDF text layer corrupts one numeric cell to `so`: p.6, subclass 190, code 241111 Early Childhood Teacher, Queensland. The original rendered cell is **50**, verified in `da344-p6-count50.png` and the overlapping official DA26/07/00345 p.53. This reading correction is documented and not an estimated value. The text layer also reads `nec` as `nee`; the title token is normalised while raw text is retained in `raw-occupation-rows.json`.

Crosscheck: [DA 26/07/00345](https://www.homeaffairs.gov.au/foi/files/data-request-2026/da-260700345-document-released.PDF), disclosed 18 August 2026, source SHA-256 `0d6fa1d41d4d9377124eb98efc6f1e2110561a51011fff6aaa84df39d0a2ab1f`. Its occupational table has many image-only pages. `crosscheck_da345.py` compares the eight text-readable 190 pages (p.51–58): **278 occupation rows × nine columns = 2,502 cells, zero differences** after the one reading correction. DA00345 is an overlapping crosscheck, never an additional additive dataset.

`extraction-audit.json`, `raw-occupation-rows.json`, `excluded-cells.json`, `da345-crosscheck-audit.json`, and `da345-crosscheck-cells.json` preserve the results and scope.

To reproduce:

```bash
python3 parse_recent_counts.py
python3 crosscheck_da345.py
```

Requires `pdfplumber` installed. Inputs and output paths are resolved against the script directory, so scripts remain runnable after the source bundle is moved.

## Other recent official data retained as research only

[DA 26/07/00368](https://www.homeaffairs.gov.au/foi/files/data-request-2026/da-260700368-document-released.PDF), disclosed 31 August 2026, is **visa applications granted** by occupation and sponsoring state in the same FY. Occupation note 2 on p.26 limits occupation data to primary applicants. It has subclass 189 intended-residence rows as well as 190/491 sponsoring-state rows. Its original, text and p.26 notes image are retained but it is not added to the import-ready board to avoid mixing three different metrics. SHA-256 `52c5405a3b04aa521fad52a00aab814d84dc34ae1ac7641e2ad750b738187579`.

## Bounded invitation-file search

Direct downloads of the current public Home Affairs lists found 192 Data Request 2026 entries, 215 Data Request 2025 entries, 169 FOI Disclosure 2026 entries and 300 FOI Disclosure 2025 entries (876 entries total). All list items are archived. Invitation, SkillSelect and EOI title/description matches were reviewed. These logs did not reveal a recent all-state occupational **points × issued-invitation** table; general subclass 189/family-sponsored 491 rounds are not treated as state-nomination outcomes. This does not establish that no such data exists elsewhere.

The public pages initially render empty main content to ordinary web open; actual public table data is obtained from the declared endpoint `/_layouts/15/api/Data.aspx/GetListData` with `webUrl: '/'` and public list names `FOIDataRequest2026`, `FOIDataRequest2025`, `FOIDisclosureLog2026`, `FOIDisclosureLog2025`. No signed-in session or private data was used. Raw HTML, public JSON, selected request-log entries and `search-audit.json` preserve the retrieval trail.
