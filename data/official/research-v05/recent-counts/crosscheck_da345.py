#!/usr/bin/env python3
"""Compare all text-readable 190 cells in overlapping DA26/07/00345.

The table header on p.50 was rendered and inspected to confirm state order.
No rows from this file are added to the primary DA26/07/00344 dataset.
"""
import json
from pathlib import Path
import re
import pdfplumber

ROOT = Path(__file__).resolve().parent
STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA", "NOT_SPECIFIED"]
EDGES = [516.8,542.5,568.1,593.8,619.5,645.3,671.0,696.7,722.4]
base = {(r["visaSubclass"],r["occupationCode"]): r for r in json.loads((ROOT/"raw-occupation-rows.json").read_text())}
pdf = pdfplumber.open(ROOT / "da-260700345-document-released.PDF")
comparisons = []
differences = []
checked_rows = 0
for page_index in range(50,58):
    page = pdf.pages[page_index]
    words = page.extract_words(x_tolerance=2,y_tolerance=2)
    codes = sorted([w for w in words if 140<w["x0"]<145 and re.fullmatch(r"\d{6}",w["text"])],key=lambda w:w["top"])
    for i,c in enumerate(codes):
        y0=c["top"]-1
        y1=codes[i+1]["top"]-1 if i+1<len(codes) else 590
        values=[w for w in words if w["x0"]>500 and y0<=w["top"]<y1 and re.fullmatch(r"\d+|<5|-",w["text"])]
        cells={}
        for w in values:
            column=min(range(9),key=lambda j:abs(w["x1"]-EDGES[j]))
            assert abs(w["x1"]-EDGES[column])<3,(page_index+1,c,w)
            state=STATES[column]
            assert state not in cells,(page_index+1,c,state)
            cells[state]=w["text"]
        assert len(cells)==9,(page_index+1,c,cells)
        checked_rows+=1
        for state in STATES:
            raw=cells[state]
            expected=base[("190",c["text"])]["cells"][state]["raw"] or "-"
            item={"page":page_index+1,"visaSubclass":"190","occupationCode":c["text"],"state":state,"rawValue":raw,"da344Value":expected,"matches":raw==expected}
            comparisons.append(item)
            if raw!=expected:differences.append(item)
audit={"primaryDataset":"DA26/07/00344","crosscheckDataset":"DA26/07/00345","checkedPages":list(range(51,59)),"checkedOccupationRows":checked_rows,"checkedCells":len(comparisons),"differences":differences,"comparisonOfBlank":"DA00344 empty text-layer cell matches DA00345 visually published dash; neither is converted to zero.","limitations":"Image-only DA00345 pages 50 and 59–68 not included in automated comparison. All DA00344 pages are text readable, and their 190/491 cells are independently parsed from coordinates.","noAdditiveRows":True}
(ROOT/"da345-crosscheck-audit.json").write_text(json.dumps(audit,ensure_ascii=False,indent=2)+"\n")
(ROOT/"da345-crosscheck-cells.json").write_text(json.dumps(comparisons,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(audit,ensure_ascii=False,indent=2))
assert not differences
