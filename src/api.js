let csrf=''
export async function api(url,options={}){const response=await fetch(url,{credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...options.headers},...(options.body&&typeof options.body!=='string'?{body:JSON.stringify(options.body)}:{})});const data=await response.json();if(data.csrf)csrf=data.csrf;if(!response.ok)throw Object.assign(new Error(data.error||'Request failed'),{status:response.status});return data}
export const operationId=()=>crypto.randomUUID()
export const prettyDate=value=>value?new Date(value).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'Not active'
