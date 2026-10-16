import {BackgroundAreas} from './BackgroundPanel.jsx'
import React,{useRef,useLayoutEffect} from 'react'
import {BrandLogo} from './Branding.jsx'
function FitText({data:d,text,children,className=''}){
 const ref=useRef(null)
 useLayoutEffect(()=>{let active=true;const fit=()=>{if(!active)return;const el=ref.current,h=el.querySelector('h1'),p=el.querySelector('p');h.style.fontSize=`${5*d.headlineSize/100}cqw`;if(p)p.style.fontSize='2.2cqw';if(!d.autoFit)return;let size=parseFloat(getComputedStyle(h).fontSize),sub=p?parseFloat(getComputedStyle(p).fontSize):0;while(el.scrollHeight>el.clientHeight+1&&size>18){h.style.fontSize=--size+'px';if(p){sub=Math.max(15,sub-.25);p.style.fontSize=sub+'px'}}};fit();document.fonts.ready.then(fit);return()=>{active=false}},[d,text])
 const chunks=d.highlight?text.split(d.highlight):[text]
 return <div ref={ref} className={`extra-copy ${className}`} style={{textAlign:d.textAlign}}><h1 style={{fontFamily:d.fonts.headline||d.fontFamily,lineHeight:d.lineHeight/100}}>{chunks.map((s,i)=><React.Fragment key={i}>{i>0&&<em>{d.highlight}</em>}{s}</React.Fragment>)}</h1>{children&&<p style={{fontFamily:d.fonts.subheadline||d.fontFamily}}>{children}</p>}</div>
}
export default function ExtraPremiumCard({data:d,template}){
 const type=template.replace('premium-',''),font=k=>({fontFamily:d.fonts[k]||d.fontFamily}),ad=!!d.ad&&d.showAd
 const photo=(src,cls='')=>src?<img className={cls} src={src} alt="Uploaded editorial image" style={{objectPosition:`${d.photoX}% ${d.photoY}%`,transform:`scale(${d.photoZoom/100})`}}/>:<div className="extra-image-placeholder">YOUR IMAGE</div>
 return <div className={`card extra-card extra-${type} ${ad?'extra-has-ad':''}`} style={{background:d.bgColor,color:d.textColor,fontFamily:d.fontFamily,'--accent':d.accent,'--radius':`${d.radius}px`,'--extra-bottom':ad?'13%':'5%'}}>
 <BackgroundAreas data={d}/>
 <div className="premium-overlay" style={{background:`linear-gradient(${d.gradientAngle}deg,${d.overlayColor},${d.overlayEnd})`,opacity:d.overlayOpacity/100}}/>
 {d.texture!=='none'&&<div className={`premium-texture texture-${d.texture}`} style={{opacity:d.textureOpacity/100}}/>}
 <div className="extra-header"><div className="extra-logo"><BrandLogo data={d}/></div><span style={font('date')}>{d.date}</span></div>
 {type==='bulletin'&&<><div className="bulletin-tag" style={font('kicker')}><span/> {d.kicker||'BREAKING'}</div><div className="bulletin-photo">{photo(d.photo)}</div><FitText data={d} text={d.headline} className="bulletin-copy">{d.subheadline}</FitText><div className="bulletin-rule"/></>}
 {type==='cover'&&<><div className="cover-image">{photo(d.photo||d.person)}</div><div className="cover-image-shade"/><div className="cover-kicker" style={font('kicker')}>{d.kicker}</div><FitText data={d} text={d.headline} className="cover-copy">{d.subheadline}</FitText><div className="cover-byline"><strong style={font('name')}>{d.name}</strong><span style={font('role')}>{d.role}</span></div><span className="cover-edition" style={font('source')}>{d.edition}</span></>}
 {type==='comparison'&&<><div className="comparison-kicker" style={font('kicker')}>{d.kicker}</div><div className="comparison-grid"><div className="comparison-cell"><div className="comparison-photo">{photo(d.photo)}</div><FitText data={d} text={d.headline} className="comparison-copy">{d.subheadline}</FitText><span className="comparison-label" style={font('kicker')}>{d.leftLabel}</span></div><div className="comparison-cell"><div className="comparison-photo">{photo(d.extraPhoto)}</div><FitText data={d} text={d.secondHeadline} className="comparison-copy">{d.secondText}</FitText><span className="comparison-label" style={font('kicker')}>{d.rightLabel}</span></div></div></>}
 {type==='spotlight'&&<><div className="spotlight-kicker" style={font('kicker')}>{d.kicker}</div><div className="spotlight-orbit"/><div className="spotlight-value" style={{fontFamily:d.fonts.headline||d.fontFamily,fontSize:`${Math.min(23,94/Math.max(1,[...d.metric].length))}cqw`}}>{d.metric}</div><div className="spotlight-label" style={font('kicker')}>{d.metricLabel}</div><FitText data={d} text={d.headline} className="spotlight-copy">{d.subheadline}</FitText></>}
 <div className="extra-footer" style={font('source')}>{d.source}</div>
 {ad&&<div className="premium-ad"><img src={d.ad} alt="Advertisement" style={{objectFit:d.adFit}}/></div>}
 {d.watermark&&<div className="watermark" style={{bottom:ad?'10%':'1.5%'}}>Made with The BOX Studio</div>}
 </div>
}
