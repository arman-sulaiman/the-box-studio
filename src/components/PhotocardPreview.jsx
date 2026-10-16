import {BackgroundAreas} from './BackgroundPanel.jsx'
import React, { forwardRef,lazy,Suspense } from 'react'
const PremiumArtwork=lazy(()=>import('/premium/render.js'))
import {ElementLayers} from './Elements.jsx'
import {BrandLogo} from './Branding.jsx'

const fallbackPhoto = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <rect width="900" height="1200" fill="#d9dde7"/>
  <circle cx="450" cy="370" r="170" fill="#a8afbf"/>
  <rect x="200" y="590" width="500" height="430" rx="210" fill="#a8afbf"/>
</svg>`)

function AccentText({ text, marker, accent }) {
  if (!marker || !text?.includes(marker)) return text
  const parts = text.split(marker)
  return parts.map((part, index) => (
    <React.Fragment key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 && <span style={{ color: accent }}>{marker}</span>}
    </React.Fragment>
  ))
}

function PhotoFrame({ wrapperClass, imageClass, shapeClass, photo, photoStyle }) {
  return (
    <div className={`${wrapperClass} photo-shell ${shapeClass}`}>
      <img src={photo} alt="subject" className={`${imageClass} adjustable-photo`} style={photoStyle} />
    </div>
  )
}

const CardArtwork = forwardRef(function CardArtwork({ data, template }, ref) {
  if (template.startsWith('premium-')) return <Suspense fallback={<div className="premium-loading">Loading premium studio…</div>}><PremiumArtwork data={data} template={template}/></Suspense>
  const photo = data.photo || fallbackPhoto
  const logo = data.logo
  const headlineStyle = {
    fontFamily: data.fonts?.headline || data.fontFamily,
    fontSize: `calc(${({"blue-quote":4.6,"red-news":5.2,"clean-editorial":4.5,"split-story":4.2})[template] || 4.6}cqw * ${data.headlineSize / 100})`,
    lineHeight: data.lineHeight / 100,
    textAlign: data.textAlign,
  }
  const photoStyle = {
    objectPosition: `${data.photoX}% ${data.photoY}%`,
    transform: `scale(${data.photoZoom / 100})`,
  }
  const shapeClass = `shape-${data.photoShape || 'soft-curve'}`
  const headline = <AccentText text={data.headline} marker={data.highlight} accent={data.accent} />

  if (template === 'red-news') {
    return (
      <div className="card card-red" ref={ref} style={{ fontFamily: data.fontFamily, '--accent': data.accent, aspectRatio: data.aspect, '--font-date': data.fonts?.date || data.fontFamily, '--font-kicker': data.fonts?.kicker || data.fontFamily, '--font-sub': data.fonts?.subheadline || data.fontFamily, '--font-name': data.fonts?.name || data.fontFamily, '--font-role': data.fonts?.role || data.fontFamily }}>
        <BackgroundAreas data={data}/><div className="topbar">
          <div className="brandmark"><BrandLogo data={data}/></div>
          <div className="date-pill">{data.date}</div>
        </div>
        <div className="red-grid" />
        <div className="red-ribbon" />
        <div className="red-content">
          <div className="eyebrow">{data.kicker}</div>
          <h1 style={headlineStyle}>{headline}</h1>
          <p>{data.subheadline}</p>
        </div>
        <PhotoFrame wrapperClass="red-photo-wrap" imageClass="red-photo" shapeClass={shapeClass} photo={photo} photoStyle={photoStyle} />
        <div className="red-footer">
          <strong>{data.name}</strong>
          <span>{data.role}</span>
        </div>
        {data.watermark && <div className="watermark">Made with The BOX Studio</div>}
      </div>
    )
  }

  if (template === 'clean-editorial') {
    return (
      <div className="card card-clean" ref={ref} style={{ fontFamily: data.fontFamily, '--accent': data.accent, aspectRatio: data.aspect, '--font-date': data.fonts?.date || data.fontFamily, '--font-kicker': data.fonts?.kicker || data.fontFamily, '--font-sub': data.fonts?.subheadline || data.fontFamily, '--font-name': data.fonts?.name || data.fontFamily, '--font-role': data.fonts?.role || data.fontFamily }}>
        <BackgroundAreas data={data}/><div className="clean-header">
          <div className="clean-logo"><BrandLogo data={data}/></div>
          <span>{data.date}</span>
        </div>
        <div className="clean-accent-bar" />
        <PhotoFrame wrapperClass="clean-photo-box" imageClass="clean-photo" shapeClass={shapeClass} photo={photo} photoStyle={photoStyle} />
        <div className="clean-copy">
          <div className="eyebrow dark">{data.kicker}</div>
          <h1 style={headlineStyle}>{headline}</h1>
          <p>{data.subheadline}</p>
        </div>
        <div className="clean-byline">
          <strong>{data.name}</strong><span>{data.role}</span>
        </div>
        {data.watermark && <div className="watermark dark-watermark">Made with The BOX Studio</div>}
      </div>
    )
  }

  if (template === 'split-story') {
    return (
      <div className="card card-split" ref={ref} style={{ fontFamily: data.fontFamily, '--accent': data.accent, aspectRatio: data.aspect, '--font-date': data.fonts?.date || data.fontFamily, '--font-kicker': data.fonts?.kicker || data.fontFamily, '--font-sub': data.fonts?.subheadline || data.fontFamily, '--font-name': data.fonts?.name || data.fontFamily, '--font-role': data.fonts?.role || data.fontFamily }}>
        <BackgroundAreas data={data}/><div className="split-left">
          <div className="brandmark split-brand"><BrandLogo data={data}/></div>
          <div className="split-copy">
            <div className="eyebrow">{data.kicker}</div>
            <h1 style={headlineStyle}>{headline}</h1>
            <p>{data.subheadline}</p>
          </div>
          <div className="split-person"><strong>{data.name}</strong><span>{data.role}</span></div>
          <div className="split-date">{data.date}</div>
        </div>
        <div className={`split-right ${shapeClass}`}><img src={photo} alt="subject" className="adjustable-photo split-photo" style={photoStyle} /></div>
        {data.watermark && <div className="watermark">Made with The BOX Studio</div>}
      </div>
    )
  }

  return (
    <div className="card card-blue" ref={ref} style={{ fontFamily: data.fontFamily, '--accent': data.accent, aspectRatio: data.aspect, '--font-date': data.fonts?.date || data.fontFamily, '--font-kicker': data.fonts?.kicker || data.fontFamily, '--font-sub': data.fonts?.subheadline || data.fontFamily, '--font-name': data.fonts?.name || data.fontFamily, '--font-role': data.fonts?.role || data.fontFamily }}>
      <BackgroundAreas data={data}/><div className="blue-pattern" />
      <div className="blue-glow" />
      <div className="blue-logo"><BrandLogo data={data}/></div>
      <div className="quote-box">
        <h1 style={headlineStyle}>{headline}</h1>
        <p>{data.subheadline}</p>
      </div>
      <PhotoFrame wrapperClass="blue-photo-wrap" imageClass="blue-photo" shapeClass={shapeClass} photo={photo} photoStyle={photoStyle} />
      <div className="blue-person"><strong>{data.name}</strong><span>{data.role}</span></div>
      <div className="blue-date">{data.date}</div>
      {data.watermark && <div className="watermark">Made with The BOX Studio</div>}
    </div>
  )
})

const PhotocardPreview=forwardRef(function PhotocardPreview({data,template,editable=false,selected,onSelect,onElements},ref){
 const width=0
 return <div className="studio-artboard" ref={ref} style={{width:'100%',aspectRatio:data.aspect,background:data.bgColor,'--photo-filter':({original:'none',mono:'grayscale(1)',warm:'sepia(.3) saturate(1.2)',cool:'saturate(.8) hue-rotate(12deg)',contrast:'contrast(1.2) saturate(1.15)'})[data.photoFilter]||'none','--frame-width':`${data.frameWidth}%`,'--frame-height':`${data.frameHeight}%`,'--frame-border':`${data.frameBorder}px`,'--frame-color':data.frameColor,'--frame-shadow':data.frameShadow/100}}>
 <div className="artwork-shell" style={{left:data.sidePosition==='left'?`${width}%`:0,right:data.sidePosition==='right'?`${width}%`:0}}><CardArtwork data={data} template={template}/></div>
 <ElementLayers data={data} editable={editable} selected={selected} onSelect={onSelect} onChange={onElements}/>
 </div>
})
export default PhotocardPreview
