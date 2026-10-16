import {build} from 'esbuild'
import {rm,mkdir,writeFile,copyFile,cp} from 'node:fs/promises'
import path from 'node:path'
await rm('dist',{recursive:true,force:true});await mkdir('dist/assets',{recursive:true});await mkdir('server/private',{recursive:true})
const common={bundle:true,minify:true,define:{'process.env.NODE_ENV':'"production"'},target:['es2022'],legalComments:'linked',external:['/premium/render.js','/assets/*']}
await build({...common,entryPoints:['src/main.jsx'],outdir:'dist/assets',entryNames:'app',assetNames:'[name]-[hash]',loader:{'.woff':'file','.woff2':'file'}})
await build({...common,entryPoints:['src/premium-entry.jsx'],format:'esm',outfile:'server/private/premium.js',alias:{react:path.resolve('src/react-bridge.js')}})
await build({...common,entryPoints:['src/render-main.jsx'],outfile:'server/private/render-page.js'})
await cp('public','dist/assets',{recursive:true})
await writeFile('dist/index.html','<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#151922"><title>The BOX Studio · Premium Creative Studio</title><link rel="icon" href="./assets/box-mark.svg"><link rel="stylesheet" href="./assets/app.css"></head><body><div id="root"></div><script type="module" src="./assets/app.js"></script></body></html>')
await writeFile('server/private/render.html','<!doctype html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="/assets/app.css"></head><body style="margin:0;width:1080px;background:transparent"><div id="root"></div><script src="/_render.js"></script></body></html>')
console.log('Built public editor + protected premium renderer. Start with npm start.')
