/** View-only values derived from the current workspace's authorized CRM response. */
export type ViewRecord = {
 id:string; name:string; company:string; person?:string; email:string; domain:string; description:string;
 stage:string; owner:string; value:number; currency:string; people:number; deals:number;
};
export type RecordView = {query:string; filter:string; sort:keyof ViewRecord; direction:1|-1};
export function selectRecords(records:ViewRecord[],view:RecordView):ViewRecord[]{
 const query=view.query.trim().toLocaleLowerCase();
 return records.filter(record=>{
  if(query && ![record.name,record.company,record.person||'',record.email,record.domain,record.description,record.stage,record.owner].some(value=>value.toLocaleLowerCase().includes(query)))return false;
  switch(view.filter){
   case 'has-email':return !!record.email;
   case 'no-email':return !record.email;
   case 'has-domain':return !!record.domain;
   case 'no-domain':return !record.domain;
   default:return !view.filter.startsWith('stage:')||record.stage===view.filter.slice(6);
  }
 }).sort((a,b)=>{
  const left=a[view.sort],right=b[view.sort];
  return (typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right),undefined,{numeric:true}))*view.direction;
 });
}
