import {spawnSync} from 'node:child_process'
import path from 'node:path'
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
run(process.env.PYTHON|| (process.platform==='win32'?'python':'python3'),['-m','venv','.ai-venv'])
const python=path.resolve(process.platform==='win32'?'.ai-venv/Scripts/python.exe':'.ai-venv/bin/python')
run(python,['-m','pip','install','rembg[cpu]==2.0.67'])
run(python,['-c',"import onnxruntime as ort; ort.disable_telemetry_events(); from rembg import new_session; new_session('u2netp'); print('Local AI is ready. Restart the studio server.')"])
