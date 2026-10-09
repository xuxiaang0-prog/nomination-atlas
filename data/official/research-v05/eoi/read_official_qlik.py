"""Read the public anonymous SkillSelect dashboard, without account credentials.

Only public Qlik app metadata and data are read. Session objects are transient.
No reload, app update, publishing or persistent mutation is performed.
"""
import asyncio
import http.cookiejar
import json
from pathlib import Path
import sys
import urllib.request

import websockets

ROOT = Path(__file__).resolve().parent
BASE = 'https://api.dynamic.reports.employment.gov.au'
APP = 'aaac76b5-ad30-477e-9ca0-472f8ab57fc8'
ENTRY = BASE + '/anonap/extensions/hSKLS02_SkillSelect_EOI_Data/hSKLS02_SkillSelect_EOI_Data.html'
AUDIT = []

def save(name, data):
    (ROOT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2))

async def run():
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    response = opener.open(urllib.request.Request(ENTRY, headers={'User-Agent': 'Mozilla/5.0'}), timeout=25)
    response.read()
    # Use only the anonymous cookies issued by the public entry point.
    cookie = '; '.join(c.name + '=' + c.value for c in jar)
    AUDIT.append({'step': 'anonymous_entry', 'httpStatus': response.status, 'cookieCount': len(jar)})
    uri = 'wss://api.dynamic.reports.employment.gov.au/anonap/app/' + APP
    headers = {'Cookie': cookie} if cookie else {}
    async with websockets.connect(uri, origin=BASE, additional_headers=headers, open_timeout=25, ping_interval=None, max_size=30_000_000) as ws:
        seq = 0
        async def rpc(handle, method, params):
            nonlocal seq
            seq += 1
            message = {'jsonrpc':'2.0','id':seq,'handle':handle,'method':method,'params':params}
            await ws.send(json.dumps(message))
            while True:
                reply = json.loads(await asyncio.wait_for(ws.recv(), 30))
                if reply.get('id') == seq:
                    AUDIT.append({'step': method, 'handle': handle, 'error': reply.get('error')})
                    if 'error' in reply:
                        raise RuntimeError(json.dumps(reply['error']))
                    return reply['result']
        result = await rpc(-1, 'OpenDoc', [APP])
        handle = result['qReturn']['qHandle']
        layout = await rpc(handle, 'GetAppLayout', [])
        save('official-app-layout.json', layout)
        print(json.dumps({'success': True, 'appTitle': layout.get('qLayout',{}).get('qTitle'), 'reloadTime': layout.get('qLayout',{}).get('qLastReloadTime')}), flush=True)
        if '--snapshot' in sys.argv:
            await read_snapshot(rpc, handle)
            save('official-snapshot-query-audit.json', AUDIT)
            return
        # Ask for the documented public field list, to identify the dashboard dimensions.
        obj = await rpc(handle, 'CreateSessionObject', [{'qInfo': {'qType':'FieldList'}, 'qFieldListDef': {'qShowSystem': False, 'qShowHidden': False, 'qShowDerivedFields': False}}])
        fields = await rpc(obj['qReturn']['qHandle'], 'GetLayout', [])
        save('official-field-list.json', fields)
        print(json.dumps({'fields': [v.get('qName') for v in fields.get('qLayout',{}).get('qFieldList',{}).get('qItems',[])]}), flush=True)
        sheet_ids = {
            'overview':'ef6d431d-5689-4883-a3a8-860c7a258923',
            'parameters':'799018bf-5805-4685-8f99-2af996e08197',
            'results':'1fbfd90f-e36c-44b9-a078-a7c78a46792c',
            'help':'d8e3c4e6-6e84-42d2-bf62-82a2bab79d63',
        }
        seen = set()
        for name, sheet_id in sheet_ids.items():
            sheet = await rpc(handle, 'GetObject', [sheet_id])
            shandle = sheet['qReturn']['qHandle']
            props = await rpc(shandle, 'GetProperties', [])
            slayout = await rpc(shandle, 'GetLayout', [])
            save('official-sheet-' + name + '-properties.json', props)
            save('official-sheet-' + name + '-layout.json', slayout)
            cells = props.get('qProp',{}).get('cells',[])
            print(json.dumps({'sheet':name,'objects':[(c.get('name'),c.get('type')) for c in cells]}), flush=True)
            for cell in cells:
                oid = cell.get('name')
                if not oid or oid in seen:
                    continue
                seen.add(oid)
                child = await rpc(handle, 'GetObject', [oid])
                chandle = child['qReturn']['qHandle']
                cprops = await rpc(chandle, 'GetProperties', [])
                clayout = await rpc(chandle, 'GetLayout', [])
                save('official-object-' + oid + '-properties.json', cprops)
                save('official-object-' + oid + '-layout.json', clayout)
        save('official-engine-audit.json', AUDIT)

