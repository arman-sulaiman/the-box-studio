import React from 'react'
import PremiumCard from './components/PremiumCard.jsx'
import ExtraPremiumCard from './components/ExtraPremiumCard.jsx'
export default function PremiumArtwork({data,template}){return ['premium-bulletin','premium-cover','premium-comparison','premium-spotlight'].includes(template)?<ExtraPremiumCard data={data} template={template}/>:<PremiumCard data={data} template={template}/>}
