create function touch_record() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
create table accounts (id uuid primary key default gen_random_uuid(), code text not null check(length(trim(code))>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
name text not null, owner text not null, personal_data boolean not null default false, retention_review_on date);
create unique index accounts_code_unique on accounts(lower(code));
create trigger touch before update on accounts for each row execute function touch_record();
alter table accounts enable row level security;
revoke all on accounts from public;
create table evidence (id uuid primary key default gen_random_uuid(), code text not null check(length(trim(code))>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
title text not null, document_ref text not null, version text not null, owner text not null, reviewed_on date check(reviewed_on<=current_date), expires_on date not null, classification text not null default 'internal' check(classification in ('public','internal','restricted')), revision integer not null default 1);
create unique index evidence_code_unique on evidence(lower(code));
create trigger touch before update on evidence for each row execute function touch_record();
alter table evidence enable row level security;
revoke all on evidence from public;
create table answers (id uuid primary key default gen_random_uuid(), code text not null check(length(trim(code))>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
question text not null, answer text not null check(length(trim(answer))>0), topic text not null, owner text not null, evidence_id uuid references evidence(id), review_due_on date not null, status text not null default 'draft' check(status in ('draft','approved')), approved_by text, approved_on date, evidence_revision integer, revision integer not null default 1);
create unique index answers_code_unique on answers(lower(code));
create trigger touch before update on answers for each row execute function touch_record();
alter table answers enable row level security;
revoke all on answers from public;
create table questionnaires (id uuid primary key default gen_random_uuid(), code text not null check(length(trim(code))>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
title text not null, account_id uuid not null references accounts(id), owner text not null, due_on date not null, status text not null default 'open' check(status in ('open','closed')));
create unique index questionnaires_code_unique on questionnaires(lower(code));
create trigger touch before update on questionnaires for each row execute function touch_record();
alter table questionnaires enable row level security;
revoke all on questionnaires from public;
create table responses (id uuid primary key default gen_random_uuid(), code text not null check(length(trim(code))>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
questionnaire_id uuid not null references questionnaires(id), question text not null, answer_id uuid references answers(id), answer_text text not null default '', owner text not null, status text not null default 'draft' check(status in ('draft','approved')), reviewed_by text, reviewed_on date, answer_revision integer);
create unique index responses_code_unique on responses(lower(code));
create trigger touch before update on responses for each row execute function touch_record();
alter table responses enable row level security;
revoke all on responses from public;
create index responses_questionnaire on responses(questionnaire_id);
create index responses_answer on responses(answer_id);
create index answers_evidence on answers(evidence_id);
create table activity(id uuid primary key default gen_random_uuid(), kind text not null, record_id uuid not null, actor text not null, action text not null, details jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table activity enable row level security;
revoke all on activity from public;
create function evidence_guard() returns trigger language plpgsql as $$
begin
 if row(new.title,new.document_ref,new.version,new.reviewed_on,new.expires_on,new.classification) is distinct from row(old.title,old.document_ref,old.version,old.reviewed_on,old.expires_on,old.classification) then new.revision=old.revision+1; end if;
 return new;
end $$;
create trigger evidence_revision before update on evidence for each row execute function evidence_guard();
create function answer_guard() returns trigger language plpgsql as $$
declare e evidence;
begin
 if TG_OP='UPDATE' and row(new.question,new.answer,new.topic,new.owner,new.evidence_id,new.review_due_on) is distinct from row(old.question,old.answer,old.topic,old.owner,old.evidence_id,old.review_due_on) then
  new.revision=old.revision+1; new.status='draft'; new.approved_by=null; new.approved_on=null; new.evidence_revision=null;
 end if;
 if new.status='approved' then
  select * into e from evidence where id=new.evidence_id;
  if e.id is null or e.reviewed_on is null or e.expires_on<current_date or new.review_due_on<current_date then raise exception 'Current reviewed evidence and a current answer review date are required'; end if;
  if coalesce(trim(new.approved_by),'')='' or new.approved_on is null or new.approved_on>current_date then raise exception 'Approval actor and actual date required'; end if;
  new.evidence_revision=e.revision;
 end if;
 return new;
end $$;
create trigger answer_approval before insert or update on answers for each row execute function answer_guard();
create view answer_currency as
select a.*, e.code as evidence_code,e.version as evidence_version,e.expires_on,e.classification,
 case when a.status<>'approved' then 'unapproved' when a.review_due_on<current_date then 'answer review overdue'
 when e.id is null or e.reviewed_on is null then 'evidence not reviewed' when e.expires_on<current_date then 'evidence expired'
 when a.evidence_revision is distinct from e.revision then 'evidence changed' else 'current' end as currency
from answers a left join evidence e on e.id=a.evidence_id;
create function response_guard() returns trigger language plpgsql as $$
declare a record;
begin
 if TG_OP='UPDATE' and row(new.question,new.questionnaire_id,new.answer_id,new.answer_text,new.owner) is distinct from row(old.question,old.questionnaire_id,old.answer_id,old.answer_text,old.owner) then
  new.status='draft'; new.reviewed_by=null; new.reviewed_on=null; new.answer_revision=null;
 end if;
 if new.status='approved' then
  select * into a from answer_currency where id=new.answer_id;
  if not found then raise exception 'Approved response requires an answer'; end if;
  if a.currency<>'current' or new.answer_text<>a.answer then raise exception 'Response needs the current approved answer text and evidence'; end if;
  if coalesce(trim(new.reviewed_by),'')='' or new.reviewed_on is null or new.reviewed_on>current_date then raise exception 'Response reviewer and actual date required'; end if;
  new.answer_revision=a.revision;
 end if;
 return new;
end $$;
create trigger response_approval before insert or update on responses for each row execute function response_guard();
create view response_readiness as
select r.*,q.code as questionnaire,q.status as questionnaire_status,q.due_on,a.code as answer_code,a.evidence_code,a.evidence_version,a.classification,
 case when r.status<>'approved' then 'needs review' when a.id is null then 'no answer'
 when a.currency<>'current' then a.currency when r.answer_revision is distinct from a.revision then 'answer changed'
 when r.answer_text<>a.answer then 'text changed' else 'ready' end as readiness
from responses r join questionnaires q on q.id=r.questionnaire_id left join answer_currency a on a.id=r.answer_id;
create view questionnaire_readiness as
select q.*,c.name as account,count(r.id)::integer as questions,count(r.id) filter(where r.readiness='ready')::integer as ready,
 count(r.id) filter(where r.readiness<>'ready')::integer as blocked,
 case when count(r.id)>0 and count(r.id) filter(where r.readiness<>'ready')=0 then 'ready for human handover' else 'blocked' end as readiness
from questionnaires q join accounts c on c.id=q.account_id left join response_readiness r on r.questionnaire_id=q.id group by q.id,c.name;
create view security_attention as
select 'QUESTIONNAIRE-DUE'::text as rule,code,owner,due_on,'Open questionnaire past its agreed date'::text as finding from questionnaires where status='open' and due_on<current_date
union all select 'ANSWER-CURRENT',code,owner,review_due_on,currency from answer_currency where currency<>'current'
union all select 'EVIDENCE-REVIEW',code,owner,expires_on,'Evidence unreviewed or expired' from evidence where reviewed_on is null or expires_on<current_date
union all select 'RESPONSE-REVIEW',code,owner,due_on,readiness from response_readiness where questionnaire_status='open' and readiness<>'ready'
union all select 'EMPTY-QUESTIONNAIRE',code,owner,due_on,'No questions loaded' from questionnaire_readiness where status='open' and questions=0
union all select 'PRIVACY-RETENTION',code,owner,retention_review_on,'Review personal-information retention purpose' from accounts where personal_data and (retention_review_on is null or retention_review_on<current_date);
revoke all on answer_currency,response_readiness,questionnaire_readiness,security_attention from public;
