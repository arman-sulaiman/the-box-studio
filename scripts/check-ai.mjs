import {existsSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import path from 'node:path'
import {aiStatus,removeBackground} from '../server/ai.mjs'
import sharp from 'sharp'
const status=aiStatus()
console.log('The BOX Studio • AI configuration check')
console.log('Gemini:',status.gemini?'key configured (not displayed; quota and permissions unverified)':'not configured')
console.log('Gemini model:',status.model)
console.log('Local Python:',status.local?'found':'missing — run npm run ai:setup')
if(status.local){const python=process.env.AI_PYTHON||path.resolve(process.platform==='win32'?'.ai-venv/Scripts/python.exe':'.ai-venv/bin/python');const r=spawnSync(python,['-c',"import importlib.util, os; from pathlib import Path; ok=all(importlib.util.find_spec(x) is not None for x in ['rembg','onnxruntime']); model=Path(os.environ.get('U2NET_HOME',str(Path.home()/'.u2net')))/'u2netp.onnx'; print('Python packages:', 'installed' if ok else 'missing'); print('Model cache:', 'found' if model.is_file() else 'missing — run npm run ai:setup'); raise SystemExit(0 if ok and model.is_file() else 1)"],{stdio:'inherit',timeout:15000});if(r.status!==0)process.exitCode=1}
const provider=process.argv.find(a=>a.startsWith('--provider='))?.split('=')[1],file=process.argv.find(a=>a.startsWith('--image='))?.slice(8)
if(provider||file){if(!['local','gemini'].includes(provider)||!file||!existsSync(file)){console.error('Usage: npm run ai:check -- --provider=local --image=/path/to/person.jpg');process.exitCode=1}else{try{console.log(provider==='gemini'?'Sending the specified image to Google for this explicit test.':'Testing local inference on the specified image.');const bytes=await sharp(file,{limitInputPixels:12000000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).png().toBuffer();const result=await removeBackground({provider,image:'data:image/png;base64,'+bytes.toString('base64')});const output=Buffer.from(result.image.split(',')[1],'base64');const meta=await sharp(output).metadata();console.log(`PASS: ${meta.width} × ${meta.height} PNG; alpha channel: ${meta.hasAlpha}. Test output kept in memory only; inspect the cutout in the studio to judge quality.`)}catch(e){console.error('FAIL:',e.message);process.exitCode=1}}}else console.log('No inference performed. To test one of your own images, supply --provider and --image. See AI-SETUP.md.')
