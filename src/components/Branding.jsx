import React from 'react'
export function BoxWordmark(){return <span className="box-default-mark"><small>THE</small><b>BOX<span className="box-mark-dot">.</span></b><small>STUDIO</small></span>}
export function BrandLogo({data:d}){return <span className="brand-logo-content" style={{transform:`translate(${d.logoX||0}px, ${d.logoY||0}px) scale(${(d.logoScale||100)/100})`,opacity:(d.logoOpacity??100)/100}}>{d.logo?<img src={d.logo} alt="Brand logo"/>:<BoxWordmark/>}</span>}
export function SideBrand({data:d}){
 if(!d.sideEnabled)return null
 const icon=d.sideIcon||d.logo
 const symbol=<>{icon?<img src={icon} alt="Brand icon" style={{width:`${d.sideIconSize}%`,opacity:d.sideOpacity/100}}/>:<span className="side-box-icon" style={{opacity:d.sideOpacity/100}}>B<span>□</span></span>}</>
 return <aside className={`side-brand side-${d.sideStyle}`} style={{[d.sidePosition]:0,width:`${d.sideWidth}%`,background:d.sideColor,color:d.sideTextColor}}>
 {['curve','ribbon','medallion'].includes(d.sideStyle)&&<svg className="side-sculpture" viewBox="0 0 100 1000" preserveAspectRatio="none"><path d={d.sideStyle==='ribbon'?'M0 0H100V1000H0Q100 760 22 520T0 0':'M0 0H100V1000H0C95 800 95 650 32 510C-25 370 0 220 0 0'} fill={d.sideAccent} opacity=".24"/></svg>}
 {d.sideStyle==='repeat'?Array.from({length:d.sideCount},(_,i)=><div className="side-repeat-item" key={i}>{symbol}</div>):<><div className="side-single-icon">{symbol}</div>{d.sideLabel&&<span className="side-label">{d.sideLabel}</span>}<div className="side-bottom-rule"/></>}
 </aside>
}
