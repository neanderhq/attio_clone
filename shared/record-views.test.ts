import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectRecords, type ViewRecord } from './record-views';
const rows:ViewRecord[]=[
 {id:'1',name:'Zeta',company:'Acme',person:'Morgan',email:'',domain:'zeta.example',stage:'Lead',value:12000,owner:'Lee',currency:'USD',description:'Research',people:2,deals:1},
 {id:'2',name:'Alpha',company:'Beta',email:'a@example.test',domain:'',stage:'Won',value:900,owner:'Jo',currency:'EUR',description:'',people:10,deals:0},
];
test('search matches authorized loaded relationship and contact fields, ignoring case and whitespace',()=>{
 assert.deepEqual(selectRecords(rows,{query:' ACME ',filter:'all',sort:'name',direction:1}).map(x=>x.id),['1']);
 assert.deepEqual(selectRecords(rows,{query:'example.test',filter:'all',sort:'name',direction:1}).map(x=>x.id),['2']);
 assert.deepEqual(selectRecords(rows,{query:'MORGAN',filter:'all',sort:'name',direction:1}).map(x=>x.id),['1']);
 assert.equal(selectRecords(rows,{query:'missing',filter:'all',sort:'name',direction:1}).length,0);
});
test('filters retain only matching fields or deal stages',()=>{
 assert.deepEqual(selectRecords(rows,{query:'',filter:'no-email',sort:'name',direction:1}).map(x=>x.id),['1']);
 assert.deepEqual(selectRecords(rows,{query:'',filter:'has-domain',sort:'name',direction:1}).map(x=>x.id),['1']);
 assert.deepEqual(selectRecords(rows,{query:'',filter:'stage:Won',sort:'name',direction:1}).map(x=>x.id),['2']);
});
test('numeric sorts compare numbers and do not mutate source records',()=>{
 assert.deepEqual(selectRecords(rows,{query:'',filter:'all',sort:'people',direction:-1}).map(x=>x.id),['2','1']);
 assert.deepEqual(selectRecords(rows,{query:'',filter:'all',sort:'value',direction:1}).map(x=>x.id),['2','1']);
 assert.deepEqual(rows.map(x=>x.id),['1','2']);
});
