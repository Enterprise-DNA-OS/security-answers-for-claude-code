insert into accounts(code,name,owner,personal_data,retention_review_on) values
 ('AC-KAURI','Kauri Systems (fictional)','Mara Chen',true,current_date-10),('AC-RIMU','Rimu Data (fictional)','Nina Patel',false,null) on conflict do nothing;
insert into evidence(code,title,document_ref,version,owner,reviewed_on,expires_on,classification) values
 ('EV-ACCESS','Access review procedure','demo://policies/access-review','3','Nina Patel',current_date-5,current_date+90,'internal'),
 ('EV-BACKUP','Backup restore review','demo://records/restore-test','2','Mara Chen',current_date-100,current_date-2,'restricted'),
 ('EV-NEW','New incident procedure','demo://policies/incident','1','Nina Patel',null,current_date+180,'internal') on conflict do nothing;
insert into answers(code,question,answer,topic,owner,evidence_id,review_due_on,status,approved_by,approved_on) values
 ('AN-ACCESS','How often are access rights reviewed?','Access rights are reviewed quarterly.','Access','Nina Patel',(select id from evidence where code='EV-ACCESS'),current_date+60,'approved','Mara Chen',current_date-4),
 ('AN-BACKUP','When was the last restore test?','The last recorded restore test is awaiting renewal.','Resilience','Mara Chen',(select id from evidence where code='EV-BACKUP'),current_date-1,'draft',null,null),
 ('AN-INCIDENT','Who owns incident response?','The operations lead coordinates incident response.','Incident','Nina Patel',(select id from evidence where code='EV-NEW'),current_date+30,'draft',null,null) on conflict do nothing;
insert into questionnaires(code,title,account_id,owner,due_on) values
 ('SQ-KAURI','Kauri annual security review',(select id from accounts where code='AC-KAURI'),'Mara Chen',current_date-2),
 ('SQ-RIMU','Rimu renewal review',(select id from accounts where code='AC-RIMU'),'Nina Patel',current_date+5),
 ('SQ-EMPTY','Rimu new product assessment',(select id from accounts where code='AC-RIMU'),'Nina Patel',current_date+12) on conflict do nothing;
insert into responses(code,questionnaire_id,question,answer_id,answer_text,owner,status,reviewed_by,reviewed_on) values
 ('RS-K1',(select id from questionnaires where code='SQ-KAURI'),'How often are access rights reviewed?',(select id from answers where code='AN-ACCESS'),'Access rights are reviewed quarterly.','Mara Chen','approved','Nina Patel',current_date-3),
 ('RS-K2',(select id from questionnaires where code='SQ-KAURI'),'When was the last restore test?',(select id from answers where code='AN-BACKUP'),'The last recorded restore test is awaiting renewal.','Mara Chen','draft',null,null),
 ('RS-K3',(select id from questionnaires where code='SQ-KAURI'),'Do you operate in our jurisdiction?',null,'','Nina Patel','draft',null,null),
 ('RS-R1',(select id from questionnaires where code='SQ-RIMU'),'How often are access rights reviewed?',(select id from answers where code='AN-ACCESS'),'Access rights are reviewed quarterly.','Nina Patel','approved','Mara Chen',current_date-3) on conflict do nothing;
