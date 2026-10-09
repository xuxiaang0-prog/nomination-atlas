import assert from 'node:assert/strict';
export default async function tests(db){
 let n=0;
 async function blocked(name,sql){await db.exec('BEGIN');try{await assert.rejects(()=>db.exec(sql));console.log('PASS SQL '+name);n++;}finally{await db.exec('ROLLBACK');}}
 async function good(name,sql,expected){const result=await db.query(sql);assert.equal(result.rows[0].v,expected);console.log('PASS SQL '+name);n++;}
 const published="(SELECT observation_id FROM dataset_observation WHERE version='demo-v1' LIMIT 1)";
 await blocked('published fact update',`UPDATE observation_revision SET value=999 WHERE id=${published}`);
 await blocked('published fact deletion',`DELETE FROM observation_revision WHERE id=${published}`);
 await blocked('published release membership insertion',`INSERT INTO dataset_observation SELECT 'demo-v1',id FROM observation_revision WHERE id NOT IN(SELECT observation_id FROM dataset_observation WHERE version='demo-v1') LIMIT 1`);
 await blocked('published release membership deletion',`DELETE FROM dataset_observation WHERE version='demo-v1'`);
 await blocked('published membership cannot move into draft',`INSERT INTO dataset_version VALUES('move-draft','demo','draft',now(),NULL,'test');UPDATE dataset_observation SET version='move-draft' WHERE version='demo-v1'`);
 await blocked('published evidence cannot move into draft',`INSERT INTO dataset_version VALUES('move-draft','demo','draft',now(),NULL,'test');UPDATE dataset_source SET version='move-draft' WHERE version='demo-v1'`);
 await blocked('published distribution cannot move into draft',`INSERT INTO dataset_version VALUES('move-draft','demo','draft',now(),NULL,'test');INSERT INTO dataset_source SELECT 'move-draft',source_version_id FROM dataset_source WHERE version='demo-v1';UPDATE distribution SET version='move-draft' WHERE version='demo-v1'`);
 await blocked('published source modification',`UPDATE source_version SET title='altered' WHERE is_demo=false`);
 await blocked('published evidence deletion',`DELETE FROM dataset_source WHERE version='demo-v1'`);
 await blocked('published scope modification',`UPDATE program_scope SET stream='different' WHERE id=(SELECT scope_id FROM observation_revision WHERE id=${published})`);
 await blocked('published occupation label modification',`UPDATE occupation SET version='new' WHERE code='261313'`);
 await blocked('published distribution modification',`UPDATE distribution SET denominator=101 WHERE version='demo-v1'`);
 await blocked('published distribution bin modification',`UPDATE distribution_bin SET count=999 WHERE distribution_id IN(SELECT id FROM distribution WHERE version='demo-v1')`);
 await blocked('release metadata frozen',`UPDATE dataset_version SET note='rewrite history' WHERE key='demo-v1'`);
 await blocked('publication audit is append-only',`UPDATE publication_audit SET actor='rewritten' WHERE version='demo-v1'`);
 await blocked('retraction cannot become published',`UPDATE dataset_version SET status='retracted' WHERE key='demo-v1';UPDATE dataset_version SET status='published' WHERE key='demo-v1'`);
 await blocked('mode mismatch on draft membership',`INSERT INTO dataset_version VALUES('test-draft','verified_historical','draft',now(),NULL,'test');INSERT INTO dataset_source SELECT 'test-draft',id FROM source_version WHERE is_demo=true LIMIT 1`);
 await blocked('missing value is not zero',`INSERT INTO observation_revision SELECT 'bad-null','new-null',1,scope_id,NULL,'nomination_allocation',0,'count','not_published','missing',NULL,NULL,NULL,NULL,NULL,source_version_id,'bad-null',is_demo FROM observation_revision LIMIT 1`);
 await blocked('count must be integer',`INSERT INTO observation_revision SELECT 'bad-fraction','new-fraction',1,scope_id,NULL,'nomination_allocation',0.5,'count','available',NULL,NULL,NULL,NULL,NULL,NULL,source_version_id,'bad-fraction',is_demo FROM observation_revision LIMIT 1`);
 await blocked('nullable unique scope does not allow duplicates',`INSERT INTO observation_revision SELECT 'duplicate','new-canonical',1,scope_id,occupation_id,metric_type,value,unit,status,null_reason,event_date,period_start,period_end,as_of_date,eoi_effective_at,source_version_id,locator,is_demo FROM observation_revision WHERE occupation_id IS NULL LIMIT 1`);
 await blocked('read-only role rejects writes',`SET ROLE atlas_reader;SET LOCAL transaction_read_only=on;DELETE FROM observation_revision`);
 await db.exec('RESET ROLE;SET default_transaction_read_only=off');
 await good('official membership exactly 16',`SELECT count(*)::int v FROM dataset_observation WHERE version='verified-2025-26-v1'`,16);
 await good('old revision unchanged',`SELECT f.value::int v FROM observation_revision f JOIN dataset_observation m ON m.observation_id=f.id JOIN occupation o ON o.id=f.occupation_id WHERE m.version='demo-v1' AND o.code='261313' AND f.metric_type='nomination_invitation_count' AND f.event_date IS NOT NULL`,35);
 await good('new revision selected',`SELECT f.value::int v FROM observation_revision f JOIN dataset_observation m ON m.observation_id=f.id JOIN occupation o ON o.id=f.occupation_id WHERE m.version='demo-v2' AND o.code='261313' AND f.metric_type='nomination_invitation_count' AND f.event_date IS NOT NULL`,40);
 return n;
}
