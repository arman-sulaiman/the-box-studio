import {BackgroundAreas} from './BackgroundPanel.jsx'
import React,{forwardRef,useRef,useLayoutEffect} from 'react'
import {BrandLogo} from './Branding.jsx'
const PremiumCard=forwardRef(function PremiumCard({data:d,template},ref){
 const copyRef=useRef(null)
 useLayoutEffect(()=>{let live=true;const fit=()=>{if(!live||!copyRef.current)return;const box=copyRef.current,card=box.parentElement,h=box.querySelector('h1'),sub=box.querySelector('p');h.style.fontSize=`${(template==='premium-news'?4.4:5.2)*d.headlineSize/100}cqw`;if(sub)sub.style.fontSize='2.25cqw';if(!d.autoFit)return;const limit=card.clientHeight*(template==='premium-news'?.23:template==='premium-quote'?.30:.29);let size=parseFloat(getComputedStyle(h).fontSize),ss=sub?parseFloat(getComputedStyle(sub).fontSize):0;while(box.offsetHeight>limit&&size>20){size-=1;h.style.fontSize=size+'px';if(sub){ss=Math.max(16,ss-.25);sub.style.fontSize=ss+'px'}}};fit();document.fonts.ready.then(fit);return()=>{live=false}},[d,template])
 const simple=template==='premium-news',quote=template==='premium-quote',person=quote||template==='premium-person'
 const font=k=>({fontFamily:d.fonts[k]||d.fontFamily})
 const highlight=()=>d.highlight?d.headline.split(d.highlight).map((s,i)=><React.Fragment key={i}>{i>0&&<em style={{color:d.accent,fontStyle:'normal'}}>{d.highlight}</em>}{s}</React.Fragment>):d.headline
 return <div ref={ref} className={`card premium-card ${template} ${d.ad&&d.showAd?'has-ad':''}`} style={{aspectRatio:d.aspect,background:d.bgColor,color:d.textColor,fontFamily:d.fontFamily,'--accent':d.accent,'--radius':`${d.radius}px`}}>
 <BackgroundAreas data={d}/>
 <div className="premium-overlay" style={{background:`linear-gradient(${d.gradientAngle}deg,${d.overlayColor},${d.overlayEnd})`,opacity:d.overlayOpacity/100}}/>
 {d.texture!=='none'&&<div className={`premium-texture texture-${d.texture}`} style={{opacity:d.textureOpacity/100}}/>}
 <header className="premium-header"><div className="premium-logo"><BrandLogo data={d}/></div>{!simple&&<div className="premium-source" style={font('source')}>{d.source}</div>}{simple&&<div style={font('date')}>{d.date}</div>}</header>
 {simple&&<><div className="simple-meta" style={font('kicker')}>{d.kicker}</div><div className="simple-photo">{d.photo?<img src={d.photo} style={{objectPosition:`${d.photoX}% ${d.photoY}%`,transform:`scale(${d.photoZoom/100})`}}/>:<div className="image-placeholder">Upload your content image</div>}</div>{d.smallLogo&&<img className="small-logo" style={{transform:`scale(${d.smallLogoScale/100})`}} src={d.smallLogo} alt="Secondary logo"/>}</>}
 <div ref={copyRef} className={`premium-copy holder-${d.holder}`} style={{textAlign:d.textAlign,...(quote?{background:d.holderColor,color:d.holderText,border:`${d.outline}px solid ${d.accent}`,boxShadow:`8px 8px 0 ${d.accent}55`}:{}),transform:`translateY(${d.copyY}px)`}}>
 {!simple&&!quote&&d.kicker&&<div className="premium-kicker" style={font('kicker')}>{d.kicker}</div>}
 <h1 style={{...font('headline'),fontSize:`${(simple?4.4:5.2)*d.headlineSize/100}cqw`,lineHeight:d.lineHeight/100}}>{highlight()}</h1>
 {d.subheadline&&<p style={font('subheadline')}>{d.subheadline}</p>}
 </div>
 {person&&d.person&&<img className="premium-person-image" src={d.person} alt="Person cutout" style={{width:`${d.personScale}%`,left:`${d.personX}%`,bottom:`${d.personY}%`,filter:d.glowStyle==='none'?'none':d.glowStyle==='neon'?`drop-shadow(0 0 ${d.personGlow/2}px ${d.glowColor}) drop-shadow(0 0 ${d.personGlow}px ${d.glowColor})`:d.glowStyle==='outline'?`drop-shadow(2px 0 0 ${d.glowColor}) drop-shadow(-2px 0 0 ${d.glowColor}) drop-shadow(0 2px 0 ${d.glowColor}) drop-shadow(0 -2px 0 ${d.glowColor})`:d.glowStyle==='shadow'?`drop-shadow(12px 16px ${d.personGlow}px rgba(0,0,0,${d.personShadow/100}))`:`drop-shadow(0 0 ${d.personGlow}px ${d.glowColor})`}}/>}
 {quote&&<div className="premium-byline"><strong style={font('name')}>{d.name}</strong><span style={font('role')}>{d.role}</span><small style={font('date')}>{d.date}</small></div>}
 {simple&&d.source&&<div className="simple-source" style={font('source')}>{d.source}</div>}
 {d.ad&&d.showAd&&<div className="premium-ad"><img src={d.ad} alt="Advertisement" style={{objectFit:d.adFit}}/></div>}
 {d.watermark&&<div className="watermark">Made with The BOX Studio</div>}
 </div>
})
export default PremiumCard
