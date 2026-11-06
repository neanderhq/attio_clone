// Run only against a NEW dedicated baseline database after schema migrations.
import {POST} from '../app/api/template-launch/route';
async function main(){
if(!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.startsWith('/poc_baseline_'))throw new Error('Use a dedicated baseline database');
const response=await POST(new Request('http://localhost/api/template-launch',{method:'POST',headers:{authorization:`Bearer ${process.env.POC_LAUNCH_SECRET}`},body:JSON.stringify({projectId:'00000000-0000-4000-8000-000000000001'})}));
if(!response.ok)throw new Error('Baseline publication failed');
console.log('Published prepared sample data');
process.exit(0);
}
main().catch(()=>{console.error('Baseline publication failed');process.exit(1);});
