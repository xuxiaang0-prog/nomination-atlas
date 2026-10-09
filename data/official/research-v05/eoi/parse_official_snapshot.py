"""Parse published masked Qlik table captures. Never infer confidential counts."""
from collections import Counter
import calendar
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
STATES = ['ACT','NSW','NT','QLD','SA','TAS','VIC','WA']
REQUESTED_MONTH = next((a.split('=',1)[1] for a in sys.argv if a.startswith('--month=')),None)
MONTH = REQUESTED_MONTH or '09/2026'
MONTH_ID = MONTH[3:]+'-'+MONTH[:2]
PREFIX = 'official-invited-' + (MONTH_ID+'-' if REQUESTED_MONTH else '')
SOURCE_ID = 'dha-skillselect-eoi-'+MONTH_ID
DATASET_ID = 'skillselect-invited-'+MONTH_ID
URL = 'https://api.dynamic.reports.employment.gov.au/anonap/extensions/hSKLS02_SkillSelect_EOI_Data/hSKLS02_SkillSelect_EOI_Data.html'
APP = 'aaac76b5-ad30-477e-9ca0-472f8ab57fc8'
SNAPSHOT = f'{MONTH_ID}-{calendar.monthrange(int(MONTH[3:]),int(MONTH[:2]))[1]:02d}'
files = {}
mask_numeric_values = set()

