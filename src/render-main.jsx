import React from 'react'
import {createRoot} from 'react-dom/client'
import PhotocardPreview from './components/PhotocardPreview.jsx'
window.__BOX_REACT__=React
const root=createRoot(document.getElementById('root'))
window.boxRender=({data,template})=>{root.render(<PhotocardPreview data={data} template={template}/>)}
