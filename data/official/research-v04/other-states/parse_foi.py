from pathlib import Path
from datetime import datetime, timezone
import collections, hashlib, json, re, subprocess
import fitz
BASE=Path(__file__).resolve().parent
PDF=BASE/'foi-2019-vic-qld-nt-tas.pdf'
SOURCE_ID='dha-foi-190900418-2019'
URL='https://www.homeaffairs.gov.au/foi/files/2019/fa-190900418-document-released.PDF'
SHA=hashlib.sha256(PDF.read_bytes()).hexdigest()
subprocess.run(['pdftotext','-layout',str(PDF),str(PDF.with_suffix('.txt'))],check=True)
text=PDF.with_suffix('.txt').read_text()
raw=[];audit=[]
pattern=r'\s*(\d{1,2}/\d{2}/2019)\s+(\d{4})\s+(.+?)\s+(VIC|TAS|NT|QLD)\s+(\d+)\s+(Proficient|Competent|Superior|NULL)\s*'
doc=fitz.open(PDF)
for pidx,page in enumerate(text.split('\f')[:-1]):
    page_rows=[]
    for lnum,line in enumerate(page.splitlines(),1):
        m=re.fullmatch(pattern,line)
        if m:
            d,code,title,state,points,english=m.groups()
            date=datetime.strptime(d,'%d/%m/%Y').date().isoformat()
            page_rows.append(dict(id=f'{SOURCE_ID}-p{pidx+1}-r{len(page_rows)+1}',sourcePage=pidx+1,sourceRow=len(page_rows)+1,textLine=lnum,roundDate=date,state=state,visaSubclass='190',occupationCode=code,occupationTitle=title,occupationLevel='unit_group',points=int(points),englishProficiency=None if english=='NULL' else english,englishProficiencySourceValue=english,sourceText=line.strip()))
        elif re.match(r'\s*\d{1,2}/\d{2}/2019\s+\d{4}',line):
            raise ValueError(f'unparsed data line on {pidx+1}:{lnum}: {line}')
    # Independent geometric extraction compares every data row, not just the sum.
    words=doc[pidx].get_text('words')
    dates=sorted([w for w in words if re.fullmatch(r'\d{1,2}/\d{2}/2019',w[4]) and 50<w[0]<110 and (pidx>0 or w[1]>205)],key=lambda w:w[1])
    assert len(dates)==len(page_rows), (pidx+1,'count',len(dates),len(page_rows))
    for dr,rr in zip(dates,page_rows):
        linewords=sorted([w for w in words if abs(w[1]-dr[1])<1],key=lambda w:w[0])
        code=' '.join(w[4] for w in linewords if 110<=w[0]<153)
        state=' '.join(w[4] for w in linewords if 368<=w[0]<395)
        points=' '.join(w[4] for w in linewords if 395<=w[0]<442)
        english=' '.join(w[4] for w in linewords if 442<=w[0]<530)
        assert code==rr['occupationCode'] and state==rr['state'] and points==str(rr['points']) and english==rr['englishProficiencySourceValue'],(pidx+1,rr,linewords)
        assert datetime.strptime(dr[4],'%d/%m/%Y').date().isoformat()==rr['roundDate']
    audit.append(dict(page=pidx+1,parsedRows=len(page_rows),independentCoordinateRows=len(dates),fieldComparisonsPassed=True,firstRowDate=page_rows[0]['roundDate'],lastRowDate=page_rows[-1]['roundDate'],countsByState=dict(collections.Counter(x['state'] for x in page_rows))))
    raw.extend(page_rows)
