import test from 'node:test';
import assert from 'node:assert/strict';
import { issueAccess,issueRefresh,verifyAccess,verifyRefresh } from '../src/auth.js';

process.env.JWT_ACCESS_SECRET='test-access-secret';
process.env.JWT_REFRESH_SECRET='test-refresh-secret';

const user={id:'dev-user',username:'akash'};

test('access tokens verify with access verifier',()=>{
  const token=issueAccess(user);
  assert.equal(verifyAccess(token).sub,'dev-user');
});

test('refresh tokens verify with refresh verifier',()=>{
  const token=issueRefresh(user);
  assert.equal(verifyRefresh(token).username,'akash');
});

test('refresh token is rejected as access token',()=>{
  assert.throws(()=>verifyAccess(issueRefresh(user)));
});
