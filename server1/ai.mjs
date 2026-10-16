import sharp from 'sharp'
import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
import path from 'node:path'
import {fail} from './security.mjs'
const localPython=()=>process.env.AI_PYTHON||path.resolve(process.platform==='win32'?'.ai-venv/Scripts/python.exe':'.ai-venv/bin/python')
let active=0
export function aiStatus(){return {local:existsSync(localPython()),gemini:!!process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL||'gemini-3.8-flash'}}
// Gemini 3.x returns polygon contour masks (normalized 0..1000 within each box),
// rather than the base64 PNG masks expected by the original 10.1.0 release.
const currentGeminiModel=()=>process.env.GEMINI_MODEL||'gemini-3.8-flash'
const segmentationSchema={
  type:'OBJECT',
  properties:{boxes:{type:'ARRAY',items:{
    type:'OBJECT',
    properties:{
      box_2d:{type:'ARRAY',items:{type:'INTEGER'}},
      mask:{type:'ARRAY',items:{type:'ARRAY',items:{type:'INTEGER'}}},
      label:{type:'STRING'}
    },
    required:['box_2d','mask','label']
  }}},
  required:['boxes']
}
export async function geminiMasks(bytes,fetcher=fetch){
  const response=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentGeminiModel())}:generateContent`,{
    method:'POST',signal:AbortSignal.timeout(90000),
    headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
    body:JSON.stringify({
      contents:[{role:'user',parts:[
        {text:'Segment ONLY the main foreground person, including hair, ears, neck, body and clothing. Exclude the entire background. Return a JSON object with one boxes entry for the main person: box_2d=[ymin,xmin,ymax,xmax] normalized 0-1000 for the full image, mask=[[x,y],...] as a closed foreground contour polygon with each x/y normalized 0-1000 relative to that bounding box, label="person". Follow the visible silhouette carefully. Do not output prose or a base64 PNG.'},
        {inline_data:{mime_type:'image/png',data:bytes.toString('base64')}}
      ]}],
      generationConfig:{
        responseMimeType:'application/json',
        responseSchema:segmentationSchema,
        thinkingConfig:{thinkingLevel:'low'},
        maxOutputTokens:16000
      }
    })
  });
  if(!response.ok){
    // Avoid displaying the key, source image or raw provider response in UI/logs.
    if(response.status===429)fail(429,'Gemini quota reached. Try local AI or wait.');
    if(response.status===404)fail(502,`Gemini model ${currentGeminiModel()} is unavailable for your API project. Check model access and .env.`);
    if(response.status===403||response.status===401)fail(502,'Gemini API access denied. Check your private key, restrictions and project permissions.');
    if(response.status===400)fail(502,'Gemini rejected the segmentation request (HTTP 400). Check model support and API settings.');
    fail(502,`Gemini request failed (HTTP ${response.status}). Check Google AI Studio quota and service status.`)
  }
  let body;
  try{body=await response.json()}catch{fail(502,'Gemini returned an invalid response. Try local AI.')}
  const text=body.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
  let parsed;
  try{parsed=JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,''))}catch{fail(502,'Gemini did not return valid segmentation JSON. Try local AI.')}
  const masks=Array.isArray(parsed)?parsed:parsed?.boxes;
  if(!Array.isArray(masks)||!masks.length||masks.length>10)fail(502,'No usable person mask returned. Try local AI.');
  return masks
}
function maskBox(item,width,height){
  const b=item?.box_2d;
  if(!Array.isArray(b)||b.length!==4||!b.every(n=>Number.isFinite(n)&&n>=0&&n<=1000)||b[2]<=b[0]||b[3]<=b[1])fail(502,'Invalid AI mask bounds.');
  const y=Math.floor(b[0]/1000*height),x=Math.floor(b[1]/1000*width);
  const h=Math.max(1,Math.min(height-y,Math.ceil((b[2]-b[0])/1000*height)));
  const w=Math.max(1,Math.min(width-x,Math.ceil((b[3]-b[1])/1000*width)));
  return {x,y,w,h}
}
export async function applyMasks(bytes,masks){
  const {data:rgba,info}=await sharp(bytes,{limitInputPixels:12000000}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width,height}=info;
  const alpha=Buffer.alloc(width*height);
  const polygons=[];
  for(const item of masks){
    const {x,y,w,h}=maskBox(item,width,height);
    if(Array.isArray(item.mask)){
      const pts=item.mask;
      if(pts.length<3||pts.length>5000)fail(502,'Invalid AI polygon contour.');
      const mapped=pts.map(point=>{
        if(!Array.isArray(point)||point.length!==2||!point.every(n=>Number.isFinite(n)&&n>=0&&n<=1000))fail(502,'Invalid AI polygon coordinate.');
        const px=x+(point[0]/1000)*w, py=y+(point[1]/1000)*h;
        return `${px.toFixed(2)},${py.toFixed(2)}`
      }).join(' ');
      polygons.push(`<polygon points="${mapped}" fill="white"/>`)
    }else if(typeof item.mask==='string'){
      // Continue accepting old PNG masks in controlled mock tests or older providers.
      const value=item.mask.replace(/^data:image\/png;base64,/,'');
      if(value.length>8000000||!/^[\w+/=\s]+$/.test(value))fail(502,'Invalid AI mask data.');
      const mask=Buffer.from(value,'base64');
      if(!mask.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))fail(502,'AI returned a non-PNG mask.');
      const m=await sharp(mask,{limitInputPixels:12000000}).resize(w,h).removeAlpha().greyscale().raw().toBuffer();
      for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
        const idx=(y+yy)*width+x+xx;
        alpha[idx]=Math.max(alpha[idx],m[yy*w+xx])
      }
    }else fail(502,'Invalid AI mask data.')
  }
  if(polygons.length){
    // Sharp rasterizes the SVG contour into antialiased alpha while foreground RGB stays unchanged.
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${polygons.join('')}</svg>`;
    const polygonAlpha=await sharp(Buffer.from(svg),{limitInputPixels:12000000}).extractChannel('alpha').raw().toBuffer();
    for(let i=0;i<alpha.length;i++)alpha[i]=Math.max(alpha[i],polygonAlpha[i]);
  }
  for(let i=0;i<alpha.length;i++)rgba[i*4+3]=Math.round(rgba[i*4+3]*alpha[i]/255);
  return sharp(rgba,{raw:info}).png().toBuffer()
}
function localRemove(bytes){return new Promise((resolve,reject)=>{const child=spawn(localPython(),['server/remove-background.py'],{stdio:['pipe','pipe','pipe'],env:{...process.env,OMP_NUM_THREADS:'2'}});const chunks=[];let length=0,error='';const timer=setTimeout(()=>{child.kill();reject(Error('Local AI timed out. Try a smaller image or check model installation.'))},120000);child.on('error',()=>{clearTimeout(timer);reject(Error('Local AI is not installed. Run npm run ai:setup.'))});child.stdout.on('data',b=>{length+=b.length;if(length>24*1024*1024)child.kill();else chunks.push(b)});child.stderr.on('data',b=>{error=(error+b.toString()).slice(-1000)});child.on('close',code=>{clearTimeout(timer);if(code!==0)reject(Error('Local AI could not process the image. Check the AI setup and model cache.'));else resolve(Buffer.concat(chunks))});child.stdin.on('error',()=>{});child.stdin.end(bytes)})}
export async function removeBackground(input){if(active>=2)fail(429,'AI is busy. Please try again shortly.');const provider=input.provider;if(!['local','gemini'].includes(provider))fail(400,'Choose an AI provider.');if(!aiStatus()[provider])fail(503,provider==='local'?'Local AI is not installed. Ask the admin to run npm run ai:setup.':'Gemini is not configured. Ask the admin to set GEMINI_API_KEY.');const match=/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(String(input.image||''));if(!match||match[2].length>12000000)fail(400,'Choose a PNG, JPG or WebP below 8 MB.');active++;try{const bytes=await sharp(Buffer.from(match[2],'base64'),{limitInputPixels:12000000}).rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).png().toBuffer();const output=provider==='local'?await localRemove(bytes):await applyMasks(bytes,await geminiMasks(bytes));await sharp(output,{limitInputPixels:12000000}).metadata();if(output.length>8*1024*1024)fail(413,'The transparent PNG is too large. Resize your source photo and try again.');return {image:'data:image/png;base64,'+output.toString('base64'),provider}}catch(e){if(e.status)throw e;fail(502,e.message.startsWith('Local AI')?e.message:'Background removal failed. Try another image or use manual cleanup.')}finally{active--}}
