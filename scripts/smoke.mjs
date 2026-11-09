import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {seed} from './seed.mjs';
import {run,resolve,commands,reads,entities,rules} from './answers.mjs';
import {parseCsv} from './lib/csv.mjs';
import {page,table} from './lib/render.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'security-answers-test-'));
process.env.DATA_DIR=path.join(tmp,'db');process.env.OUTPUT_DIR=tmp;
// A test never reads the normal DATABASE_URL, including one in a local env file.
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'';
let db;const exercised=new Set();let checks=0;
const check=(v,m)=>{assert.ok(v,m);checks++;};
const call=async(c,o={},a=[])=>{exercised.add(c);return run(db,c,o,a);};
const fail=async(fn,re)=>{await assert.rejects(fn,re);checks++;};
const today=new Date().toISOString().slice(0,10);
const future=new Date(Date.now()+86400000*100).toISOString().slice(0,10);
const past=new Date(Date.now()-86400000).toISOString().slice(0,10);
let schema;
try{
 db=await getDb();if(db.mode==='postgres'){schema='test_'+Date.now();await db.exec(`create schema ${schema}; set search_path to ${schema}`);}
 await migrate(db);check((await migrate(db)).ran.length===0,'repeat migrations');await seed(db);await seed(db);
 check((await call('list',{kind:'answers'})).length===3,'idempotent seed');
 for(const c of Object.keys(reads)){const rows=await call(c);check(Array.isArray(rows),c);}
 check((await call('help')).length===commands.length,'help covers CLI');
 check((await call('weekly-review')).intake.length===3,'three-source weekly review');
 const findings=await call('compliance');for(const rule of Object.keys(rules))check(findings.some(f=>f.rule===rule),rule+' triggered');
 const [shown]=await call('show',{kind:'answers',ref:'an-access'});check(shown.code==='AN-ACCESS','case insensitive code');
 check((await resolve(db,'answers',shown.id.slice(0,8))).id===shown.id,'partial UUID');
 check((await resolve(db,'accounts','kauri systems')).code==='AC-KAURI','name lookup');
 await fail(()=>resolve(db,'questionnaires','rimu'),/Ambiguous.*SQ-EMPTY.*SQ-RIMU/);
 await call('log',{kind:'answers',ref:'AN-ACCESS',actor:'Reviewer',note:'Confirmed quarter schedule'});
 await call('add',{kind:'accounts',code:'AC-TEST',name:'Test account',owner:'Reviewer',actor:'Reviewer'});
 await call('update',{kind:'accounts',ref:'AC-TEST',owner:'New reviewer',actor:'Reviewer'});
 // Missing actor must never write.
 await fail(()=>call('add',{kind:'accounts',code:'AC-BAD',name:'Bad',owner:'X'}),/actor/);
 await fail(()=>call('update',{kind:'accounts',ref:'AC-TEST',actor:'Reviewer',retention_review_on:'2026-02-30'}),/Invalid ISO/);
 await fail(()=>call('update',{kind:'accounts',ref:'AC-TEST',actor:'Reviewer',personal_data:'perhaps'}),/boolean/);
 await fail(()=>call('update',{kind:'answers',ref:'AN-ACCESS',actor:'Reviewer',status:'approved'}),/Unknown/);
 await fail(()=>call('approve-answer',{ref:'AN-BACKUP',actor:'Reviewer',on:today}),/Current reviewed evidence/);
 await fail(()=>call('approve-answer',{ref:'AN-ACCESS',actor:'Reviewer',on:future}),/future/);
 await call('approve-answer',{ref:'AN-ACCESS',actor:'Reviewer',on:today});
 await call('use-answer',{ref:'RS-K3',answer:'AN-ACCESS',actor:'Reviewer'});
 await call('approve-response',{ref:'RS-K3',actor:'Reviewer',on:today});
 check((await call('suggest',{ref:'RS-R1'}))[0].code==='AN-ACCESS','exact-match candidate');
 check((await call('suggest',{ref:'RS-K2'})).length===0,'stale answer never suggested');
 await fail(()=>call('handover',{ref:'SQ-KAURI'}),/Handover blocked/);
 await fail(()=>call('handover',{ref:'SQ-EMPTY'}),/Handover blocked/);
 const [handover]=await call('handover',{ref:'SQ-RIMU'});check(fs.existsSync(handover.file),'ready draft generated');
 await call('update',{kind:'evidence',ref:'EV-ACCESS',actor:'Reviewer',version:'4'});
 await fail(()=>call('handover',{ref:'SQ-RIMU'}),/blocked/);
 check((await call('answer-refresh')).find(x=>x.code==='AN-ACCESS').currency==='evidence changed','evidence invalidates answer');
 await call('approve-answer',{ref:'AN-ACCESS',actor:'Reviewer',on:today});
 await call('update',{kind:'answers',ref:'AN-ACCESS',actor:'Reviewer',answer:'Access rights are reviewed every quarter by the service owner.'});
 check((await resolve(db,'answers','AN-ACCESS')).status==='draft','answer edits clear approval');
 await call('approve-answer',{ref:'AN-ACCESS',actor:'Reviewer',on:today});
 await fail(()=>call('approve-response',{ref:'RS-R1',actor:'Reviewer',on:today}),/current approved answer/);
 await fail(()=>call('handover',{ref:'SQ-RIMU'}),/blocked/);
 await call('use-answer',{ref:'RS-R1',answer:'AN-ACCESS',actor:'Reviewer'});
 await call('approve-response',{ref:'RS-R1',actor:'Reviewer',on:today});await call('handover',{ref:'SQ-RIMU'});
 await call('update',{kind:'evidence',ref:'EV-ACCESS',actor:'Reviewer',expires_on:past});
 await fail(()=>call('handover',{ref:'SQ-RIMU'}),/blocked/);
 await call('update',{kind:'evidence',ref:'EV-ACCESS',actor:'Reviewer',expires_on:future});
 await call('approve-answer',{ref:'AN-ACCESS',actor:'Reviewer',on:today});
 await call('update',{kind:'responses',ref:'RS-R1',actor:'Reviewer',answer_text:'Different wording'});
 check((await resolve(db,'responses','RS-R1')).status==='draft','response edits clear approval');
 await fail(()=>call('approve-response',{ref:'RS-R1',actor:'Reviewer',on:today}),/current approved answer/);
 // Close every demo finding by actually fixing its underlying records.
 await call('update',{kind:'answers',ref:'AN-BACKUP',actor:'Reviewer',review_due_on:future});
 for(const code of ['EV-BACKUP','EV-NEW'])await call('update',{kind:'evidence',ref:code,actor:'Reviewer',reviewed_on:today,expires_on:future});
 for(const code of ['AN-BACKUP','AN-INCIDENT'])await call('approve-answer',{ref:code,actor:'Reviewer',on:today});
 for(const code of ['RS-K1','RS-K3','RS-R1']){await call('use-answer',{ref:code,answer:'AN-ACCESS',actor:'Reviewer'});await call('approve-response',{ref:code,actor:'Reviewer',on:today});}
 await call('use-answer',{ref:'RS-K2',answer:'AN-BACKUP',actor:'Reviewer'});await call('approve-response',{ref:'RS-K2',actor:'Reviewer',on:today});
 await call('update',{kind:'accounts',ref:'AC-KAURI',actor:'Reviewer',retention_review_on:future});
 await call('update',{kind:'questionnaires',ref:'SQ-KAURI',actor:'Reviewer',due_on:future});
 await call('update',{kind:'questionnaires',ref:'SQ-EMPTY',actor:'Reviewer',status:'closed'});
 check((await call('compliance')).length===0,'all finding rules clear from corrected records');
 const importFile=path.join(tmp,'sample.csv'),mapFile=path.join(tmp,'map.json');
 fs.writeFileSync(importFile,'Ref,Prompt,Response,Extra\r\nI-1,"Question, one","Line 1\nLine 2",keep\r\nI-2,Question two,Yes,retain\r\n');
 fs.writeFileSync(mapFile,JSON.stringify({code:'Ref',question:'Prompt',answer_text:'Response'}));
 const opts={file:importFile,map:mapFile,questionnaire:'SQ-KAURI',owner:'Reviewer',actor:'Reviewer'};
 const before=(await call('list',{kind:'responses'})).length;
 await call('import',{...opts,dry_run:true},['1up']);check((await call('list',{kind:'responses'})).length===before,'dry run rolls back');
 check((await call('import',opts,['1up']))[0].added===2,'mapped source import');
 check((await call('import',opts,['1up']))[0].unchanged===2,'idempotent import');
 check((await resolve(db,'responses','I-1')).status==='draft','import never trusts old approval');
 check((await call('activity')).some(x=>x.action==='import-source'&&x.details.row.Extra==='keep'),'unmapped source preserved');
 fs.writeFileSync(importFile,'Ref,Prompt,Response,Extra\nI-3,New,Yes,x\nI-1,Conflicting,No,x\n');
 await fail(()=>call('import',opts,['1up']),/Conflicting/);await fail(()=>resolve(db,'responses','I-3'),/No responses/);
 fs.writeFileSync(importFile,'Ref,Prompt,Response,Extra\nI-4,Q,A,x\nI-4,Q,A,x\n');await fail(()=>call('import',opts,['1up']),/Duplicate/);
 fs.writeFileSync(importFile,'Question,Answer\nOriginal question,Original answer\n');
 check((await call('import',{...opts,map:undefined},['1up']))[0].added===1,'default conventional headers');
 await fail(()=>call('import',{...opts,dry_run:'false'},['1up']),/without a value/);
 assert.throws(()=>parseCsv('a,a\n1,2'),/unique/);assert.throws(()=>parseCsv('a,b\n"bad,2'),/unclosed/);assert.throws(()=>parseCsv('a,b\n1'),/expected/);checks+=3;
 check(parseCsv('\ufeffA,B\r\n"a""b",c\r\n')[0].A==='a"b','BOM CRLF and quotes');
 const [backup]=await call('export',{dir:path.join(tmp,'exports')});const data=JSON.parse(fs.readFileSync(backup.file));check(data.activity.length>0&&data.responses.length>4,'full backup includes history');
 for(const kind of Object.keys(entities)){const [out]=await call('export',{dir:path.join(tmp,'csv'),kind});check(parseCsv(fs.readFileSync(out.file,'utf8')).length>0,'CSV '+kind);}
 for(const c of ['draft-response-pack','draft-review-request']){const [out]=await call(c,{ref:'SQ-KAURI'});const html=fs.readFileSync(out.file,'utf8');check(html.includes('Nothing has been sent')&&html.includes('DRAFT'),c);}
 check(!table([{x:'<script>alert(1)</script>'}]).includes('<script>'),'HTML escaping');
 check(page({title:'Test',brand:{business_name:'Custom Brand',primary:'#6654f5',accent:'#ca5a8b',ink:'#0b0c18',paper:'#ffffff',footer_line:'Internal'}}).includes('Custom Brand'),'custom brand');
 check(commands.every(c=>exercised.has(c)),'every CLI command exercised');
 await db.close();db=null;
 const env={...process.env};if(schema)env.PGOPTIONS=`-c search_path=${schema}`;
 for(const script of ['view.mjs','docs.mjs']){const res=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts',script)],{cwd:REPO_ROOT,env,encoding:'utf8'});assert.equal(res.status,0,res.stderr);checks++;}
 const cli=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts/answers.mjs'),'intake-review','--json'],{cwd:REPO_ROOT,env,encoding:'utf8'});assert.equal(cli.status,0,cli.stderr);check(Array.isArray(JSON.parse(cli.stdout)),'CLI JSON');
 const ambiguous=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts/answers.mjs'),'show','--kind=questionnaires','--ref=rimu'],{cwd:REPO_ROOT,env,encoding:'utf8'});assert.equal(ambiguous.status,1);check(ambiguous.stderr.includes('Ambiguous'),'CLI ambiguity exits 1');
 const html=fs.readFileSync(path.join(tmp,'views/week.html'),'utf8');check(html.includes('Security review desk')&&html.includes('<table'),'view renderer');
 console.log(`PASS: ${checks} checks; ${commands.length} CLI commands; ${Object.keys(rules).length} rules; ${process.platform}`);
}finally{if(db)await db.close();if(schema){const cleanup=await getDb();try{await cleanup.exec(`drop schema ${schema} cascade`);}finally{await cleanup.close();}}fs.rmSync(tmp,{recursive:true,force:true});}
