import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const dotnet=process.env.ATLAS_DOTNET??'dotnet';
const dbdir=await mkdtemp(path.join(tmpdir(),'atlas-pg-'));
let db=new PGlite(dbdir);await db.waitReady;
// Npgsql probes this table before migrating. Pre-creating only its empty metadata
// avoids a protocol-recovery limitation in the WASM TCP adapter, not a schema migration.
await db.exec('CREATE TABLE "__EFMigrationsHistory" ("MigrationId" varchar(150) PRIMARY KEY,"ProductVersion" varchar(32) NOT NULL)');
// Npgsql opens unpooled connections for sequential EF queries. Allow the adapter
// to finish a previous TCP close while accepting the next handshake. SQL remains queued.
const socket=new PGLiteSocketServer({db,host:'127.0.0.1',port:55432,maxConnections:16});await socket.start();
const env={...process.env,ATLAS_DB:'Host=127.0.0.1;Port=55432;Database=postgres;Username=postgres;Password=postgres;Pooling=false;Timeout=30;SSL Mode=Disable;GSS Encryption Mode=Disable',ASPNETCORE_URLS:'http://127.0.0.1:5080',DOTNET_CLI_TELEMETRY_OPTOUT:'1',Logging__LogLevel__Default:'Warning'};
let api;let log='';let apiChecks=0;const passed=[];
function run(args){return new Promise((resolve,reject)=>{let out='';const p=spawn(dotnet,args,{cwd:root,env});p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>out+=b);p.on('exit',code=>code===0?resolve(out):reject(new Error(out)));});}
try{
 console.log('Applying EF migration and C# seed on PostgreSQL WASM engine…');console.log(await run(['run','--project','src/Api','--','--seed']));
 console.log('Reapplying identical release to verify idempotency…'); await run(['run','--no-build','--project','src/Api','--','--seed']);
 api=spawn(dotnet,['run','--no-build','--project','src/Api'],{cwd:root,env});api.stdout.on('data',b=>log+=b);api.stderr.on('data',b=>log+=b);
 const base='http://127.0.0.1:5080';
 for(let i=0;i<120;i++){try{if((await fetch(base+'/health/live')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));if(i===119)throw new Error('API did not start '+log);}
 const snapshot={};
 function key(url){const u=new URL(url,'http://local');return u.pathname+'?'+[...u.searchParams].sort(([a,av],[b,bv])=>a.localeCompare(b)||av.localeCompare(bv)).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');}
 async function get(url,status=200){const res=await fetch(base+url);const j=await res.json();assert.equal(res.status,status,JSON.stringify(j));if(status===200&&url.startsWith('/api/'))snapshot[key(url)]=j;return j;}
 async function check(name,fn){await fn();passed.push(name);apiChecks++;console.log('PASS '+name);}
 let officialHistory;
 const manifest=JSON.parse(await readFile(path.join(root,'data/official/history.json'),'utf8'));
 await check('official history import, source membership and idempotent record count',async()=>{
   officialHistory=await get('/api/history?mode=verified_historical');
   assert.equal(officialHistory.records.length,manifest.records.length);
   assert.equal(officialHistory.stats.records,manifest.records.length);
   assert.equal(officialHistory.sources.length,manifest.sources.length);
   assert.equal(officialHistory.coverage.length,8);
   assert.equal(officialHistory.stats.statesWithHistory,8);
   assert.equal(officialHistory.stats.scores,manifest.records.filter(r=>r.points!==null).length);
   assert.equal(officialHistory.stats.invitationCounts,manifest.records.filter(r=>r.countStatus==='published'&&r.invitationCount!==null).length);
   assert(officialHistory.records.every(r=>r.isDemo===false&&officialHistory.sources.some(s=>s.id===r.sourceId)));
 });
 await check('state nominations preserve date, EOI units and historical-index provenance',async()=>{
   assert.equal(officialHistory.nominations.length,16);
   const n=officialHistory.nominations.find(r=>r.state==='NSW'&&r.programYear==='2025-26');
   assert.equal(n.nomination190,2082);assert.equal(n.nomination491,1424);
   assert.equal(n.asOf,'2026-05-31');assert.equal(n.unit,'EOIs');
   assert.equal(n.metric,'state_territory_nominations');assert.equal(n.verificationStatus,'historical_index_only');
   assert(officialHistory.sources.some(s=>s.id===n.sourceId&&s.sha256===n.sourceSha256));
 });
 await check('suppressed state counts remain null; Tasmania current counts remain exact',async()=>{
   const rows=officialHistory.nominations.filter(r=>r.programYear==='2026-27');assert.equal(rows.length,8);
   assert(rows.filter(r=>r.state!=='TAS').every(r=>r.nomination190===null&&r.nomination491===null&&r.countStatus190==='suppressed_below_5'&&r.countStatus491==='suppressed_below_5'));
   const tas=rows.find(r=>r.state==='TAS');assert.equal(tas.nomination190,146);assert.equal(tas.nomination491,23);assert.equal(tas.asOf,'2026-07-31');
 });
 await check('2019 FOI keeps eight-state coverage and invitation stage separate',async()=>{
   const f=officialHistory.records.filter(r=>r.invitationStage==='visa_application_after_nomination');
   assert.equal(f.length,5875);assert.equal(f.reduce((n,r)=>n+r.invitationCount,0),6529);
   assert(f.every(r=>r.roundDate.startsWith('2019-')&&r.countMethod==='derived_from_official_rows'));
   const nsw=f.filter(r=>r.state==='NSW');assert.equal(nsw.length,3416);assert.equal(new Set(nsw.map(r=>r.occupationCode)).size,150);
   const software=nsw.filter(r=>r.occupationCode==='261313');assert.equal(software.length,388);assert.equal(Math.min(...software.map(r=>r.points)),70);assert.equal(software.filter(r=>r.points===70).length,3);
   assert.equal(officialHistory.guides.length,8);
 });
 await check('FOI sources never import overlapping cross-checks or alter point values',async()=>{
   assert(!officialHistory.records.some(r=>r.sourceId==='nsw-vic-foi-fa191200647'));
   const four=officialHistory.records.filter(r=>r.sourceId==='dha-foi-190900418-2019');
   for(const [state,n] of Object.entries({VIC:1549,TAS:558,NT:224,QLD:516}))assert.equal(four.filter(r=>r.state===state).reduce((sum,r)=>sum+r.invitationCount,0),n);
   const regional=officialHistory.records.filter(r=>r.sourceId==='dha-foi-fa191201350');assert.equal(regional.length,266);assert(regional.every(r=>r.visaSubclass==='491'&&r.pointsBasis==='subclass_score_as_published'));
 });
 await check('recent official activity survives database and API without becoming invitations',async()=>{
   const activity=officialHistory.recentActivity;
   assert.deepEqual(activity,manifest.recentActivity);
   assert.equal(activity.records.length,5299);assert.equal(activity.datasets.length,3);
   assert.equal(new Set(activity.records.map(r=>r.state)).size,8);
   assert(activity.records.every(r=>!Object.hasOwn(r,'invitationCount')&&officialHistory.sources.some(s=>s.id===r.sourceId)));
   assert(activity.datasets.filter(d=>d.metric==='eoi_invited_snapshot').every(d=>['2026-06-30','2026-09-30'].includes(d.asOf)));
 });
 await check('EOI and application privacy markers retain their different limits',async()=>{
   const rows=officialHistory.recentActivity.records;
   assert(rows.filter(r=>r.countStatus.startsWith('suppressed')).every(r=>r.count===null));
   assert.equal(rows.filter(r=>r.countStatus==='suppressed_below_5').length,1381);
   assert.equal(rows.filter(r=>r.datasetId==='skillselect-invited-2026-09').length,325);
   const lodged=rows.filter(r=>r.datasetId==='dha-primary-lodged-fy2025-26');
   assert.equal(lodged.length,2165);assert.equal(new Set(lodged.map(r=>r.occupationCode)).size,372);
   assert(lodged.every(r=>r.points===null));assert(!lodged.some(r=>r.occupationCode==='253918'));
 });
 await check('independent occupation and state snapshot totals do not estimate score masks',async()=>{
   const a=officialHistory.recentActivity;
   const june=a.datasets.find(d=>d.asOf==='2026-06-30');
   const teacher=june.occupationTotals.find(r=>r.state==='NSW'&&r.visaSubclass==='190'&&r.occupationCode==='241411');
   assert.equal(teacher.count,57);
   const bands=a.records.filter(r=>r.datasetId===june.id&&r.state==='NSW'&&r.visaSubclass==='190'&&r.occupationCode==='241411');
   assert.equal(bands.find(r=>r.points===85).count,34);assert(bands.some(r=>r.count===null));
   assert.equal(june.stateTotals.find(r=>r.state==='NSW'&&r.visaSubclass==='190').count,815);
   assert.equal(june.stateTotals.find(r=>r.state==='VIC'&&r.visaSubclass==='190').count,977);
   assert.equal(a.datasets.find(d=>d.metric==='visa_lodged_primary').stateTotals,undefined);
 });
 await check('WA Analyst Programmer keeps actual scores, unknown counts and unsplit visas',async()=>{
   const rows=officialHistory.records.filter(r=>r.state==='WA'&&r.occupationCode==='261311');
   assert(rows.some(r=>r.roundMonth==='2025-03'&&r.points===95));
   assert(rows.some(r=>r.roundMonth==='2025-06'&&r.points===105));
   assert(rows.every(r=>r.invitationCount===null&&r.visaSubclass==='combined'));
 });
 await check('ACT unit groups and Tasmania priority scores cannot become EOI thresholds',async()=>{
   const act=officialHistory.records.find(r=>r.state==='ACT'&&r.occupationCode==='2613'&&r.roundDate==='2026-06-11'&&r.visaSubclass==='190'&&r.residence==='Canberra resident');
   assert.equal(act.points,130);assert.equal(act.pointsBasis,'canberra_matrix');assert.equal(act.occupationLevel,'unit_group');assert.equal(act.invitationCount,null);
   const tas=officialHistory.records.find(r=>r.id==='tas-2026-10-08-190-total');
   assert.equal(tas.points,323);assert.equal(tas.invitationCount,37);assert.equal(tas.pointsBasis,'tasmania_priority_score');assert.equal(tas.occupationCode,null);
 });
 await check('SA ICT invitations stay at two-digit group level',async()=>{
   const sa=officialHistory.records.find(r=>r.sourceId==='sa-late-may-2026'&&r.occupationCode==='26'&&r.visaSubclass==='491');
   assert.equal(sa.invitationCount,6);assert.equal(sa.points,null);assert.equal(sa.occupationLevel,'sub_major_group');
   assert(!officialHistory.records.some(r=>r.state==='SA'&&r.occupationLevel==='occupation'&&r.roundDate?.startsWith('2026')));
 });
 await check('source conflicts and ambiguous ACT extraction are preserved',async()=>{
   const wa=officialHistory.records.filter(r=>r.state==='WA'&&r.countStatus==='source_conflict');
   assert.equal(wa.length,2);assert(wa.every(r=>r.invitationCount===null));
   const sa=officialHistory.records.filter(r=>r.sourceId==='sa-may-2026');assert(sa.every(r=>r.countStatus==='source_conflict'));
   const act=officialHistory.records.filter(r=>r.state==='ACT'&&r.pointsStatus==='parse_failed');assert.equal(act.length,4);assert(act.every(r=>r.points===null));
   assert(officialHistory.records.some(r=>r.pointsStatus==='not_considered'&&r.points===null));
 });
 await check('official history rejects demo mode and unknown releases',async()=>{
   await get('/api/history?mode=demo',404);await get('/api/history?datasetVersion=missing',404);
 });
 const verified='mode=verified_historical&programYear=2025-26&visaSubclass=190&sponsorshipType=state&locale=zh';
 const demo='mode=demo&programYear=2025-26&visaSubclass=190&sponsorshipType=state&locale=zh';
 await check('read-only database health',async()=>{const j=await get('/health/ready');assert.equal(j.role,'atlas_reader');assert.equal(j.readOnly,true);});
 let states;await check('16 official allocation cells and 8 jurisdictions',async()=>{states=await get('/api/states?'+verified);assert.equal(states.data.items.length,8);assert.equal(states.data.items.reduce((n,s)=>n+s.allocation190+s.allocation491,0),20350);assert.equal(states.meta.isDemo,false);assert.equal(states.sources[0].publishedAt,null);});
 await check('demo isolation has no copied official allocations',async()=>{const j=await get('/api/states?'+demo);assert(j.meta.isDemo);assert(j.data.items.every(s=>s.allocation190===null));});
 await get('/api/coverage?'+verified);await get('/api/coverage?'+demo);
 for(const q of [verified,demo]){await get('/api/states?'+q.replace('visaSubclass=190','visaSubclass=491'));await get('/api/coverage?'+q.replace('visaSubclass=190','visaSubclass=491'));}
 const overviews={};for(const mode of ['verified_historical','demo'])for(const state of ['WA','NT','SA','QLD','NSW','VIC','TAS','ACT'])for(const visa of ['190','491']){const q=`mode=${mode}&programYear=2025-26&visaSubclass=${visa}&sponsorshipType=state&locale=zh`;overviews[mode+state+visa]=await get(`/api/states/${state}/overview?`+q);await get(`/api/states/${state}/observations?`+q);if(mode==='verified_historical'||state!=='WA'||visa!=='190')await get(`/api/states/${state}/top-occupations?`+q+'&metricType=last_invited_eoi_points&limit=5'+(overviews[mode+state+visa].data.scopes[0]?'&roundId=demo-round-2026-05-20&stream=demo-general&residenceCategory=WA':''));}
 await check('legacy exact-subclass ranking does not invent a WA visa split',async()=>{const j=await get('/api/states/WA/top-occupations?'+verified+'&metricType=last_invited_eoi_points&limit=5');assert.equal(j.data.status,'not_ingested');assert.equal(j.data.items.length,0);});
 await check('round confirmation is mandatory',async()=>{const j=await get('/api/states/WA/top-occupations?'+demo,422);assert.equal(j.code,'SCOPE_CONFIRMATION_REQUIRED');});
 await check('invalid textual limit returns a typed 400',()=>get('/api/states/WA/top-occupations?'+demo+'&limit=five',400));
 const scope='&roundId=demo-round-2026-05-20&stream=demo-general&residenceCategory=WA';
 await check('mixed scope rejected',()=>get('/api/states/WA/top-occupations?'+demo+scope.replace('demo-general','other'),409));
 await check('Top5 stable order, dense ranks and boundary tie',async()=>{const j=await get('/api/states/WA/top-occupations?'+demo+scope+'&metricType=last_invited_eoi_points&limit=5');assert.deepEqual(j.data.items.map(o=>o.code),['333411','334111','331212','233211','261311']);assert.equal(j.data.tieCount,3);assert.deepEqual(j.data.items.map(o=>o.rank),[1,1,2,3,3]);});
 await check('fewer than five observations are not padded',async()=>{const j=await get('/api/states/NSW/top-occupations?'+demo+scope+'&metricType=last_invited_eoi_points&limit=5');assert.equal(j.data.items.length,3);});
 await get('/api/states/WA/top-occupations?'+demo+scope+'&metricType=nomination_invitation_count&limit=5');
 const catalog=await get('/api/occupations/search?'+demo+'&q=工程师');
 // The public API intentionally rejects empty search. Catalog for export uses a short shared query family below.
 let occupations=[];for(const term of ['Engineer','Programmer','Tiler','Plumber','Carpenter']){for(const m of ['demo','verified_historical']){const q=m==='demo'?demo:verified;const j=await get('/api/occupations/search?'+q+'&q='+encodeURIComponent(term));if(m==='demo')occupations.push(...j.data);}}
 occupations=[...new Map(occupations.map(o=>[o.id,o])).values()];
 await check('bilingual aliases and classification version',async()=>{const j=await get('/api/occupations/search?'+verified+'&q='+encodeURIComponent('软件工程师'));assert.equal(j.data[0].code,'261313');assert.equal(j.data[0].version,'2022');});
 const software=occupations.find(o=>o.code==='261313');
 for(const o of occupations)for(const m of ['demo','verified_historical'])for(const state of ['WA','NT','SA','QLD','NSW','VIC','TAS','ACT'])for(const visa of ['190','491']){const q=`mode=${m}&programYear=2025-26&visaSubclass=${visa}&sponsorshipType=state&locale=zh&state=${state}`;await get(`/api/occupations/${o.id}?`+q);await get(`/api/occupations/${o.id}/distribution?`+q);await get(`/api/occupations/${o.id}/annual-trend?`+q+'&metricType=nomination_invitation_count');}
 await check('published release v1 stays 35; v2 corrects to 40',async()=>{const a=await get(`/api/occupations/${software.id}?`+demo+'&state=WA&datasetVersion=demo-v1');const b=await get(`/api/occupations/${software.id}?`+demo+'&state=WA&datasetVersion=demo-v2');assert.equal(a.data.observations.find(f=>f.metricType==='nomination_invitation_count'&&f.eventDate).value,35);assert.equal(b.data.observations.find(f=>f.metricType==='nomination_invitation_count'&&f.eventDate).value,40);});
 await check('complete sample percentage calculated by SQL',async()=>{const j=await get(`/api/occupations/${software.id}/distribution?`+demo+'&state=WA');assert(j.data.chartAllowed);assert.deepEqual(j.data.bins.map(b=>b.percentage),[12,23,40,25]);});
 await check('unknown denominator withholds percentages',async()=>{const o=occupations.find(o=>o.code==='261312');const j=await get(`/api/occupations/${o.id}/distribution?`+demo+'&state=WA');assert.equal(j.data.chartAllowed,false);assert(j.data.bins.every(b=>b.percentage===null));});
 await check('suppressed bins remain null and cannot be inferred',async()=>{const o=occupations.find(o=>o.code==='334111');const j=await get(`/api/occupations/${o.id}/distribution?`+demo+'&state=WA');assert.equal(j.data.chartAllowed,false);assert.equal(j.data.bins[1].count,null);});
 await check('last invited is not a distribution',async()=>{const o=occupations.find(o=>o.code==='333411');const j=await get(`/api/occupations/${o.id}/distribution?`+demo+'&state=WA');assert.equal(j.data.status,'not_applicable');});
 await check('annual SQL flow totals and separate YTD',async()=>{const j=await get(`/api/occupations/${software.id}/annual-trend?`+demo+'&state=WA&metricType=nomination_invitation_count');assert.deepEqual(j.data.items.map(x=>x.value),[210,310,280,62]);assert.deepEqual(j.data.items.map(x=>x.isYtd),[false,false,false,true]);});
 await check('stock metric cannot be summed as an annual flow',()=>get(`/api/occupations/${software.id}/annual-trend?`+demo+'&state=WA&metricType=eoi_stock_count',400));
 await check('invalid consecutive year rejected',()=>get('/api/states?'+verified.replace('2025-26','2025-27'),400));
 await check('family 491 and unrelated visa rejected',async()=>{await get('/api/states?'+verified.replace('state','family'),400);await get('/api/states?'+verified.replace('190','189'),400);});
 await check('dataset mode mismatch is not a fallback',()=>get('/api/states?'+verified+'&datasetVersion=demo-v1',404));
 await check('source is confined to selected release and mode',async()=>{const s=states.sources[0];const j=await get(`/api/sources/${s.sourceId}/versions/${s.sourceVersionId}?`+verified);assert.equal(j.data.hash,'2057c4713e0a18931a4227cad33e848fffbea7d861119f0a895852d10c334d5f');await get(`/api/sources/${s.sourceId}/versions/${s.sourceVersionId}?`+demo,404);});
 for(const s of (await get('/api/states?'+demo)).sources)await get(`/api/sources/${s.sourceId}/versions/${s.sourceVersionId}?`+demo);
 for(const q of [verified,demo])for(const s of (await get('/api/states?'+q)).sources)await get(`/api/sources/${s.sourceId}/versions/${s.sourceVersionId}?`+q.replace('visaSubclass=190','visaSubclass=491'));
 async function post(url,body,status=200){const r=await fetch(base+url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
 const posts={};for(const mode of ['demo','verified_historical'])for(const question of ['WA 190 2025-26 软件工程师的历史记录','WA 190 2025-26 配额是多少']){const a=await post('/api/query/interpret',{text:question,mode,locale:'zh'});posts[JSON.stringify({text:question,mode,locale:'zh'})]=a;}
 await check('ambiguous occupation requires clarification',async()=>{const j=await post('/api/query/interpret',{text:'WA 190 2025-26 工程师',mode:'demo',locale:'zh'});assert.equal(j.data.occupationCandidates.length,2);assert(j.data.needsClarification);});
 await check('WA and ACT are not extracted from software/contract',async()=>{const j=await post('/api/query/interpret',{text:'software contract engineer 190 2025-26',mode:'demo',locale:'en'});assert.equal(j.data.stateCandidates.length,0);});
 const answers={};for(const mode of ['demo','verified_historical'])for(const o of [null,software.id]){const body={question:o?'WA 190 2025-26 软件工程师的历史记录':'WA 190 2025-26 配额是多少',state:'WA',visaSubclass:'190',programYear:'2025-26',mode,locale:'zh',occupationId:o,datasetVersion:null,confirmed:true};answers[JSON.stringify(body)]=await post('/api/answers',body);}
 await check('answer requires explicit scope confirmation',()=>post('/api/answers',{question:'test',state:'WA',visaSubclass:'190',programYear:'2025-26',mode:'demo',locale:'zh'},422));
 await check('template answers work without external model credentials',async()=>{assert(Object.values(answers).every(a=>a.data.answerMode==='template'));assert(Object.values(answers).find(a=>!a.meta.isDemo&&a.data.facts.length===0));});
 await check('unmapped JSON is rejected rather than ignored',()=>post('/api/query/interpret',{text:'test',mode:'demo',locale:'zh',sql:'DELETE FROM occupation'},400));
 const openapi=await get('/openapi/v1.json');assert(openapi.paths['/api/states']);
 await check('question rate limit yields 429 and Retry-After',async()=>{let limited=false;for(let i=0;i<25;i++){const r=await fetch(base+'/api/query/interpret',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'test',mode:'demo',locale:'zh'})});if(r.status===429){assert.equal(r.headers.get('Retry-After'),'60');assert.equal((await r.json()).code,'RATE_LIMITED');limited=true;break;}assert.equal(r.status,200);}assert(limited);});
 await db.exec('RESET ROLE; SET default_transaction_read_only=off');
 await db.exec('REVOKE SELECT ON occupation FROM atlas_reader');
 await check('database access failure becomes 503 ProblemDetails',async()=>{const j=await get('/api/occupations/search?'+demo+'&q=Engineer',503);assert.equal(j.code,'SERVICE_UNAVAILABLE');assert(j.traceId);});
 await mkdir(path.join(root,'artifacts'),{recursive:true});await writeFile(path.join(root,'artifacts/openapi.json'),JSON.stringify(openapi,null,2));await writeFile(path.join(root,'artifacts/snapshot.json'),JSON.stringify({get:Object.fromEntries(Object.entries(snapshot).filter(([k])=>!k.startsWith("/api/history?"))),interpret:posts,answers,occupations,officialHistory},null,2));
 api.kill('SIGTERM');await new Promise(r=>api.once('exit',r));api=null;await socket.stop();await db.close();db=new PGlite(dbdir);await db.waitReady;await db.exec('GRANT SELECT ON occupation TO atlas_reader');
 const sqlTests=(await import('./sql-contract.mjs')).default;const sqlChecks=await sqlTests(db);
 let officialSqlChecks=0;
 async function officialSql(name,fn){await fn();officialSqlChecks++;console.log('PASS '+name);}
 await officialSql('published official rows cannot be modified',async()=>{await assert.rejects(db.exec("UPDATE official_history SET payload=payload||'{\"points\":1}'::jsonb WHERE id='act-2026-06-11-1331-0'"));});
 await officialSql('published official sources cannot be deleted',async()=>{await assert.rejects(db.exec("DELETE FROM official_source WHERE id='act-rankings'"));});
 await officialSql('published official release cannot be changed',async()=>{await assert.rejects(db.exec("UPDATE official_release SET status='draft'"));});
 await officialSql('reader can select official evidence but cannot write',async()=>{
  const r=await db.query("SELECT has_table_privilege('atlas_reader','official_history','SELECT') AS readable,has_table_privilege('atlas_reader','official_history','UPDATE') AS writable");
  assert.equal(r.rows[0].readable,true);assert.equal(r.rows[0].writable,false);
 });
 const report={date:new Date().toISOString(),engine:'PostgreSQL 18.3 via PGlite 0.5.8; EF migration and C# seed executed through TCP adapter',apiChecks,sqlChecks,officialSqlChecks,officialHistory:{records:officialHistory.stats.records,sources:officialHistory.stats.sources},passed,limitations:['Native PostgreSQL/Docker run not performed','Browser visual QA not performed','No external deployment or Gemini integration']};await writeFile(path.join(root,'artifacts/verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){console.error(log);throw e;}finally{api?.kill('SIGTERM');try{await socket.stop();}catch{}await db.close();}
