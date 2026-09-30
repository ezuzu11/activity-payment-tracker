-- Scenario tests. Run after stub_supabase.sql + schema.sql. Prints PASS/FAIL lines.
\set ON_ERROR_STOP off
\pset tuples_only on

-- seed counts
select 'blocks=2: '      || case when count(*)=2  then 'PASS' else 'FAIL '||count(*) end from blocks;
select 'floors=18: '     || case when count(*)=18 then 'PASS' else 'FAIL '||count(*) end from floors;
select 'apartments=52: ' || case when count(*)=52 then 'PASS' else 'FAIL '||count(*) end from apartments;

-- users
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test'),
  ('00000000-0000-0000-0000-00000000000b', 'viewer@test');
update profiles set role = 'admin' where email = 'admin@test';
select 'profiles auto-created: ' || case when count(*)=2 then 'PASS' else 'FAIL' end from profiles;

-- ===== act as ADMIN =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

insert into activities (name, scope) values ('Electrical wire pulling', 'apartment'), ('Gypsum ceiling', 'floor');
\echo '-- expect error: duplicate activity name'
insert into activities (name, scope) values ('  electrical WIRE pulling ', 'apartment');

-- work orders
insert into work_orders (activity_id, floor_id, apartment_id, contract_amount)
select a.id, f.id, ap.id, 400000
from activities a, floors f join blocks b on b.id=f.block_id join apartments ap on ap.floor_id=f.id
where a.name='Electrical wire pulling' and b.name='A' and f.number=1 and ap.label='R';

insert into work_orders (activity_id, floor_id, contract_amount)
select a.id, f.id, 1200000 from activities a, floors f join blocks b on b.id=f.block_id
where a.name='Gypsum ceiling' and b.name='A' and f.number=1;

\echo '-- expect error: duplicate work order (apartment)'
insert into work_orders (activity_id, floor_id, apartment_id, contract_amount)
select a.id, f.id, ap.id, 999 from activities a, floors f join blocks b on b.id=f.block_id join apartments ap on ap.floor_id=f.id
where a.name='Electrical wire pulling' and b.name='A' and f.number=1 and ap.label='R';
\echo '-- expect error: duplicate work order (floor, null apartment)'
insert into work_orders (activity_id, floor_id, contract_amount)
select a.id, f.id, 999 from activities a, floors f join blocks b on b.id=f.block_id
where a.name='Gypsum ceiling' and b.name='A' and f.number=1;
\echo '-- expect error: per-apartment activity without apartment'
insert into work_orders (activity_id, floor_id, contract_amount)
select a.id, f.id, 999 from activities a, floors f join blocks b on b.id=f.block_id
where a.name='Electrical wire pulling' and b.name='A' and f.number=2;
\echo '-- expect error: apartment on another floor'
insert into work_orders (activity_id, floor_id, apartment_id, contract_amount)
select a.id, f.id, (select ap.id from apartments ap join floors f2 on f2.id=ap.floor_id join blocks b2 on b2.id=f2.block_id where b2.name='A' and f2.number=5 and ap.label='M'), 999
from activities a, floors f join blocks b on b.id=f.block_id
where a.name='Electrical wire pulling' and b.name='A' and f.number=3;
\echo '-- expect error: per-floor activity with apartment'
insert into work_orders (activity_id, floor_id, apartment_id, contract_amount)
select a.id, f.id, ap.id, 999 from activities a, floors f join blocks b on b.id=f.block_id join apartments ap on ap.floor_id=f.id
where a.name='Gypsum ceiling' and b.name='A' and f.number=4 and ap.label='L';

select 'work orders=2: ' || case when count(*)=2 then 'PASS' else 'FAIL '||count(*) end from work_orders;

-- payments on wire pulling A-F1-R
insert into payments (work_order_id, percent_to_date, paid_on)
select id, 70, '2026-09-10' from v_work_orders where location='A-F1-R';
\echo '-- expect error: same 70% again'
insert into payments (work_order_id, percent_to_date)
select id, 70 from v_work_orders where location='A-F1-R';
\echo '-- expect error: lower 50%'
insert into payments (work_order_id, percent_to_date)
select id, 50 from v_work_orders where location='A-F1-R';
\echo '-- expect error: over 100%'
insert into payments (work_order_id, percent_to_date)
select id, 110 from v_work_orders where location='A-F1-R';
insert into payments (work_order_id, percent_to_date, paid_on)
select id, 100, '2026-09-28' from v_work_orders where location='A-F1-R';

select 'amounts 280000,120000: ' || case when string_agg(amount::bigint::text, ',' order by percent_to_date)='280000,120000' then 'PASS' else 'FAIL '||string_agg(amount::text, ',') end
from v_payments;

select 'A-F1-R paid 400000, balance 0, completed: ' ||
  case when paid_amount=400000 and balance=0 and status='completed' then 'PASS' else 'FAIL '||paid_amount||' '||balance||' '||status end
from v_work_orders where location='A-F1-R';

select 'floor A-F1: 2 WOs, 1 completed, 1 remaining, 25%: ' ||
  case when total_work_orders=2 and completed=1 and remaining=1 and progress_percent=25.0 then 'PASS'
       else 'FAIL '||total_work_orders||'/'||completed||'/'||remaining||'/'||progress_percent end
from v_floor_progress where block_name='A' and floor_number=1;

-- admin edit: change first payment 70 -> 60 ; amounts recalc
update payments set percent_to_date = 60 where percent_to_date = 70;
select 'after admin edit 240000,160000: ' || case when string_agg(amount::bigint::text, ',' order by percent_to_date)='240000,160000' then 'PASS' else 'FAIL '||string_agg(amount::text, ',') end
from v_payments;

-- ===== act as VIEWER =====
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select 'viewer can read work orders: ' || case when count(*)=2 then 'PASS' else 'FAIL '||count(*) end from v_work_orders;
\echo '-- expect error: viewer insert activity (RLS)'
insert into activities (name, scope) values ('Painting', 'floor');
\echo '-- expect 0 rows changed: viewer update/delete payments'
update payments set notes = 'hack';
delete from payments;
select 'viewer could not delete payments: ' || case when count(*)=2 then 'PASS' else 'FAIL '||count(*) end from payments;
select 'viewer sees only own profile: ' || case when count(*)=1 then 'PASS' else 'FAIL '||count(*) end from profiles;
\echo '-- expect 0 rows: viewer promotes self'
update profiles set role='admin' where id = auth.uid();
reset role;
select 'viewer still viewer: ' || case when role='viewer' then 'PASS' else 'FAIL' end from profiles where email='viewer@test';
