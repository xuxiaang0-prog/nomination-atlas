#!/usr/bin/env python3
"""Parse official DA26/07/00344 primary lodged applications using PDF text positions.

Run from any directory with pdfplumber available. Input and outputs are next to
this script. Blank cells are preserved in the audit, never converted to zero.
DA26/07/00345 is an overlapping crosscheck, never an additive dataset.
"""
import bisect
import collections
import datetime
import hashlib
import html
import json
from pathlib import Path
import re
import pdfplumber

ROOT = Path(__file__).resolve().parent
INPUT = ROOT / "da-260700344-document-released.PDF"
SOURCE_ID = "dha-da-260700344-primary-lodged-fy2025-26"
DATASET_ID = "dha-primary-lodged-fy2025-26"
STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA", "NOT_SPECIFIED"]
# Counts are right aligned. These right edges remain stable on all 30 pages.
RIGHT_EDGES = [367.5, 430.0, 484.7, 550.0, 606.8, 661.2, 707.5, 767.2, 819.0]


def save(name, value):
    (ROOT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def bbox(word):
    return [round(word[k], 3) for k in ("x0", "top", "x1", "bottom")]


def main():
    pdf = pdfplumber.open(INPUT)
    all_rows = []
    anomalies = []
    unassigned = []
    current_visa = "190"
    page_audit = []
    for p_index, page in enumerate(pdf.pages, 1):
        words = page.extract_words(x_tolerance=2, y_tolerance=2)
        codes = sorted([w for w in words if 130 < w["x0"] < 145 and re.fullmatch(r"\d{6}", w["text"])], key=lambda w: w["top"])
        visa_words = [w for w in words if w["x0"] < 100 and w["text"] in {"190", "491"}]
        rows = []
        body_end = min([w["top"] for w in words if w["text"] in {"Notes:", "Caveats:"}] + [545])
        for i, code_word in enumerate(codes):
            y0 = code_word["top"] - 1.5
            y1 = codes[i+1]["top"] - 1.5 if i+1 < len(codes) else body_end
            near_visa = [w for w in visa_words if w["top"] <= code_word["top"] + 3]
            if near_visa:
                current_visa = max(near_visa, key=lambda w: w["top"])["text"]
            row_words = [w for w in words if y0 <= w["top"] < y1]
            # Wrapped title continuation lines start at the CODE column, not
            # at the first-line title column. Keep every title-region word
            # except the six-digit code, with tolerance for glyph-top jitter.
            title_words = [w for w in row_words if 130 <= w["x0"] < 310 and w is not code_word]
            title_lines = []
            for word in sorted(title_words, key=lambda w: (w["top"], w["x0"])):
                if title_lines and abs(word["top"] - title_lines[-1][0]["top"]) <= 3:
                    title_lines[-1].append(word)
                else:
                    title_lines.append([word])
            title = " ".join(w["text"] for line in title_lines for w in sorted(line,key=lambda w:w["x0"])).strip()
            title_raw = title
            # Original rendered table says "nec"; its text layer corrupts
            # this abbreviation to "nee". Normalise this one documented token.
            title = re.sub(r"\bnee\b", "nec", title)
            cells = {state: {"raw": "", "count": None, "countStatus": "blank_cell_not_published", "bbox": None} for state in STATES}
            value_words = [w for w in row_words if w["x0"] >= 310 and re.fullmatch(r"\d+|<5", w["text"])]
            # One original cell renders as 50 but its PDF text layer says
            # "so". Verified visually on DA00344 p.6 and against DA00345
            # p.53, code241111, Queensland. This is a reading correction.
            if p_index == 6 and code_word["text"] == "241111":
                bad = [w for w in row_words if w["text"] == "so" and abs(w["x1"]-550.0)<1]
                assert len(bad) == 1
                value_words.append({**bad[0], "text": "50"})
            for w in value_words:
                column = min(range(len(RIGHT_EDGES)), key=lambda c: abs(w["x1"] - RIGHT_EDGES[c]))
                distance = abs(w["x1"] - RIGHT_EDGES[column])
                if distance > 3:
                    anomalies.append({"type": "column_edge_distance", "page": p_index, "code": code_word["text"], "word": w, "distance": distance})
                    continue
                state = STATES[column]
                if cells[state]["raw"]:
                    anomalies.append({"type": "duplicate_cell", "page": p_index, "code": code_word["text"], "state": state, "words": [cells[state], w]})
                    continue
                raw = w["text"]
                cells[state] = {"raw": raw, "count": None if raw == "<5" else int(raw), "countStatus": "suppressed_below_5" if raw == "<5" else "published", "bbox": bbox(w)}
            if not title:
                anomalies.append({"type": "empty_title", "page": p_index, "code": code_word["text"]})
            row = {"visaSubclass": current_visa, "occupationCode": code_word["text"], "occupationTitle": title, "occupationTitleRaw": title_raw, "page": p_index, "codeBbox": bbox(code_word), "rowYRange": [round(y0,3), round(y1,3)], "cells": cells}
            rows.append(row)
            all_rows.append(row)
        for w in words:
            if w["x0"] >= 310 and re.fullmatch(r"\d+|<5", w["text"]) and codes[0]["top"] - 1.5 <= w["top"] < body_end:
                if not any(r["rowYRange"][0] <= w["top"] < r["rowYRange"][1] for r in rows):
                    unassigned.append({"page": p_index, "word": w})
        page_audit.append({"page": p_index, "rowCount": len(rows), "firstCode": rows[0]["occupationCode"], "lastCode": rows[-1]["occupationCode"], "visaSubclasses": sorted({r["visaSubclass"] for r in rows})})

    keys = [(r["visaSubclass"], r["occupationCode"]) for r in all_rows]
    assert len(keys) == len(set(keys)), "Duplicate occupation rows in same visa subclass"
    assert not anomalies, anomalies
    assert not unassigned, unassigned
    records = []
    excluded = []
    for row in all_rows:
        for state, cell in row["cells"].items():
            locator = f"PDF p.{row['page']}; subclass {row['visaSubclass']}; ANZSCO {row['occupationCode']}; {state} column; cell bbox {cell['bbox']}"
            if state == "NOT_SPECIFIED" or not cell["raw"]:
                excluded.append({"page": row["page"], "visaSubclass": row["visaSubclass"], "occupationCode": row["occupationCode"], "state": state, **cell})
                continue
            records.append({
                "id": f"{DATASET_ID}-{state}-{row['visaSubclass']}-{row['occupationCode']}",
                "datasetId": DATASET_ID,
                "state": state,
                "visaSubclass": row["visaSubclass"],
                "occupationCode": row["occupationCode"],
                "occupationTitle": row["occupationTitle"],
                "occupationLevel": "occupation",
                "points": None,
                "count": cell["count"],
                "countStatus": cell["countStatus"],
                "sourceId": SOURCE_ID,
                "locator": locator,
                "note": "主申请人签证申请递交数量，不是邀请数量或获批人数；职业按原文件六位 ANZSCO 保存。<5 为原始隐私抑制值，未估算；空白单元格不视为 0。"
            })
    dataset = {"id": DATASET_ID, "title": "2025–26：各州职业主申请人签证递交数量", "metric": "visa_lodged_primary", "stateScope": "all", "periodStart": "2025-07-01", "periodEnd": "2026-06-30", "asOf": None, "programYear": "2025–26", "sourceId": SOURCE_ID, "note": "DA26/07/00344；统计主申请人于 2025-07-01 至 2026-06-30 递交的 190 / 州担保 491 签证申请，按担保州和六位职业。此表未披露 EOI 分数或邀请数；491 的 Not specified 属亲属担保，已排除。空白单元格未转为 0。"}
    summaries = []
    for state in STATES[:8]:
        for visa in ["190", "491"]:
            subset = [r for r in records if r["state"] == state and r["visaSubclass"] == visa]
            published = [r for r in subset if r["count"] is not None]
            summaries.append({"state": state, "visaSubclass": visa, "occupationCellCount": len(subset), "exactCellCount": len(published), "suppressedCellCount": len(subset)-len(published), "publishedCellsSubtotal": sum(r["count"] for r in published), "subtotalIsNotFullTotal": True})
    audit = {"checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "input": INPUT.name, "sha256": hashlib.sha256(INPUT.read_bytes()).hexdigest(), "pageCount": len(pdf.pages), "rawOccupationRowCount": len(all_rows), "uniqueOccupations": len({r["occupationCode"] for r in all_rows}), "rowsByVisaSubclass": dict(collections.Counter(r["visaSubclass"] for r in all_rows)), "recordCount": len(records), "states": sorted({r["state"] for r in records}), "blankCellsExcluded": sum(not r["raw"] and r["state"] != "NOT_SPECIFIED" for r in excluded), "nonblankNotSpecifiedCellsExcluded": sum(bool(r["raw"]) and r["state"] == "NOT_SPECIFIED" for r in excluded), "suppressedCells": sum(r["count"] is None for r in records), "publishedCellSubtotal": sum(r["count"] or 0 for r in records), "hasTableTotal": False, "tableTotalNote": "Source has no grand-total or state-total row. Exact published cells are subtotals only; privacy-suppressed and blank cells prevent an exact complete total. No estimated total is produced.", "pageAudit": page_audit, "stateVisaSummaries": summaries, "anomalies": anomalies, "unassignedNumericCells": unassigned}
    source = {"id": SOURCE_ID, "title": "Home Affairs DA26/07/00344 — primary subclass190/491 applications lodged by occupation and sponsoring state, FY2025–26", "shortTitle": "内政部 2025–26 主申请人递交统计", "url": "https://www.homeaffairs.gov.au/foi/files/data-request-2026/da-260700344-document-released.PDF", "publisher": "Department of Home Affairs", "sourceType": "official_data_request", "localPath": INPUT.name, "sha256": audit["sha256"], "bytes": INPUT.stat().st_size, "releaseDate": "2026-08-21", "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "method": "pdf_text_coordinates", "pageCount": len(pdf.pages), "classificationVersion": None, "note": "Request-log summary omits primary wording; actual released PDF p.1 title and p.30 note3 explicitly limit to primary applicants. Original PDF retained. Source not an invitation-round dataset."}
    audit["readingCorrections"] = [{"page":6,"visaSubclass":"190","occupationCode":"241111","state":"QLD","pdfTextLayer":"so","renderedValue":"50","crosscheckSource":"DA26/07/00345 p.53","proofImage":"da344-p6-count50.png","countEstimated":False}]
    audit["importedUniqueOccupations"] = len({r["occupationCode"] for r in records})
    audit["onlyUnspecifiedOccupationCodesExcluded"] = sorted({r["occupationCode"] for r in all_rows} - {r["occupationCode"] for r in records})
    audit["titleNormalisation"] = {"description":"Wrapped lines preserved including first word at code column. Text-layer wholeword nee normalised to nec confirmed against original rendered table; raw title retained in raw rows.","numericChanges":0}
    save("recent-activity.json", {"datasets": [dataset], "records": records, "sources": [source]})
    save("raw-occupation-rows.json", all_rows)
    save("excluded-cells.json", excluded)
    save("extraction-audit.json", audit)
    print(json.dumps({k: v for k,v in audit.items() if k not in {"pageAudit", "stateVisaSummaries"}}, ensure_ascii=False, indent=2))
    print(json.dumps(summaries, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
