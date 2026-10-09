import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'data/demo'
root.mkdir(parents=True,exist_ok=True)
rows=[('261313','Software Engineer','软件工程师',75,35),('261312','Developer Programmer','开发程序员',80,35),('261311','Analyst Programmer','程序分析员',75,22),('333411','Wall and Floor Tiler','瓷砖工',65,None),('334111','Plumber (General)','水管工',65,18),('331212','Carpenter','木工',70,12),('233211','Civil Engineer','土木工程师',75,28)]
for v in [1,2]:
 data={'isDemo':True,'notice':'Entire fixture is synthetic. No official occupation invitations or score distributions are represented.','version':v,'occupations':[dict(zip(['code','title','titleZh','points','count'],r)) for r in rows],'round':{'state':'WA','visa':'190','date':'2026-05-20','eoiEffectiveAt':'2026-04-20T08:00:00Z'},'annual':{'2023-24':210,'2024-25':310,'2025-26':280,'2026-27YTD':62},'distributions':{'261313':{'cohort':'published_sample','denominator':100,'bins':[[65,12],[70,23],[75,40],[80,25]]},'261312':{'denominator':None,'bins':[[75,8]]},'334111':{'denominator':None,'bins':[[65,12],[70,None]]},'333411':{'cohort':'last_invited','denominator':None,'bins':[]}},'additionalStateScores':{'NSW':[80,85,90],'VIC':[80,85,90]}}
 if v==2:data['occupations'][0]['count']=40;data['correction']='Software nomination count corrected from 35 to 40; release v1 remains unchanged.'
 (root/f'fixture-v{v}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
