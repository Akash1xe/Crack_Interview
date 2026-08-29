import test from 'node:test';
import assert from 'node:assert/strict';
import { levenshtein,scoreText,classifyMistakes } from '../src/diff.js';

test('levenshtein handles insertion without cascading mismatches',()=>{
  assert.equal(levenshtein('abc','abxc'),1);
});

test('exact match receives 100 percent accuracy',()=>{
  assert.deepEqual(scoreText('const x = 1;','const x = 1;'),{errors:0,accuracy:100});
});

test('accuracy never falls below zero',()=>{
  assert.equal(scoreText('xxxxxxxxxxxxxxxx','a').accuracy,0);
});

test('mistake classifier finds common backend recall errors',()=>{
  const reference='async function run(){ next(error); return { $set: value }; }';
  const mistakes=classifyMistakes('function run(){ return value; }',reference);
  assert.ok(mistakes.includes('missing_async'));
  assert.ok(mistakes.includes('missing_mongodb_operator'));
  assert.ok(mistakes.includes('missing_error_propagation'));
});
