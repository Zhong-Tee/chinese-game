// Install the isolated test dependency as described in docs/conversation-lessons.md.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import('../tmp/conversation-validation/node_modules/@electric-sql/pglite/dist/index.js');
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/202611080001_conversation_lessons.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611080002_conversation_costs.sql', import.meta.url), 'utf8'));
  const user1 = '00000000-0000-0000-0000-000000000001';
  const user2 = '00000000-0000-0000-0000-000000000002';
  async function claim(key, topic, count, existing = null, level = 'beginner') {
    return (await db.query('select claim_conversation_course($1,$2,$3,$4,$5,$6,$7) as result', [key, topic, level, 'สั่งเครื่องดื่มได้', user1, count, existing])).rows[0].result;
  }
  const first = await claim('สั่งชา', 'สั่งชา', 0);
  assert.equal(first.claimed, true);
  const id = first.course.id;
  const simultaneous = await Promise.all([claim('สั่งชา', 'สั่งชา', 0), claim('ซื้อชา', 'สั่งชา', 0)]);
  for (const result of simultaneous) { assert.equal(result.course.id, id); assert.equal(result.claimed, false); }
  const semantic = await claim('ชาร้อน', 'ซื้อชาร้อน', 1, id);
  assert.equal(semantic.course.id, id);
  assert.equal((await claim('แนะนำตัว', 'แนะนำตัว', 0)).refresh, true);
  assert.equal((await claim('แนะนำตัว', 'แนะนำตัว', 1)).claimed, true);
  assert.equal((await claim('สั่งชา', 'สั่งชา', 2, null, 'basic')).claimed, true);
  assert.equal((await db.query('select count(*)::int as n from conversation_courses')).rows[0].n, 3);
  await db.query("update conversation_courses set status='failed' where id=$1", [id]);
  const retry = await claim('สั่งชา', 'สั่งชา', 3);
  assert.equal(retry.claimed, true);
  assert.notEqual(retry.course.generation_token, first.course.generation_token);
  assert.equal((await claim('ซื้อชา', 'สั่งชา', 3)).claimed, false);
  console.log('PASS catalog reservation, canonical aliases, semantic reuse, stale snapshots, levels and retry ownership');

  const content = { units: [{ questions: [{ kind: 'choice', correct_index: 1 }, { kind: 'order', tokens: ['茶','我'], answer_order: [1, 0] }] }] };
  await db.query("update conversation_courses set status='ready',content=$2::jsonb where id=$1", [id, JSON.stringify(content)]);
  async function asUser(user) { await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`); }
  async function answer(question, value) {
    return (await db.query('select to_jsonb(answer_conversation_question($1,0,$2,$3::jsonb)) as result', [id, question, JSON.stringify(value)])).rows[0].result;
  }
  await asUser(user1);
  assert.equal((await db.query('select count(*)::int as n from conversation_courses')).rows[0].n, 3);
  const wrong = await answer(0, 0);
  assert.equal(wrong.answers[0].correct, false);
  assert.equal(wrong.completed, false);
  const complete = await answer(1, [1, 0]);
  assert.equal(complete.answers[1].correct, true);
  assert.equal(complete.completed, true);
  const reviewed = await answer(0, 1);
  assert.equal(reviewed.answers[0].correct, true);
  assert.equal(reviewed.answers[0].attempts, 2);
  assert.equal(reviewed.answers[1].correct, true);
  await assert.rejects(answer(-1, 1), /Invalid question/);
  await assert.rejects(answer(99, 1), /Invalid question/);
  await assert.rejects(db.query('update conversation_courses set topic=$1 where id=$2', ['แก้ไข', id]), /permission denied/);
  await assert.rejects(db.query('delete from conversation_progress where course_id=$1', [id]), /permission denied/);
  await asUser(user2);
  assert.equal((await db.query('select * from conversation_progress')).rows.length, 0);
  const secondUser = await answer(0, 1);
  assert.equal(secondUser.completed, false);
  assert.equal(Object.keys(secondUser.answers).length, 1);
  assert.equal((await db.query('select * from conversation_progress')).rows.length, 1);
  await assert.rejects(db.query("select claim_conversation_course('x','xx','beginner','xx',$1,0,null)", [user2]), /permission denied/);
  await db.exec('reset role;');
  content.units[0].questions[1] = { kind: 'order', tokens: ['我','喜欢','我'], answer_order: [0,1,2] };
  await db.query('update conversation_courses set content=$2::jsonb where id=$1', [id, JSON.stringify(content)]);
  await asUser(user2);
  assert.equal((await answer(1, [2,1,0])).answers[1].correct, true);
  assert.equal((await answer(1, [0,1,0])).answers[1].correct, false);
  assert.equal((await answer(1, 0)).answers[1].correct, false);
  assert.equal((await answer(1, [0,1,9])).answers[1].correct, false);
  assert.equal((await answer(1, [0,1,'invalid'])).answers[1].correct, false);
  await assert.rejects(db.query('select * from conversation_generation_runs'), /permission denied/);
  await db.exec('reset role;');
  const log = async (operation, usd, thb, linked = id) => (await db.query(`insert into conversation_generation_runs
    (id,course_id,user_id,operation,model,usage,cost_usd,cost_thb,exchange_rate,pricing_version)
    values(gen_random_uuid(),$1,$2,$3,'test','{}',$4,$5,34,'test') returning id`, [linked, user1, operation, usd, thb])).rows[0].id;
  const lookupId = await log('lookup', 0.01, 0.34, null);
  await db.query('update conversation_generation_runs set course_id=$1 where id=$2', [id, lookupId]);
  await log('content', 0.03, 1.02);
  // Re-linking an existing record cannot double count it; retry attempts add new records.
  await db.query('update conversation_generation_runs set course_id=$1 where id=$2', [id, lookupId]);
  await log('content', 0.02, 0.68);
  let totals = (await db.query('select * from conversation_courses where id=$1', [id])).rows[0];
  assert.equal(Number(totals.generation_cost_usd), 0.06);
  assert.equal(Number(totals.generation_cost_thb), 2.04);
  assert.equal(Number(totals.lookup_cost_thb), 0.34);
  assert.equal(Number(totals.content_cost_thb), 1.70);
  assert.equal(totals.cost_record_count, 3);
  await log('content', null, null);
  totals = (await db.query('select * from conversation_courses where id=$1', [id])).rows[0];
  assert.equal(totals.generation_cost_thb, null);
  assert.equal(totals.content_cost_thb, null);
  assert.equal(Number(totals.lookup_cost_thb), 0.34);
  console.log('PASS cost attribution, cached/retry totals, idempotent linking, unknown prices and private usage logs');
  await db.exec('reset role;');
  await db.exec(await readFile(new URL('../supabase/migrations/202611080003_conversation_memory.sql', import.meta.url), 'utf8'));
  content.units[0].vocabulary = [{ cn: '茶', th: 'ชา' }, { cn: '水', th: 'น้ำ' }, { cn: '红茶', th: 'ชาดำ' }];
  await db.query('update conversation_courses set content=$2::jsonb where id=$1', [id, JSON.stringify(content)]);
  await asUser(user1);
  const memoryAnswer = async (round, word, choice) => (await db.query('select answer_conversation_vocabulary($1,0,$2,$3,$4) result', [id, round, word, choice])).rows[0].result;
  let memoryResult = await memoryAnswer('start', 0, 1);
  assert.equal(memoryResult.memory.start[0].correct, false);
  assert.equal(memoryResult.completed, false);
  for (const round of ['start','middle','end']) for (let i=0;i<3;i++) memoryResult = await memoryAnswer(round, i, i);
  assert.equal(memoryResult.completed, true);
  assert.equal(memoryResult.memory.start[0].attempts, 2);
  assert.equal(Object.keys(memoryResult.memory.middle).length, 3);
  await assert.rejects(memoryAnswer('invalid', 0, 0), /Invalid memory round/);
  await assert.rejects(memoryAnswer('start', -1, 0), /Invalid vocabulary/);
  await assert.rejects(memoryAnswer('start', 0, 99), /Invalid vocabulary/);
  await asUser(user2);
  const privateMemory = (await db.query('select memory from conversation_progress where course_id=$1', [id])).rows[0].memory;
  assert.deepEqual(privateMemory, {});
  console.log('PASS three memory rounds, retry attempts, completion gating, input validation and account isolation');
  await db.exec('reset role; set role anon;');
  await assert.rejects(db.query('select * from conversation_courses'), /permission denied/);
  console.log('PASS shared reading, private progress/RLS, server grading, atomic answer merging, review and restricted writes');
} finally { await db.close(); }
