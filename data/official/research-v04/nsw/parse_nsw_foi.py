"""Read-only extraction of official NSW 2019 SkillSelect invitation rows.

Run after pdftotext -layout; the original PDF splits its columns horizontally.
Pages 1-69 contain the occupation/date/score; pages 70-138 contain English/country.
Identical rows are retained: these are separate published EOIs, not duplicate bugs.
"""
from pathlib import Path
import collections
import datetime as dt
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parent
SID = "nsw-foi-fa191201127"
REG = re.compile(r"^\s*(\d{1,2}/\d{2}/2019)\s+(\d{1,2}/\d{2}/2019)\s+(190)\s+(NSW)\s+(\d{4})\s+(.+?)\s+(\d{6})\s+(.+?)\s+(\d{1,2}/\d{2}/2019)\s+(\d+)\s*$")
DATE = lambda s: dt.datetime.strptime(s, "%d/%m/%Y").date().isoformat()
source_sha = hashlib.sha256((ROOT / (SID + ".pdf")).read_bytes()).hexdigest()
pages = (ROOT / (SID + ".txt")).read_text().split("\f")
assert len(pages) == 139 and not pages[-1].strip()
raw = []
page_counts = []
for idx, page in enumerate(pages[:69]):
    lines = [(i, line) for i, line in enumerate(page.splitlines(), 1) if re.match(r"^\s*1/01/2019", line)]
    right = [re.match(r"^(Superior|Proficient|Competent|NULL)\s+(.+?)\s*$", line) for line in pages[idx+69].splitlines()]
    right = [r for r in right if r]
    assert len(lines) == len(right), (idx+1, len(lines), len(right))
    page_counts.append({"page":idx+1,"rowCount":len(lines),"companionPage":idx+70,"companionRowCount":len(right)})
    for rowno, ((lineno, line), detail) in enumerate(zip(lines, right), 1):
        m = REG.fullmatch(line)
        assert m, (idx+1, line)
        start, end, visa, state, parent_code, parent_title, code, title, invitation, score = m.groups()
        assert code.startswith(parent_code)
        score = int(score)
        assert 65 <= score <= 100 and score % 5 == 0
        english, country = detail.groups()
        raw.append({
            "id":f"{SID}-p{idx+1}-r{rowno}",
            "state":state,"visaSubclass":visa,
            "periodStart":DATE(start),"periodEnd":DATE(end),"periodLabel":"2019 日历年",
            "invitationDate":DATE(invitation),
            "occupationCode":code,"occupationTitle":title,
            "occupationLevel":"occupation","parentCode":parent_code,"parentTitle":parent_title,
            "classificationSystem":"ANZSCO","classificationVersion":None,
            "points":score,"pointsBasis":"subclass_score_as_published","pointsType":"individual_eoi",
            "englishProficiency":None if english == "NULL" else english,
            "countryOfResidence":country,"residence":"onshore" if country == "AUSTRALIA" else "offshore",
            "invitationCount":1,"countStatus":"derived_from_official_rows","countScope":"one_published_eoi_row",
            "metric":"skillselect_visa_application_invitation",
            "sourceId":SID,"sourceSha256":source_sha,
            "locator":f"PDF p.{idx+1}, data row {rowno}; English/residence p.{idx+70}, row {rowno}",
            "sourcePage":idx+1,"sourceRow":rowno,"textLine":lineno,
        })
assert len(raw) == 3416

def aggregate(items, keys):
    groups = collections.defaultdict(list)
    for row in items:
        groups[tuple(row[k] for k in keys)].append(row)
    output = []
    for group, values in groups.items():
        first = values[0]
        scores = [v["points"] for v in values]
        dist = collections.Counter(scores)
        output.append({
            **dict(zip(keys,group)),
            "state":"NSW","visaSubclass":"190","periodStart":"2019-01-01","periodEnd":"2019-12-31",
            "periodLabel":"2019 日历年（历史 FOI）",
            "occupationTitle":first["occupationTitle"],"occupationLevel":"occupation",
            "parentCode":first["parentCode"],"parentTitle":first["parentTitle"],
            "classificationSystem":"ANZSCO","classificationVersion":None,
            "minPoints":min(scores),"maxPoints":max(scores),
            "pointsBasis":"subclass_score_as_published","pointsType":"minimum_observed_among_disclosed_eois",
            "invitationCount":len(values),"countStatus":"derived_from_official_rows","countUnit":"EOIs",
            "countScope":"occupation_in_published_calendar_year",
            "metric":"skillselect_visa_application_invitation",
            "scoreDistribution":[{"points":p,"invitationCount":dist[p],"countStatus":"derived_from_official_rows"} for p in sorted(dist,reverse=True)],
            "firstInvitationDate":min(v["invitationDate"] for v in values),
            "lastInvitationDate":max(v["invitationDate"] for v in values),
            "sourceId":SID,"sourceSha256":source_sha,
            "sourcePages":sorted({v["sourcePage"] for v in values}),
            "sourceRowIds":[v["id"] for v in values],
            "note":"2019 年官方 FOI 披露的 SkillSelect 签证申请邀请 EOI 记录，按原表逐行统计；并非当前州提名邀请线或获签人数，同一人可有多个 EOI。",
        })
    return sorted(output,key=lambda r:(-r["minPoints"],-r["invitationCount"],r["occupationCode"]))

