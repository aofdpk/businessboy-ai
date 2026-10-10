// Local-only PostgreSQL integration adapter; never connects to production or exposes secrets.
const {PGlite}=require('@electric-sql/pglite'),neonModule=require('@neondatabase/serverless'),Module=require('node:module'),crypto=require('node:crypto');
function setup(){
  const database=new PGlite(),originalLoad=Module._load;
  process.env.STUDENT_STORY_DATABASE_URL='postgres://qa:qa@localhost/ep3_test';
  process.env.STUDENT_STORY_SECRET='local-ep3-test-only';
  const real=neonModule.neon(process.env.STUDENT_STORY_DATABASE_URL);
  const params=q=>q.queryData.toParameterizedQuery();
  const sql=(...args)=>{const q=real(...args);q.execute=async()=>{const p=params(q);return (await database.query(p.query,p.params)).rows;};return q;};
  sql.transaction=queries=>database.transaction(async tx=>{const results=[];for(const q of queries){const p=params(q);results.push((await tx.query(p.query,p.params)).rows);}return results;});
  Module._load=function(id,parent,main){if(id==='@neondatabase/serverless')return {...neonModule,neon:()=>sql};return originalLoad.call(this,id,parent,main);};
  const handler=require('../api/homework-ep3');Module._load=originalLoad;
  const exp=String(Date.now()+3600000),digest=require('../api/_student-story-admin-config').digest;
  const signature=crypto.createHmac('sha256',process.env.STUDENT_STORY_SECRET).update('admin:'+exp+':'+digest).digest('base64url');
  return {database,handler,cookie:'businessboy_student_story_admin='+exp+'.'+signature};
}
module.exports={setup};
