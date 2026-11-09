#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv} from './lib/csv.mjs';
import {table} from './lib/format.mjs';
import {page,table as htmlTable,writeOut} from './lib/render.mjs';
export const entities=JSON.parse(fs.readFileSync(path.join(REPO_ROOT,'entities.json'),'utf8'));
export const reads={
 'intake-review':'select code,account,owner,due_on,questions,ready,blocked,readiness from questionnaire_readiness where status=\'open\' order by due_on,code',
 'answer-refresh':'select code,topic,owner,evidence_code,review_due_on,currency from answer_currency order by review_due_on,code',
 'evidence-review':'select code,title,version,owner,reviewed_on,expires_on,classification from evidence order by expires_on,code',
 'response-review':'select code,questionnaire,owner,answer_code,readiness from response_readiness where questionnaire_status=\'open\' order by questionnaire,code',
 'handover-ready':'select code,account,owner,due_on,readiness from questionnaire_readiness order by due_on,code',
 'owner-load':"select owner,count(*) as open_responses,count(*) filter(where readiness<>'ready') as blocked from response_readiness where questionnaire_status='open' group by owner order by blocked desc,owner",
 'reused-answers':"select a.code,a.topic,a.currency,count(r.id) as uses,count(r.id) filter(where r.questionnaire_status='open') as open_uses from answer_currency a left join response_readiness r on r.answer_id=a.id group by a.code,a.topic,a.currency order by uses desc,a.code",
 'unanswered':"select code,questionnaire,question,owner from response_readiness where questionnaire_status='open' and (answer_id is null or trim(answer_text)='') order by code",
 'privacy-review':"select code,name,owner,retention_review_on from accounts where personal_data and (retention_review_on is null or retention_review_on<current_date) order by code",
 'attention':'select * from security_attention order by rule,code',
 'activity':'select kind,actor,action,details,created_at from activity order by created_at,id'
};
export const rules={
 'QUESTIONNAIRE-DUE':['Internal policy','Agree dates with the requesting business','docs/compliance.md'],
 'ANSWER-CURRENT':['Internal policy; NZ IPP8 applies to personal information','Review answer text against current evidence','https://www.privacy.org.nz/privacy-principles/8/'],
 'EVIDENCE-REVIEW':['Internal policy','Record document review and chosen expiry','docs/compliance.md'],
 'RESPONSE-REVIEW':['Internal policy','Human review of each exact answer and evidence version','docs/compliance.md'],
 'EMPTY-QUESTIONNAIRE':['Internal policy','Load at least one question before handover','docs/compliance.md'],
 'PRIVACY-RETENTION':['NZ Privacy Act 2020 IPP9; internal review date','Review whether personal records remain necessary','https://www.privacy.org.nz/privacy-principles/9/']
};
function need(o,k){if(o[k]===undefined||o[k]===null||String(o[k]).trim()==='')throw Error(`Give --${k.replaceAll('_','-')}`);return o[k];}
function entity(k){if(!Object.hasOwn(entities,k))throw Error(`Choose --kind=${Object.keys(entities).join('|')}`);return entities[k];}
export async function resolve(db,kind,value){
 const spec=entity(kind);if(!String(value??'').trim())throw Error('Empty record reference');
 const exact=await db.query(`select * from ${kind} where lower(code)=lower($1) or id::text=$1`,[String(value)]);if(exact.length===1)return exact[0];
 const names=spec.fields.filter(f=>['name','title','question'].includes(f));
 const rows=await db.query(`select * from ${kind} where left(id::text,length($1))=lower($1) or position(lower($1) in lower(code))>0 ${names.map(n=>`or position(lower($1) in lower(${n}))>0`).join(' ')} order by code`,[String(value)]);
 if(rows.length!==1)throw Error(rows.length?`Ambiguous ${kind}: ${rows.map(r=>`${r.code} (${r.id})`).join(', ')}`:`No ${kind} match: ${value}`);return rows[0];
}
function date(v,key){if(v===''||v===null)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v))||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error(`Invalid ISO date ${key}: ${v}`);if(['reviewed_on','approved_on'].includes(key)&&v>new Date().toISOString().slice(0,10))throw Error(`${key} cannot be future dated`);return v;}
async function fields(db,kind,input,partial=false){
 const spec=entity(kind),out={};
 for(const [k,value] of Object.entries(input)){
  if(!spec.fields.includes(k))throw Error(`Unknown ${kind} field ${k}`);let v=value;
  if(k==='personal_data'){if(!['true','false','yes','no','1','0'].includes(String(v).toLowerCase()))throw Error('Invalid personal_data boolean');v=['true','yes','1'].includes(String(v).toLowerCase());}
  if(k.endsWith('_on'))v=date(v,k);
  if(spec.refs[k])v=v?(await resolve(db,spec.refs[k],v)).id:null;
  if(typeof v==='string'&&!v.trim()&&spec.required.includes(k))throw Error(`Empty ${k}`);
  out[k]=v;
 }
 if(!partial)for(const k of spec.required)need(out,k);return out;
}
async function transaction(db,fn,dry=false){await db.exec('begin isolation level serializable');try{const out=await fn();await db.exec(dry?'rollback':'commit');return out;}catch(e){await db.exec('rollback');throw e;}}
async function record(db,kind,id,actor,action,details){await db.query('insert into activity(kind,record_id,actor,action,details) values($1,$2,$3,$4,$5::jsonb)',[kind,id,actor,action,JSON.stringify(details)]);}
async function insert(db,kind,data,actor){const cols=Object.keys(data);const [r]=await db.query(`insert into ${kind} (${cols.join(',')}) values(${cols.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(data));await record(db,kind,r.id,actor,'add',data);return r;}
async function change(db,kind,ref,data,actor){const before=await resolve(db,kind,ref);const cols=Object.keys(data);if(!cols.length)throw Error('No changes');const [r]=await db.query(`update ${kind} set ${cols.map((k,i)=>`${k}=$${i+1}`).join(',')} where id=$${cols.length+1} returning *`,[...Object.values(data),before.id]);await record(db,kind,r.id,actor,'update',{before,changes:data});return r;}
const csv=(rows,cols)=>{const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';return [cols.map(esc).join(','),...rows.map(r=>cols.map(k=>esc(r[k])).join(','))].join('\r\n')+'\r\n';};
export const commands=[...Object.keys(reads),'help','list','show','compliance','weekly-review','add','update','log','approve-answer','approve-response','use-answer','suggest','import','export','handover','draft-response-pack','draft-review-request'];
export async function run(db,command,opts={},args=[]){
 if('dry_run' in opts&&opts.dry_run!==true)throw Error('Use --dry-run without a value');
 if(Object.hasOwn(reads,command))return db.query(reads[command]);
 if(command==='help')return commands.map(command=>({command}));
 if(command==='list'){entity(opts.kind);return db.query(`select * from ${opts.kind} order by code`);}
 if(command==='show')return [await resolve(db,opts.kind,need(opts,'ref'))];
 if(command==='compliance')return (await run(db,'attention')).map(r=>({...r,basis:rules[r.rule][0],check:rules[r.rule][1],source:rules[r.rule][2]}));
 if(command==='weekly-review')return {intake:await run(db,'intake-review'),attention:await run(db,'attention'),answers:await run(db,'answer-refresh')};
 if(command==='add'||command==='update'){
  const actor=need(opts,'actor'),kind=need(opts,'kind');entity(kind);
  const input=Object.fromEntries(Object.entries(opts).filter(([k])=>!['actor','kind','ref','json'].includes(k)));
  return transaction(db,async()=>{const data=await fields(db,kind,input,command==='update');return command==='add'?[await insert(db,kind,data,actor)]:[await change(db,kind,need(opts,'ref'),data,actor)];});
 }
 if(command==='approve-answer'||command==='approve-response'){
  const actor=need(opts,'actor'),on=date(need(opts,'on'),'reviewed_on');
  return transaction(db,async()=>[await change(db,command==='approve-answer'?'answers':'responses',need(opts,'ref'),command==='approve-answer'?{status:'approved',approved_by:actor,approved_on:on}:{status:'approved',reviewed_by:actor,reviewed_on:on},actor)]);
 }
 if(command==='use-answer'){
  const actor=need(opts,'actor');return transaction(db,async()=>{const a=await resolve(db,'answers',need(opts,'answer'));return [await change(db,'responses',need(opts,'ref'),{answer_id:a.id,answer_text:a.answer,status:'draft',reviewed_by:null,reviewed_on:null,answer_revision:null},actor)];});
 }
 if(command==='suggest'){
  const r=await resolve(db,'responses',need(opts,'ref'));
  return db.query("select code,question,answer,evidence_code,currency from answer_currency where currency='current' and lower(trim(question))=lower(trim($1)) order by code",[r.question]);
 }
 if(command==='log'){
  const actor=need(opts,'actor'),kind=need(opts,'kind'),r=await resolve(db,kind,need(opts,'ref'));need(opts,'note');await record(db,kind,r.id,actor,'note',{note:opts.note});return [{code:r.code,logged:true}];
 }
 if(command==='import'){
  if(args[0]!=='1up')throw Error('Use import 1up --file=... --questionnaire=... --owner=... --actor=... [--map=...] [--dry-run]');
  const actor=need(opts,'actor'),owner=need(opts,'owner');
  const rows=parseCsv(fs.readFileSync(need(opts,'file'),'utf8'));if(!rows.length)throw Error('CSV contains no rows');
  const mapping=opts.map?JSON.parse(fs.readFileSync(opts.map,'utf8')):{question:'Question',answer_text:'Answer'};
  if(!mapping||typeof mapping!=='object'||Array.isArray(mapping)||!mapping.question)throw Error('Mapping needs question');
  for(const [k,h] of Object.entries(mapping))if(!['question','answer_text','code'].includes(k)||typeof h!=='string'||!Object.hasOwn(rows[0],h))throw Error(`Invalid or missing mapped header: ${h}`);
  return transaction(db,async()=>{
   const q=await resolve(db,'questionnaires',need(opts,'questionnaire'));let added=0,unchanged=0;const seen=new Set();
   for(const [index,row] of rows.entries()){
    const question=row[mapping.question];if(!question.trim())throw Error(`Empty question at row ${index+2}`);
    const code=mapping.code?row[mapping.code]:`IMP-${createHash('sha256').update(q.id+'\0'+question).digest('hex').slice(0,20)}`;
    if(!code.trim())throw Error('Empty import code');if(seen.has(code.toLowerCase()))throw Error('Duplicate question or code: map a unique source code');seen.add(code.toLowerCase());
    const data={code,questionnaire_id:q.id,question,answer_text:mapping.answer_text?row[mapping.answer_text]:'',owner};
    const [existing]=await db.query('select * from responses where lower(code)=lower($1)',[code]);
    if(existing){if(Object.entries(data).some(([k,v])=>String(existing[k])!==String(v)))throw Error(`Conflicting existing response ${code}`);unchanged++;continue;}
    const r=await insert(db,'responses',data,actor);await record(db,'responses',r.id,actor,'import-source',{vendor:'1up',source_file:path.basename(opts.file),row,mapping});added++;
   }
   return [{rows:rows.length,added,unchanged,dry_run:Boolean(opts.dry_run),unmapped_headers:Object.keys(rows[0]).filter(h=>!Object.values(mapping).includes(h)).join(', ')}];
  },Boolean(opts.dry_run));
 }
 if(command==='export'){
  const dir=path.resolve(opts.dir||path.join(REPO_ROOT,'exports'));fs.mkdirSync(dir,{recursive:true,mode:0o700});
  if(opts.kind){const spec=entity(opts.kind),rows=await db.query(`select * from ${opts.kind} order by code`);for(const r of rows)for(const [k,target] of Object.entries(spec.refs))if(r[k])r[k]=(await resolve(db,target,r[k])).code;
   const file=path.join(dir,opts.kind+'.csv');fs.writeFileSync(file,csv(rows,Object.keys(rows[0]||Object.fromEntries(spec.fields.map(k=>[k,''])))),{mode:0o600});return [{file,rows:rows.length}];}
  const out={exported_at:new Date().toISOString(),version:1};for(const kind of [...Object.keys(entities),'activity'])out[kind]=await db.query(`select * from ${kind} order by id`);
  const file=path.join(dir,'security-answers-backup.json');fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n',{mode:0o600});return [{file,records:Object.keys(entities).reduce((n,k)=>n+out[k].length,0)}];
 }
 if(['handover','draft-response-pack','draft-review-request'].includes(command)){
  return transaction(db,async()=>{
   const q=await resolve(db,'questionnaires',need(opts,'ref'));const [summary]=await db.query('select code,account,owner,due_on,questions,ready,blocked,readiness from questionnaire_readiness where id=$1',[q.id]);
   if(command==='handover'&&(summary.readiness!=='ready for human handover'||q.status!=='open'))throw Error('Handover blocked: open questionnaire needs at least one question and every current approved response');
   const rows=await db.query('select code,question,answer_text,evidence_code,evidence_version,classification,readiness from response_readiness where questionnaire_id=$1 order by code',[q.id]);
   const selected=command==='draft-review-request'?rows.filter(r=>r.readiness!=='ready'):rows;
   const file=writeOut('drafts',`${command}-${q.id}`,page({title:command==='handover'?'Response handover: INTERNAL DRAFT':command==='draft-review-request'?'Review request: DRAFT':'Response pack: DRAFT',sections:[{title:'Review before sharing',note:'Nothing has been sent. Verify recipients and evidence sharing permission. Evidence files are not attached. This is a records check, not a certification.',html:''},{title:'Questionnaire',html:htmlTable([summary])},{title:'Responses',html:htmlTable(selected)}]}));return [{file,status:'draft only',readiness:summary.readiness}];
  });
 }
 throw Error(`Unknown command ${command}. Run help.`);
}
export function print(value){if(Array.isArray(value))return value.length?table(value,Object.keys(value[0]).map(key=>({key,label:key,width:80}))):'  (none)';return Object.entries(value).map(([k,v])=>`${k}\n${print(v)}`).join('\n\n');}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{
  const [command='help',...rest]=process.argv.slice(2),opts={},args=[];
  for(const a of rest){if(a.startsWith('--')){const i=a.indexOf('=');const k=a.slice(2,i<0?undefined:i).replaceAll('-','_');if(k in opts)throw Error('Duplicate flag '+k);opts[k]=i<0?true:a.slice(i+1);}else args.push(a);}
  db=await getDb();const out=await run(db,command,opts,args);console.log(opts.json?JSON.stringify(out):print(out));
 }catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}
}
