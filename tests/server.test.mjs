import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
const root=await mkdtemp(path.join(os.tmpdir(),'box-v10-test-'));process.env.DATA_DIR=root
const {db}=await import('../server/db.mjs');const {id,passwordHash}=await import('../server/security.mjs')
const adminId=id();db.prepare("INSERT INTO users(id,username,name,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run(adminId,'testadmin','Test Admin',await passwordHash('Admin-test-123456!'),Date.now())
const port=4381,origin=`http://localhost:${port}`;let logs=''
const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),APP_ORIGIN:origin,DATA_DIR:root},stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d)
for(let i=0;i<100;i++){try{await fetch(origin+'/');break}catch{await new Promise(r=>setTimeout(r,100))}}
function client(){let cookie='',csrf='';return {async call(url,method='GET',data){const r=await fetch(origin+url,{method,headers:{cookie,Origin:origin,...(method!=='GET'?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},...(method!=='GET'?{body:JSON.stringify(data||{})}:{})});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const body=await r.json();if(body.csrf)csrf=body.csrf;return {status:r.status,...body}},get cookie(){return cookie}}}
const admin=client(),u=client(),other=client();const key=()=>crypto.randomUUID();let uid,project
async function waitJob(jobId,owner=u){for(let i=0;i<100;i++){const r=await owner.call('/api/exports/'+jobId);if(r.job.status!=='pending')return r.job;await new Promise(r=>setTimeout(r,300))}throw Error('Render timeout\n'+logs)}
await test('authentication, access and billing integration',async t=>{
try{
 await admin.call('/api/session');assert.equal((await admin.call('/api/login','POST',{username:'testadmin',password:'Admin-test-123456!'})).status,200)
 await u.call('/api/session');let r=await u.call('/api/register','POST',{username:'member1',name:'Member One',password:'Member-test-123456!'});assert.equal(r.status,201);uid=r.user.id;assert.equal(r.user.credits,0)
 assert.equal((await fetch(origin+'/premium/render.js')).status,401);assert.equal((await fetch(origin+'/_render')).status,404);assert.equal((await fetch(origin+'/server/db.mjs')).status,404)
 assert.equal((await u.call('/api/admin/users')).status,403)
 assert.equal((await fetch(origin+'/api/projects',{method:'POST',headers:{cookie:u.cookie,Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,403)
 assert.equal((await u.call('/api/projects','POST',{template:'premium-news',data:{},requestId:key()})).status,403)
 let creditKey=key();r=await admin.call(`/api/admin/users/${uid}/credits`,'POST',{amount:100,reason:'Test recharge',requestId:creditKey});assert.equal(r.user.credits,100);r=await admin.call(`/api/admin/users/${uid}/credits`,'POST',{amount:100,reason:'Test recharge',requestId:creditKey});assert.equal(r.user.credits,100)
 assert.equal((await admin.call(`/api/admin/users/${uid}/subscription`,'POST',{endsAt:Date.now()+86400000,plan:'Monthly',reason:'Test activation'})).status,200)
 const buyKey=key();r=await u.call('/api/projects','POST',{template:'premium-news',data:{headline:'বাংলাদেশের নতুন সম্ভাবনা'},requestId:buyKey});assert.equal(r.status,201,JSON.stringify(r));assert.equal(r.user.credits,100);project=r.project
 r=await u.call('/api/projects','POST',{template:'premium-news',data:{},requestId:buyKey});assert.equal(r.project.id,project.id);assert.equal(r.user.credits,100)
 const advanced=await u.call('/api/projects','POST',{template:'premium-bulletin',data:{},requestId:key()});assert.equal(advanced.user.credits,100)
 await other.call('/api/session');await other.call('/api/register','POST',{username:'otheruser',name:'Other User',password:'Other-test-123456!'});const otherId=(await other.call('/api/session')).user.id;await admin.call(`/api/admin/users/${otherId}/subscription`,'POST',{endsAt:Date.now()+86400000,reason:'Test activation'});assert.equal((await other.call('/api/projects/'+project.id)).status,404)
 const exportKey=key();r=await u.call(`/api/projects/${project.id}/exports`,'POST',{requestId:exportKey,data:project.data,format:'png',quality:1});assert.equal(r.status,202,JSON.stringify(r));assert.equal(r.job.cost,20);const first=r.job.id;r=await u.call(`/api/projects/${project.id}/exports`,'POST',{requestId:exportKey,data:project.data,format:'png',quality:1});assert.equal(r.job.id,first)
 const done=await waitJob(first);assert.equal(done.status,'ready',logs);assert.equal((await u.call('/api/session')).user.credits,100);assert.equal((await fetch(origin+done.downloadUrl,{headers:{cookie:u.cookie}})).status,402);const firstPaid=await u.call('/api/exports/'+first+'/download','POST',{});assert.equal(firstPaid.user.credits,80);assert.equal((await u.call('/api/exports/'+first+'/download','POST',{})).user.credits,80);const download=await fetch(origin+done.downloadUrl,{headers:{cookie:u.cookie}});const png=Buffer.from(await download.arrayBuffer());assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1350)
 r=await u.call(`/api/projects/${project.id}/exports`,'POST',{requestId:key(),data:project.data,format:'jpg',quality:1});assert.equal(r.job.cost,4);assert.equal(r.user.credits,80);assert.equal((await waitJob(r.job.id)).status,'ready',logs);assert.equal((await u.call('/api/exports/'+r.job.id+'/download','POST',{})).user.credits,76)
 const broken={...project.data,photo:'data:image/png;base64,iVBORw0KGgo='};r=await u.call(`/api/projects/${project.id}/exports`,'POST',{requestId:key(),data:broken,format:'png',quality:1});assert.equal(r.user.credits,76);assert.equal((await waitJob(r.job.id)).status,'failed');assert.equal((await u.call('/api/session')).user.credits,76)
 r=await u.call(`/api/projects/${advanced.project.id}/exports`,'POST',{requestId:key(),data:broken,format:'png',quality:1});assert.equal((await waitJob(r.job.id)).status,'failed');assert.equal((await u.call('/api/projects/'+advanced.project.id)).project.includedAvailable,true)
 await admin.call(`/api/admin/users/${uid}/subscription`,'POST',{endsAt:0,reason:'Expire for test'});assert.equal((await u.call(`/api/projects/${project.id}/exports`,'POST',{requestId:key(),data:{},format:'png',quality:1})).status,403)
 await admin.call(`/api/admin/users/${uid}/status`,'POST',{status:'suspended',reason:'Suspend for test'});assert.equal((await u.call('/api/account')).status,401)
 assert.equal((await admin.call(`/api/admin/users/${adminId}/status`,'POST',{status:'suspended',reason:'Try self suspension'})).status,400)
 const mismatched=await admin.call(`/api/admin/users/${otherId}/credits`,'POST',{amount:-1,reason:'Negative wallet check',requestId:key()});assert.equal(mismatched.status,402)
 db.prepare('UPDATE users SET must_change=1 WHERE id=?').run(otherId)
 assert.equal((await other.call('/api/projects','POST',{template:'premium-news',data:{},requestId:key()})).status,403)
 const changed=await other.call('/api/password','POST',{currentPassword:'Other-test-123456!',password:'Updated-test-123456!'})
 assert.equal(changed.status,200,JSON.stringify(changed));assert.equal(changed.user.mustChange,false)
 assert.equal((await other.call('/api/account')).status,200)
 const freeDraft=await other.call('/api/projects','POST',{template:'premium-cover',data:{elements:[{type:'text',text:'Hello',x:900}]},requestId:key()});assert.equal(freeDraft.status,201);assert.equal(freeDraft.user.credits,0);assert.equal(freeDraft.project.data.elements[0].x,95)
 assert.equal((await other.call('/api/projects/'+freeDraft.project.id+'/exports','POST',{requestId:key(),data:{},format:'png',quality:1})).status,402)
 // A v9 prepaid project retains its included first export.
 const legacy=id();db.prepare('INSERT INTO projects(id,user_id,template,title,content,included_available,purchase_cost,request_key,created_at,updated_at,billing_version) VALUES(?,?,?,?,?,1,25,?,?,?,1)').run(legacy,otherId,'premium-cover','Legacy',JSON.stringify(freeDraft.project.data),key(),Date.now(),Date.now());const legacyJob=await other.call('/api/projects/'+legacy+'/exports','POST',{requestId:key(),data:freeDraft.project.data,format:'png',quality:1});assert.equal(legacyJob.job.cost,0);assert.equal((await waitJob(legacyJob.job.id,other)).status,'ready');assert.equal((await other.call('/api/exports/'+legacyJob.job.id+'/download','POST',{})).user.credits,0)
 const cancelDraft=await admin.call('/api/projects','POST',{template:'premium-news',data:{},requestId:key()});const cancelJob=await admin.call('/api/projects/'+cancelDraft.project.id+'/exports','POST',{requestId:key(),data:{},format:'png',quality:1});assert.equal((await waitJob(cancelJob.job.id,admin)).status,'ready');assert.equal((await admin.call('/api/exports/'+cancelJob.job.id+'/cancel','POST',{})).status,200);assert.equal((await admin.call('/api/exports/'+cancelJob.job.id+'/download','POST',{})).status,409)
 assert.equal((await admin.call('/api/admin/insights')).status,200)
 assert.equal((await other.call('/api/admin/insights')).status,403)
 console.log('PASS: auth, CSRF, ownership, subscription enforcement, free editing, first-download 20/4 pricing and v9 compatibility, idempotency, PNG/JPG, refunds, suspension and balance constraints.')
}finally{server.kill();db.close();await new Promise(r=>setTimeout(r,300));await rm(root,{recursive:true,force:true})}})
