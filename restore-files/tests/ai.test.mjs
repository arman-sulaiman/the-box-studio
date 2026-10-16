import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const temp=await mkdtemp(join(tmpdir(),'box-mask-test-'));process.env.DATA_DIR=temp
const {applyMasks,geminiMasks}=await import('../server/ai.mjs')
test('AI mask pipeline preserves pixels and creates real transparent PNG',async()=>{const photo=await sharp({create:{width:10,height:10,channels:4,background:'#ff0000'}}).png().toBuffer(),mask=await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer();const response=[{box_2d:[200,200,800,800],mask:mask.toString('base64'),label:'person'}];const result=await geminiMasks(photo,async(url,options)=>{assert.match(url,/generateContent$/);const req=JSON.parse(options.body);assert.equal(req.generationConfig.thinkingConfig.thinkingLevel,'low');return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(response)}]}}]})}});const output=await applyMasks(photo,result);const {data,info}=await sharp(output).raw().toBuffer({resolveWithObject:true});assert.equal(info.channels,4);assert.equal(data[3],0);assert.equal(data[(5*10+5)*4],255);assert.equal(data[(5*10+5)*4+3],255);await assert.rejects(applyMasks(photo,[{box_2d:[-1,0,1000,1000],mask:'bad'}]));await assert.rejects(geminiMasks(photo,async()=>({ok:false,status:429})),/quota/);await rm(temp,{recursive:true,force:true})})

test('Gemini 3.8 polygon masks create transparent PNG without repainting foreground',async()=>{
  const photo=await sharp({create:{width:100,height:100,channels:4,background:'#00ff00'}}).png().toBuffer();
  const payload={boxes:[{box_2d:[100,100,900,900],mask:[[0,0],[1000,0],[1000,1000],[0,1000]],label:'person'}]};
  const masks=await geminiMasks(photo,async(url,options)=>{
    assert.match(url,/gemini-3\.8-flash:generateContent$/);
    const request=JSON.parse(options.body);
    assert.equal(request.generationConfig.thinkingConfig.thinkingLevel,'low');
    assert.equal(request.generationConfig.responseMimeType,'application/json');
    return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(payload)}]}}]})};
  });
  const out=await applyMasks(photo,masks);
  const {data,info}=await sharp(out).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.channels,4);
  assert.equal(data[3],0);
  const center=(50*100+50)*4;
  assert.equal(data[center],0);
  assert.equal(data[center+1],255);
  assert.equal(data[center+3],255);
  await assert.rejects(applyMasks(photo,[{box_2d:[0,0,1000,1000],mask:[[0,0],[500,500],[1001,800]],label:'person'}]),/Invalid AI polygon coordinate/);
});
