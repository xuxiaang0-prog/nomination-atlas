# Official SkillSelect EOI snapshots — research completed 2026-10-09

The current public SkillSelect dashboard was retrieved directly, using its own anonymous access flow and the documented Qlik JSON-RPC API. No authenticated SkillSelect applicant account, paid service, private data, persistent app mutation, source-code alteration or privacy-rule bypass was used.

The authoritative dashboard URL is:

https://api.dynamic.reports.employment.gov.au/anonap/extensions/hSKLS02_SkillSelect_EOI_Data/hSKLS02_SkillSelect_EOI_Data.html

The older URI with spaces instead of underscores returned HTTP 404. Web search could not render the anonymous dashboard data, but direct public retrieval succeeded. The downloadable HTML and JavaScript identify app `aaac76b5-ad30-477e-9ca0-472f8ab57fc8`, Results Table `eymDb`, and the public Help sheet. The app has `read` and `exportdata` privileges. Its official reload time is **2026-10-02T00:30:38.054Z**. The latest available As At Month is **09/2026**; the app currently retains 24 month values from 10/2024 through 09/2026.

The Department itself points requesters seeking 190/491 invitation and points data to this dashboard in official FOI FA 220800875:

https://www.homeaffairs.gov.au/foi/files/2022/fa-220800875-document-released.PDF

## Import candidate

`official-invited-snapshots-bundle.json` contains two separate month-end Invited snapshots: **2026-09-30** and **2026-06-30**. It has 3,134 occupation/point-band records across all eight states and territories, two source metadata records, and two datasets with independently queried state totals and occupation totals. The ANY state preference is preserved separately and must not be attributed to any particular state.

The June snapshot covers 82–127 six-digit occupations per jurisdiction: ACT 99, NSW 120, NT 101, QLD 118, SA 127, TAS 82, VIC 122, WA 122. It is more extensive than the September snapshot, which includes fewer EOIs remaining in Invited status. This difference is a change in stock, not an invitation-flow measurement.

## Interpretation rules from the original dashboard

- **As At Month** is a snapshot taken on the last day of the selected month.
- **Invited** means an invitation to apply for a visa has been issued and the EOI remains in that status at the snapshot. It is not the number of invitations issued during that month or financial year.
- **Points** are the score recorded at the snapshot. The official Help explicitly warns that Invited and Lodged scores can differ from the score the EOI was invited against, because the visa score can change whilst in invited status. These values must not be labelled invitation-round cutoffs.
- **Nominated State** is the state/territory the intending migrant wishes to be nominated by. It does not establish the state government that issued the invitation.
- Counts refer to EOIs, not necessarily distinct people. One person can create multiple EOIs; cross-state and cross-visa combinations should not be advertised as unique migrant totals.
- Counts 1–19 are officially masked as **<20**. The original Count EOIs master measure `fPpzEmW` is retained unchanged. No hidden count is inferred from a mask. The masked raw cells have `qNum: "NaN"`; structured outputs use `count: null` and `countDisplay: "<20"`.
- Published state and occupation totals were queried independently. They cannot be reconstructed by summing masked point-band cells. Monthly stocks must never be added together as annual invitation counts.
- Absent rows are not converted to zero. The returned table only supplies combinations it publishes; a missing occupation/status/state cell is not evidence that no invitations were issued in that period.

## Retrieval and validation

`read_official_qlik.py --snapshot` retrieves the latest month; `--snapshot --month=06/2026` retrieves the June snapshot. Both use the unchanged official table with the public UI's session column toggles and state filters. The official limit of two additional display fields and two additional filter fields remains unchanged. The point-band queries display Occupation and Score while selecting one Nominated State. The totals query displays Nominated State; the occupation-total query displays Occupation and Nominated State. All counts retain the original masking measure and calculation conditions.

The parser is `parse_official_snapshot.py`; run without a month for September or with `--month=06/2026` for June. It verifies month, status, visa stream (190SAS and 491SNR only), six-digit occupation codes, matrix shape, duplicate keys, mask preservation, and exact published counts. It records the raw data files' SHA-256 hashes.

The original HTML/JavaScript, app layout, field list and field values, sheet/object properties and layouts, official master measure, session variable definitions, raw data matrices, selections and query audit are preserved here. A regular WebSocket ping timeout interrupted the first snapshot capture; completed primary captures were retained, then the remaining states were retrieved through the same public connection with the client keepalive timer disabled. No HTTP refusal or login was bypassed.

## Public mirrors investigated, not used as original data

`eoidata.com` and `eoi-insights.com` both expose recent September 2026 data. Their HTML/metadata were downloaded for source discovery and interpretation checks. Their data were **not imported** because the public original was retrieved successfully. They must not be described as official originals. eoi-insights' metadata specifically says its small-count gaps may contain provider estimates; those estimates were not used. The archived files whose names start with `mirror-` are secondary-provider evidence only.

## Primary technical references

https://qlik.dev/apis/json-rpc/

https://help.qlik.com/en-US/sense-developer/May2026/Subsystems/EngineAPI/Content/Sense_EngineAPI/GettingStarted/connecting-to-engine-api.htm

https://qlik.dev/apis/json-rpc/qix/genericobject/

https://qlik.dev/apis/json-rpc/qix/genericvariable/