occupation = aggregate(raw,["occupationCode"])
assert len(occupation) == 150 and sum(r["invitationCount"] for r in occupation) == len(raw)
for row in occupation:
    assert sum(v["invitationCount"] for v in row["scoreDistribution"]) == row["invitationCount"]

# Cross-check every NSW occupation/date/score cell against the second official FOI.
# This second document masks cells <5 and splits columns after the first 71 pages.
other = (ROOT / "nsw-vic-foi-fa191200647.txt").read_text().split("\f")
other_reg = re.compile(r"^\s*(\d{1,2}/\d{2}/2019)\s+(\d{1,2}/\d{2}/2019)\s+(190)\s+(NSW|VIC)\s+(\d{4})\s+(.+?)\s+(\d{6})\s+(.+?)\s+(\d{1,2}/\d{2}/2019)\s+(<5|\d+)\s+(<5|\d+)\s*$")
counter = collections.Counter((r["occupationCode"],r["invitationDate"],r["points"]) for r in raw)
checked = 0
compared_keys = set()
disagreements = []
other_occ = set()
for idx,page in enumerate(other[:71]):
    left = [line for line in page.splitlines() if re.match(r"^\s*1/01/2019",line)]
    right = [line.split() for line in other[idx+71].splitlines() if re.fullmatch(r"\s*(?:<5|\d+)(?:\s+(?:<5|\d+)){5}\s*",line)]
    assert len(left) == len(right), ("comparison",idx+1,len(left),len(right))
    for line, rest in zip(left,right):
        m = other_reg.fullmatch(line)
        assert m, ("comparison",idx+1,line)
        start,end,visa,state,parent,parent_name,code,title,date,c65,c70=m.groups()
        if state != "NSW": continue
        other_occ.add(code)
        for score, token in zip(range(65,101,5),[c65,c70]+rest):
            key=(code,DATE(date),score)
            assert key not in compared_keys
            compared_keys.add(key)
            val=counter[key]
            ok = 0 < val < 5 if token == "<5" else val == int(token)
            if not ok: disagreements.append({"code":code,"date":DATE(date),"points":score,"rawRowCount":val,"comparisonToken":token,"comparisonPage":idx+1})
            checked += 1
assert not disagreements, disagreements[:8]
assert set(counter).issubset(compared_keys)
assert len(other_occ)==150

qa={"rawRows":len(raw),"occupations":len(occupation),"parsedPages":69,"companionPages":69,
    "pageCounts":page_counts,"unparsedDataRows":0,
    "rawRowsDeduplicated":False,"reason":"Each source row represents an EOI; identical columns may represent distinct EOIs.",
    "secondarySourceId":"nsw-vic-foi-fa191200647","crossCheckedCells":checked,"disagreements":disagreements,
    "scoreCounts":dict(sorted(collections.Counter(r["points"] for r in raw).items())),
    "suppressionInPrimarySource":False,"classificationVersion":"Not stated in source; retained as null",
    "metric":"skillselect_visa_application_invitation","periodStart":"2019-01-01","periodEnd":"2019-12-31",
    "visualCheckedPages":[1,69],"sourceSha256":source_sha}
for name,value in [("nsw-2019-raw-eois.json",raw),("nsw-2019-occupation-summary.json",occupation),("nsw-2019-parse-qa.json",qa)]:
    (ROOT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in qa.items() if k not in ['pageCounts']},ensure_ascii=False,indent=2))
print(json.dumps([r for r in occupation if r['occupationCode'] in ['132211','211213','233915','261313','331212','511112']],ensure_ascii=False,indent=2))
