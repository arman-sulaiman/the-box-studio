import {randomBytes,scrypt as scryptCb,timingSafeEqual,createHash} from 'node:crypto'
import {promisify} from 'node:util'
import {db} from './db.mjs'
const scrypt=promisify(scryptCb)
export const id=()=>randomBytes(16).toString('hex')
export const hash=value=>createHash('sha256').update(value).digest('hex')
export function fail(status,message){const e=new Error(message);e.status=status;throw e}
export function passwordValid(value){return typeof value==='string'&&value.length>=12&&value.length<=128}
export async function passwordHash(password){if(!passwordValid(password))fail(400,'Use a password of 12–128 characters.');const salt=randomBytes(16).toString('hex');return `scrypt:${salt}:${(await scrypt(password,salt,64)).toString('hex')}`}
export async function passwordMatches(password,stored){if(typeof password!=='string'||password.length>128)return false;const [,salt,key]=stored.split(':');const actual=await scrypt(password,salt,64);const expected=Buffer.from(key,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected)}
export function sessionFrom(req){const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')));const token=cookies.box_session;if(!token||!/^[a-f0-9]{64}$/.test(token))return null;return db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(hash(token),Date.now())||null}
export function newSession(res,userId,oldSession,secure){if(oldSession)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(oldSession.token_hash);const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token),userId||null,csrf,Date.now()+8*3600000);res.setHeader('Set-Cookie',`box_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure?'; Secure':''}`);return {token_hash:hash(token),user_id:userId||null,csrf}}
export function activePremium(user){return user.role==='admin'||user.subscription_end>Date.now()}
export function publicUser(user){if(!user)return null;return {id:user.id,username:user.username,name:user.name,role:user.role,status:user.status,credits:user.credits,subscriptionEnd:user.subscription_end,plan:user.plan,hasPremium:activePremium(user),mustChange:!!user.must_change}}
export function getUser(session,allowChange=false){if(!session?.user_id)fail(401,'Sign in to continue.');const u=db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id);if(!u||u.status!=='active')fail(403,'This account is suspended. Contact the administrator.');if(u.must_change&&!allowChange)fail(403,'Please change your temporary password first.');return u}
export function premiumUser(session){const u=getUser(session);if(!activePremium(u))fail(403,'An active subscription is required. Contact your administrator.');return u}
export function adminUser(session){const u=getUser(session);if(u.role!=='admin')fail(403,'Administrator access required.');return u}
export function limit(key,max=8,windowMs=900000){const now=Date.now(),r=db.prepare('SELECT * FROM attempts WHERE key=?').get(key);if(r&&r.expires_at>now&&r.count>=max)fail(429,'Too many attempts. Please try again later.');db.prepare('INSERT INTO attempts VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,expires_at=excluded.expires_at').run(key,r&&r.expires_at>now?r.count+1:1,r&&r.expires_at>now?r.expires_at:now+windowMs)}
