import test from 'node:test';
import assert from 'node:assert/strict';
import {levenshtein,textMetrics,classifyMistakes} from '../lib/scoring.mjs';

test('levenshtein handles insertion',()=>assert.equal(levenshtein('abc','abxc'),1));
test('exact match is 100 percent',()=>assert.equal(textMetrics('abc','abc',10).accuracy,100));
test('accuracy is never negative',()=>assert.equal(textMetrics('xxxxxxxx','a',10).accuracy,0));
test('mistake patterns classify backend omissions',()=>{
  const r='async function x(){ try { await y(); next(error); return {$set:{a:1}}; } catch(error){} }';
  const m=classifyMistakes('function x(){ return 1; }',r);
  assert.ok(m.includes('missing_async'));
  assert.ok(m.includes('missing_await'));
  assert.ok(m.includes('missing_error_propagation'));
  assert.ok(m.includes('missing_mongodb_operator'));
});
