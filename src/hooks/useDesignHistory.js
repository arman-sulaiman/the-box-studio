import {useState,useRef,useCallback} from 'react'
export default function useDesignHistory(initial){
 const [state,setState]=useState(()=>({past:[],present:initial,future:[]})),last=useRef({key:'',time:0})
 const change=useCallback((updater,key='change')=>{const now=Date.now(),group=last.current.key===key&&now-last.current.time<500;last.current={key,time:now};setState(s=>{const next=typeof updater==='function'?updater(s.present):updater;return {past:group?s.past:[...s.past,s.present].slice(-40),present:next,future:[]}})},[])
 const undo=useCallback(()=>{last.current={key:'',time:0};setState(s=>s.past.length?{past:s.past.slice(0,-1),present:s.past.at(-1),future:[s.present,...s.future].slice(0,40)}:s)},[])
 const redo=useCallback(()=>{last.current={key:'',time:0};setState(s=>s.future.length?{past:[...s.past,s.present].slice(-40),present:s.future[0],future:s.future.slice(1)}:s)},[])
 return {design:state.present,change,undo,redo,canUndo:!!state.past.length,canRedo:!!state.future.length}
}
