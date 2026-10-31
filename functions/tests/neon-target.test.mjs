import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNeonTarget} from '../scripts/lib/neon-target.mjs';
const fixture=()=>({projectId:'project',branch:'production',branchInfo:{id:'branch-production',name:'production',project_id:'project'},
 endpoints:[{project_id:'project',branch_id:'branch-production',type:'read_write',host:'ep-example.region.aws.neon.tech'}],
 directOptions:{host:'ep-example.region.aws.neon.tech',database:'database',user:'migration',password:'fixture-secret'},
 pooledOptions:{host:'ep-example-pooler.region.aws.neon.tech',database:'database',user:'migration',password:'fixture-secret'}});
test('matching direct/pooled endpoints are tied to actual Neon project and branch',()=>{
 assert.doesNotThrow(()=>assertNeonTarget(fixture()));
});
test('an environment label cannot redirect migration into a different branch or project',()=>{
 for(const change of [value=>{value.branchInfo.name='qa';},value=>{value.branchInfo.project_id='other';},value=>{value.endpoints[0].branch_id='qa';},value=>{value.endpoints[0].type='read_only';}]){
  const value=fixture();change(value);assert.throws(()=>assertNeonTarget(value),/NEON_(?:CONTEXT|ENDPOINT_BRANCH)_MISMATCH/);
 }
});
test('mismatched pooled credentials or database are rejected without exposing secrets',()=>{
 for(const field of ['host','database','user','password']){
  const value=fixture();value.pooledOptions[field]='different';
  assert.throws(()=>assertNeonTarget(value),error=>error.message==='NEON_POOLED_DIRECT_MISMATCH'&&!error.message.includes('fixture-secret'));
 }
 const value=fixture();value.directOptions.host=value.pooledOptions.host;
 assert.throws(()=>assertNeonTarget(value),/NEON_DIRECT_ENDPOINT_REQUIRED/);
});