def load_matrix(name):
    path = ROOT / (name+'-data.json')
    raw = path.read_bytes()
    files[path.name] = {'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
    rows = [r for p in json.loads(raw)['qDataPages'] for r in p['qMatrix']]
    layout = json.loads((ROOT / (name+'-layout.json')).read_text())['qLayout']['qHyperCube']
    assert len(rows)==layout['qSize']['qcy'], name
    for row in rows:
        assert len(row)==layout['qSize']['qcx'], name
    return rows

def count_value(cell):
    text = cell.get('qText','').strip()
    if text=='<20':
        mask_numeric_values.add(str(cell.get('qNum')))
        assert cell.get('qNum') in [None,'NaN'], 'Masked raw count contains unexpected numeric data'
        return {'count':None,'countStatus':'suppressed_below_20','countDisplay':'<20'}
    assert re.fullmatch(r'\d+',text), 'Unknown count format: '+text
    count = int(text)
    assert count==0 or count>=20, 'Official small count was not masked'
    assert int(cell['qNum'])==count
    return {'count':count,'countStatus':'published','countDisplay':text}

def base_cells(row):
    assert row[0]['qText']==MONTH
    assert row[1]['qText'].startswith(('190SAS','491SNR'))
    return '190' if row[1]['qText'].startswith('190SAS') else '491'

def occupation(text):
    match = re.fullmatch(r'(\d{6})\s+(.+)',text)
    assert match, text
    return {'occupationCode':match[1],'occupationTitle':match[2]}

def locator(name,index):
    return f'Published Qlik Results Table eymDb; {name}-data.json; row {index+1}; As At Month {MONTH}; EOI Status INVITED'

records=[]
unspecified_records=[]
for state in STATES+['ANY']:
    name=PREFIX+state
    for index,row in enumerate(load_matrix(name)):
        visa=base_cells(row)
        assert row[3]['qText']=='INVITED'
        point_text=row[4]['qText']
        points=int(point_text) if re.fullmatch(r'\d+',point_text) else None
        record={
            'id':f'{DATASET_ID}-{state}-{visa}-{row[2]["qText"].split()[0]}-{points}',
            'datasetId':DATASET_ID,'state':state,'visaSubclass':visa,
            **occupation(row[2]['qText']),'points':points,
            **count_value(row[-1]),'status':'INVITED','snapshotDate':SNAPSHOT,
            'sourceId':SOURCE_ID,'locator':locator(name,index),
        }
        (records if state in STATES else unspecified_records).append(record)

state_totals=[]
unspecified_state_totals=[]
name=PREFIX+'state-totals'
for index,row in enumerate(load_matrix(name)):
    visa=base_cells(row)
    assert row[2]['qText']=='INVITED'
    state=row[3]['qText']
    total={'datasetId':DATASET_ID,'state':state,'visaSubclass':visa,**count_value(row[-1]),'sourceId':SOURCE_ID,'locator':locator(name,index)}
    (state_totals if state in STATES else unspecified_state_totals).append(total)
assert len(state_totals)==16
assert {r['state'] for r in state_totals}==set(STATES)

occupation_totals=[]
unspecified_occupation_totals=[]
name=PREFIX+'occupation-totals'
for index,row in enumerate(load_matrix(name)):
    visa=base_cells(row)
    assert row[3]['qText']=='INVITED'
    state=row[4]['qText']
    total={'datasetId':DATASET_ID,'state':state,'visaSubclass':visa,**occupation(row[2]['qText']),**count_value(row[-1]),'sourceId':SOURCE_ID,'locator':locator(name,index)}
    (occupation_totals if state in STATES else unspecified_occupation_totals).append(total)

keys=[(r['state'],r['visaSubclass'],r['occupationCode'],r['points']) for r in records]
assert len(set(keys))==len(keys)
count_stats=dict(Counter(r['countStatus'] for r in records))
per_state={state:{'pointBandRows':sum(r['state']==state for r in records),'occupations':len({r['occupationCode'] for r in records if r['state']==state}),'occupationTotalRows':sum(r['state']==state for r in occupation_totals)} for state in STATES}
app_layout=json.loads((ROOT/'official-app-layout.json').read_text())['qLayout']
metadata={
    'sourceId':SOURCE_ID,'title':f'SkillSelect EOI Data report: {MONTH_ID} Invited status snapshot',
    'url':URL,'authority':'Department of Home Affairs','primaryOriginal':True,
    'retrievedAt':datetime.now(timezone.utc).isoformat(),'appId':APP,'resultsObjectId':'eymDb',
    'snapshotDate':SNAPSHOT,'snapshotMonth':MONTH,'officialReloadTime':app_layout['qLastReloadTime'],
    'granularity':'6-digit ANZSCO occupation × preferred nominated state × visa subclass × published points score',
    'countUnit':'Distinct EOI identifiers in each filtered combination; not unique people',
    'maskRule':'Official Count EOIs master measure fPpzEmW returns <20 for counts 1–19; no estimates',
    'stateMeaning':'Nominated State is the state/territory the intending migrant wishes to be nominated by; not proof of the government that issued an invitation',
    'pointsMeaning':'Reported Score at snapshot may differ from the score when invited, because score may change during Invited or Lodged status',
    'statusMeaning':'INVITED at month end: invitation to apply for a visa has been issued and EOI remains in that status at this snapshot',
    'notAnEventCount':True,'doNotSumMonths':True,'crossStateTotalsNotUnique':True,
    'queryMethod':'Public anonymous Qlik JSON-RPC; unchanged published table; two additional display fields, one state filter; unchanged masking and calculation conditions',
    'rawFiles':files,
}
dataset={
    'id':DATASET_ID,'metric':'eoi_invited_snapshot','title':f'{MONTH_ID} 月末 EOI 持邀快照',
    'asOf':SNAPSHOT,'periodStart':None,'periodEnd':None,'sourceId':SOURCE_ID,
    'stateTotals':state_totals,'occupationTotals':occupation_totals,
    'note':'按 EOI 希望获得提名的州筛选。数量是月末仍处于 INVITED 的 EOI 存量；分数是快照所记录分数，可能已不同于获邀时分数。<20 为官方遮蔽，未估算。不能当作该州本月发出的邀请人数，也不能跨月累加。',
}
payload={'metadata':metadata,'datasets':[dataset],'records':records,'separateAny':{'records':unspecified_records,'stateTotals':unspecified_state_totals,'occupationTotals':unspecified_occupation_totals}}
(ROOT/(f'invited-snapshot-{MONTH_ID}.json' if REQUESTED_MONTH else 'latest-invited-snapshot.json')).write_text(json.dumps(payload,ensure_ascii=False,indent=2))
audit={'primarySource':True,'allEightStatesPresent':True,'rowCount':len(records),'perState':per_state,'countStatuses':count_stats,'maskedRawQNumKinds':sorted(mask_numeric_values),'duplicatePointBandKeys':0,'separateAnyPointRows':len(unspecified_records),'stateTotalsSeparateQuery':True,'occupationTotalsSeparateQuery':True,'noMaskedCountEstimated':True,'noMonthlySum':True,'rawFileHashes':files}
(ROOT/(f'parse-audit-{MONTH_ID}.json' if REQUESTED_MONTH else 'parse-audit.json')).write_text(json.dumps(audit,ensure_ascii=False,indent=2))
print(json.dumps(audit,ensure_ascii=False,indent=2))