async def read_snapshot(rpc, handle):
    """Use the unchanged published results table and its masking measure.

    Session selections and column toggles are the same actions as the public UI.
    No calculation condition, field limit, measure or persistent app is edited.
    """
    fields = {}
    field_values = {}
    for field in ['As At Month','Visa Type','EOI Status','Nominated State']:
        obj = await rpc(handle, 'CreateSessionObject', [{'qInfo':{'qType':'ListObject'}, 'qListObjectDef':{'qDef':{'qFieldDefs':[field]}, 'qInitialDataFetch':[{'qTop':0,'qLeft':0,'qHeight':1000,'qWidth':1}]}}])
        lo = await rpc(obj['qReturn']['qHandle'], 'GetLayout', [])
        save('official-values-' + field.replace(' ','-') + '.json', lo)
        field_values[field] = [row[0] for row in lo['qLayout']['qListObject']['qDataPages'][0]['qMatrix']]
        fh = await rpc(handle, 'GetField', [field])
        fields[field] = fh['qReturn']['qHandle']
    print(json.dumps({'fieldValues':{k:[v['qText'] for v in vals] for k,vals in field_values.items()}},ensure_ascii=False),flush=True)
    # Read the official small-count measure metadata, without changing it.
    mh = await rpc(handle, 'GetMeasure', ['fPpzEmW'])
    measure = await rpc(mh['qReturn']['qHandle'], 'GetProperties', [])
    save('official-count-measure.json', measure)
    variable_names = ['vShowSubmittedOn','vShowOccupationGroups','vShowOccupations','vShowPoints','vShowPartnerSkillsScore','vShowEnglishLanguageScore','vShowAustralianStudy','vShowRegionalStudy','vShowSpecialistEducation','vShowEOINomState','vShowEduCommLanguageQual','vShowEmpProfessionalYear','vSelectionsLimit','vFiltersCounter','vSelectionsCounter']
    variables = {}
    for name in variable_names:
        vr = await rpc(handle,'GetVariableByName',[name])
        vh = vr['qReturn']['qHandle']
        prop = await rpc(vh,'GetProperties',[])
        variables[name] = {'handle':vh,'properties':prop}
    save('official-variable-definitions.json', variables)
    async def select_text(field, text):
        result = await rpc(fields[field], 'SelectValues', [[{'qText':text}], False, False])
        if not result.get('qReturn'):
            raise RuntimeError('Public field selection failed: ' + field + ' = ' + text)
    requested_month = next((a.split('=',1)[1] for a in sys.argv if a.startswith('--month=')), None)
    month = next((v for v in field_values['As At Month'] if v['qText']==requested_month),None) if requested_month else max(field_values['As At Month'], key=lambda v:v.get('qNum',float('-inf')))
    if month is None:
        raise RuntimeError('Requested month unavailable in official field list')
    prefix = 'official-invited-' + (month['qText'][3:] + '-' + month['qText'][:2] + '-' if requested_month else '')
    await rpc(fields['As At Month'],'SelectValues',[[{'qNumber':month['qNum'],'qIsNumeric':True}],False,False])
    invited = next(v['qText'] for v in field_values['EOI Status'] if v['qText'].upper()=='INVITED')
    await select_text('EOI Status',invited)
    visas = [v['qText'] for v in field_values['Visa Type'] if v['qText'].startswith(('190','491SNR'))]
    await rpc(fields['Visa Type'],'SelectValues',[[{'qText':v} for v in visas],False,False])
    table = await rpc(handle,'GetObject',['eymDb'])
    th = table['qReturn']['qHandle']
    # Column toggles are transient per-session variables exposed in the public dashboard.
    for name,v in variables.items():
        if name.startswith('vShow'):
            await rpc(v['handle'],'SetStringValue',['N'])
    async def capture(name):
        if (ROOT / (name+'-data.json')).exists() and (ROOT / (name+'-layout.json')).exists():
            print(json.dumps({'capture':name,'cachedPrimaryCapture':True}),flush=True)
            return
        layout = await rpc(th,'GetLayout',[])
        cube = layout['qLayout']['qHyperCube']
        if cube.get('qError',{}).get('qErrorCode') or cube.get('qCalcCondMsg'):
            save(name+'-layout.json',layout)
            raise RuntimeError('Official published table calculation condition blocked query: ' + json.dumps(cube.get('qError')) + ' ' + cube.get('qCalcCondMsg',''))
        rows = cube['qSize']['qcy']; width = cube['qSize']['qcx']; step = max(1,10000//max(width,1))
        pages=[]
        for top in range(0,rows,step):
            result=await rpc(th,'GetHyperCubeData',['/qHyperCubeDef',[{'qTop':top,'qLeft':0,'qHeight':min(step,rows-top),'qWidth':width}]])
            pages.extend(result['qDataPages'])
        save(name+'-layout.json',layout)
        save(name+'-data.json',{'qDataPages':pages})
        print(json.dumps({'capture':name,'rows':rows,'columns':width,'snapshot':month['qText']}),flush=True)
    # One extra display dimension for state totals, within the official 2-field limit.
    await rpc(variables['vShowEOINomState']['handle'],'SetStringValue',['Y'])
    await capture(prefix+'state-totals')
    # Occupation totals are queried separately; masked point cells must not be summed.
    await rpc(variables['vShowOccupations']['handle'],'SetStringValue',['Y'])
    await capture(prefix+'occupation-totals')
    await rpc(variables['vShowEOINomState']['handle'],'SetStringValue',['N'])
    await rpc(variables['vShowPoints']['handle'],'SetStringValue',['Y'])
    # Two display fields (occupation, score) and one state filter obey original limits.
    for state in field_values['Nominated State']:
        if state['qText'] in {'NSW','VIC','QLD','SA','WA','TAS','NT','ACT','ANY'}:
            await select_text('Nominated State',state['qText'])
            await capture(prefix+state['qText'])
    save(prefix+'selections.json',{'snapshot':month,'status':invited,'visas':visas,'stateMeaning':'State or territory the intending migrant wishes to be nominated by','displayFields':['Occupation','Score'],'maxExtraDisplayFields':2,'maxExtraSelectionFields':2})

if __name__ == '__main__':
    try:
        asyncio.run(run())
    except Exception as exc:
        AUDIT.append({'step': 'failure', 'exceptionType': type(exc).__name__, 'error': str(exc)})
        save('official-snapshot-query-failure.json' if '--snapshot' in sys.argv else 'official-engine-audit.json', AUDIT)
        print(json.dumps({'success':False,'error':str(exc)}))
