"""Parse split-width public FOI table; assert each page has matching left/right rows."""
from pathlib import Path
import re,json,collections,datetime,hashlib
p=Path(__file__).parent
pages=(p/'fa-191201350.txt').read_text().split('\f')[:268]
assert len(pages)==268
left=[re.findall(r'^\s*(\d{1,2}/\d{1,2}/\d{4})\s+(\d{1,2}/\d{1,2}/\d{4})\s+(489|491)\s+(STN|SNR)\s+(\w+)\s+(\d{4})\s+(.+?)\s+(\d{6})\s+(.+?)\s+(\d{1,2}/\d{1,2}/\d{4})\s*$',pg,re.M) for pg in pages[:134]]
right=[re.findall(r'^\s*(\d{2,3})\s+(Competent|Proficient|Superior|NULL)\s+(.+?)\s*$',pg,re.M) for pg in pages[134:]]
assert all(len(a)==len(b) for a,b in zip(left,right)),[(i+1,len(a),len(b)) for i,(a,b) in enumerate(zip(left,right)) if len(a)!=len(b)]
# Ensure that no data-looking lines were discarded.
assert sum(len(x) for x in left)==sum(bool(re.match(r'^\s*1/01/2019\s+30/12/2019\s+',ln)) for pg in pages[:134] for ln in pg.splitlines())
assert sum(len(x) for x in right)==sum(bool(re.match(r'^\s*\d{2,3}\s+',ln)) for pg in pages[134:] for ln in pg.splitlines())
iso=lambda v:datetime.datetime.strptime(v,'%d/%m/%Y').date().isoformat()
sha=hashlib.sha256((p/'fa-191201350.pdf').read_bytes()).hexdigest()
rows=[]
for i,(aa,bb) in enumerate(zip(left,right)):
 for j,(a,b) in enumerate(zip(aa,bb)):
  assert int(b[0])%5==0 and 60<=int(b[0])<=130
  row={'id':f'dha-fa191201350-p{i+1}-r{j+1}','state':a[4],'visaSubclass':a[2], 'subclassType':a[3], 'occupationCode':a[7], 'occupationName':a[8],'occupationGranularity':'six_digit_occupation','groupCode':a[5],'groupName':a[6],'invitationDate':iso(a[9]),'periodStart':iso(a[0]),'periodEnd':iso(a[1]),'points':int(b[0]),'pointsBasis':'Subclass Score (as reported; nomination-bonus inclusion not explicitly stated in this document)','english':None if b[1]=='NULL' else b[1],'residenceCountry':b[2],'residenceScope':'Australia' if b[2]=='AUSTRALIA' else 'Outside Australia','count':1,'countUnit':'EOI invitation record','metric':'skillselect_visa_application_invitation_after_state_nomination','sourceId':'dha-foi-fa191201350','sourceSha256':sha,'leftPage':i+1,'scorePage':i+135,'rowOnPage':j+1,'sourceLocator':f'PDF pages {i+1} and {i+135}, row {j+1} of aligned split-width table'}
  rows.append(row)
filtered=[r for r in rows if r['visaSubclass']=='491']
assert len(rows)==6659 and len(filtered)==266
for name,rr in [('foi-489-491-individual-records.json',rows),('foi-491-individual-records.json',filtered)]:
 (p/name).write_text(json.dumps(rr,ensure_ascii=False,indent=2))

def group(rr,month=False):
 d=collections.defaultdict(list)
 for r in rr:d[(r['state'],r['visaSubclass'],r['occupationCode'],r['invitationDate'][:7] if month else '2019')].append(r)
 out=[]
 for (st,v,oc,date),group in sorted(d.items()):
  hist=collections.Counter(r['points'] for r in group)
  out.append({'state':st,'visaSubclass':v,'occupationCode':oc,'occupationName':group[0]['occupationName'],'period':date,'periodStart':'2019-01-01','periodEnd':'2019-12-30','invitationDateMin':min(r['invitationDate'] for r in group),'invitationDateMax':max(r['invitationDate'] for r in group),'pointsMin':min(hist),'pointsMax':max(hist),'pointsDefinition':'computed_minimum_of_reported_subclass_scores_in_this_historical_cohort','invitationCount':len(group),'countUnit':'EOI invitation records','pointsHistogram':dict(sorted(hist.items())),'metric':'skillselect_visa_application_invitation_after_state_nomination','sourceId':'dha-foi-fa191201350','sourceSha256':sha,'sourceLocators':[r['sourceLocator'] for r in group],'recordIds':[r['id'] for r in group]})
 return out
summ=group(filtered);by_month=group(filtered,True)
(p/'foi-491-occupation-summary.json').write_text(json.dumps(summ,ensure_ascii=False,indent=2))
(p/'foi-491-occupation-month-summary.json').write_text(json.dumps(by_month,ensure_ascii=False,indent=2))
validation={'documentPages':268,'pairedPages':134,'pagePairRowCountsMatch':True,'leftRows':6659,'rightRows':6659,'retained491Rows':266,'retained491OccupationStateGroups':len(summ),'retained491OccupationStateMonthGroups':len(by_month),'byVisaAndState':{f'{v}-{st}':n for (v,st),n in sorted(collections.Counter((r['visaSubclass'],r['state']) for r in rows).items())},'491DateMin':min(r['invitationDate'] for r in filtered),'491DateMax':max(r['invitationDate'] for r in filtered),'491ScoreMin':min(r['points'] for r in filtered),'491ScoreMax':max(r['points'] for r in filtered),'491MissingEnglish':sum(r['english'] is None for r in filtered),'visualSpotChecks':['PDF page 130 versus page 264 aligned rows, including NULL English preserved','PDF page 134 table footer confirms EOIs are not unique persons'],'noImputation':True,'suppression':'No counts were suppressed in the released individual-row table. Count=number of published rows, never unique individuals.'}
(p/'parse-validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2));print(json.dumps(validation,ensure_ascii=False,indent=2))
print('TOP 491',json.dumps(sorted(summ,key=lambda r:-r['invitationCount'])[:8],ensure_ascii=False)[:2800])
