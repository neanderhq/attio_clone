import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestProjectId} from '../worker-project-db.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('project selector comes only from launch or the project cookie',async()=>{
 assert.equal(await requestProjectId(new Request('https://app.test/api/template-launch?project='+id)),id);
 assert.equal(await requestProjectId(new Request('https://app.test/api/crm?project='+id)),null);
 assert.equal(await requestProjectId(new Request('https://app.test/api/crm',{headers:{cookie:'template_project='+id}})),id);
 assert.equal(await requestProjectId(new Request('https://app.test/api/template-launch',{method:'POST',body:JSON.stringify({projectId:id})})),id);
 assert.equal(await requestProjectId(new Request('https://app.test/api/template-launch?project=invalid')),null);
});