assert len(raw)==2847
# Do not deduplicate identical rows: each occurrence is an EOI in the official list.
agg=collections.defaultdict(list)
for r in raw:agg[(r['state'],r['visaSubclass'],r['roundDate'],r['occupationCode'],r['points'],r['englishProficiencySourceValue'])].append(r)
records=[]
for (state,visa,date,code,points,eng),rr in sorted(agg.items()):
    y,m,d=map(int,date.split('-'));fy=y if m>=7 else y-1
    rid=f'{SOURCE_ID}-{state}-{date}-{code}-{points}-{eng.lower()}'
    flags=['historical_2019','derived_from_official_rows','nomination_bonus_not_explicitly_documented']
    if code=='2621':flags.append('source_title_truncated')
    title=rr[0]['occupationTitle']
    locators=[dict(page=x['sourcePage'],row=x['sourceRow'],id=x['id']) for x in rr]
    records.append(dict(id=rid,state=state,programYear=f'{fy}-{str(fy+1)[2:]}',roundDate=date,roundMonth=date[:7],roundLabel=f'{date} · SkillSelect visa invitations (2019 FOI)',periodStart='2019-01-01',periodEnd='2019-09-07',visaSubclass=visa,stream='State-nominated SkillSelect 190 visa invitations (FOI)',residence=None,occupationCode=code,occupationTitle=title,occupationLevel='unit_group',points=points,pointsBasis='eoi_total_points_as_published',pointsStatus='published',invitationCount=len(rr),countStatus='published',countScope='unit_group_points_english_date',sourceId=SOURCE_ID,locator='; '.join(f'p. {x["sourcePage"]}, row {x["sourceRow"]}' for x in rr),note='2019 年历史官方 FOI；按州、签证、邀请日、4 位职业组、原表总分及英语档位统计逐 EOI 行数。每行是主申请 EOI 的签证申请邀请，不是州预邀请或签证获批人数。原表未披露境内/境外；未明确说明总分是否包含提名加分，不另加减分。不得视为当前分数线。',recordKind='foi_invitation_distribution',qualityFlags=flags,publicationDate='2019-11-01',englishProficiency=None if eng=='NULL' else eng,englishProficiencySourceValue=eng,verificationStatus='derived_from_official_rows',countMethod='derived_from_official_rows',sourceSha256=SHA,sourceRowIds=[x['id'] for x in rr],sourceLocators=locators,sourcePeriodStart='2019-01-01',sourcePeriodEnd='2019-09-07',observedInvitationCountUnit='primary_applicant_eois',pointDefinitionNote='The source requests total points and labels the column Points Score. Nomination bonus inclusion is not explicitly stated.'))
assert sum(x['invitationCount'] for x in records)==len(raw)
group_summaries=[]
bygroup=collections.defaultdict(list)
for r in raw:bygroup[(r['state'],r['occupationCode'])].append(r)
for (state,code),rr in sorted(bygroup.items()):
    group_summaries.append(dict(state=state,visaSubclass='190',occupationCode=code,occupationTitle=rr[0]['occupationTitle'],occupationLevel='unit_group',periodStart='2019-01-01',periodEnd='2019-09-07',observedMinimumPoints=min(x['points'] for x in rr),observedMaximumPoints=max(x['points'] for x in rr),invitationCount=len(rr),pointsDistribution=[dict(points=p,invitationCount=n) for p,n in sorted(collections.Counter(x['points'] for x in rr).items(),reverse=True)],englishMix=dict(collections.Counter(x['englishProficiencySourceValue'] for x in rr)),countMethod='derived_from_official_rows',sourceId=SOURCE_ID,sourceSha256=SHA))
source=dict(id=SOURCE_ID,title='FOI FA 19/09/00418, 00426, 00427, 00437: subclass 190 EOIs invited by VIC, TAS, NT, QLD, 1 January–7 September 2019',publisher='Australian Government Department of Home Affairs',url=URL,retrievedAt=datetime.now(timezone.utc).isoformat(),publishedAt='2019-11-01',sha256=SHA,snapshotKind='original_pdf',localPath=str(PDF),note='41-page official released document. Four-digit ANZSCO unit groups, total points, invitation date and English; no onshore/offshore field; one EOI per original row. Historical 2019 data only.')
meta=dict(sourceId=SOURCE_ID,sourceSha256=SHA,rawRowCount=len(raw),aggregatedRowCount=len(records),stateOccupationGroupCount=len(group_summaries),rawRowsByState=dict(collections.Counter(x['state'] for x in raw)),aggregateRowsByState=dict(collections.Counter(x['state'] for x in records)),occupationGroupsByState=dict(collections.Counter(x['state'] for x in group_summaries)),dateRangeObserved=[min(x['roundDate'] for x in raw),max(x['roundDate'] for x in raw)],periodStart='2019-01-01',periodEnd='2019-09-07',aggregationKeys=['state','visaSubclass','roundDate','occupationCode','points','englishProficiencySourceValue'],pointDefinition='Total points as requested; Points Score column. Source does not expressly say whether nomination points are included. No adjustment applied.',countDefinition='Count of official primary-applicant EOI rows with exactly the stated aggregation keys. Not unique migrants, grants, or state ROI invitations. Identical rows are distinct listed EOIs and retained.',completeness='All 41 pages parsed. Every row compared against independent PDF geometric extraction for date, code, state, points and English. Source is complete only within its stated period/states/visa, not current history.',pageAudit=audit,visualInspectionPages=[1,41])
for filename,data in [('raw-rows.json',raw),('records.json',records),('group-summaries.json',group_summaries),('foi-source.json',source),('extraction-audit.json',meta)]:
    (BASE/filename).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in meta.items() if k!='pageAudit'},ensure_ascii=False,indent=2))
