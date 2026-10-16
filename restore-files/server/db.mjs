import {DatabaseSync} from 'node:sqlite'
import {mkdirSync,chmodSync} from 'node:fs'
import path from 'node:path'
export const dataDir=path.resolve(process.env.DATA_DIR||'data')
mkdirSync(dataDir,{recursive:true,mode:0o700});mkdirSync(path.join(dataDir,'exports'),{recursive:true,mode:0o700})
export const db=new DatabaseSync(path.join(dataDir,'box-studio.sqlite'))
try{chmodSync(path.join(dataDir,'box-studio.sqlite'),0o600)}catch{}
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),credits INTEGER NOT NULL DEFAULT 0 CHECK(credits>=0),subscription_end INTEGER NOT NULL DEFAULT 0,plan TEXT NOT NULL DEFAULT '',must_change INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),template TEXT NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,included_available INTEGER NOT NULL DEFAULT 1 CHECK(included_available IN (0,1)),purchase_cost INTEGER NOT NULL,request_key TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(user_id,request_key));
CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),delta INTEGER NOT NULL,balance INTEGER NOT NULL,kind TEXT NOT NULL,note TEXT NOT NULL,actor_id TEXT REFERENCES users(id),reference TEXT UNIQUE,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS export_jobs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),project_id TEXT NOT NULL REFERENCES projects(id),request_key TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','ready','failed')),cost INTEGER NOT NULL,included INTEGER NOT NULL,format TEXT NOT NULL,quality INTEGER NOT NULL,filename TEXT,payload TEXT NOT NULL,error TEXT,created_at INTEGER NOT NULL,finished_at INTEGER,UNIQUE(user_id,request_key));
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_user ON export_jobs(user_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id TEXT,target_id TEXT,action TEXT NOT NULL,details TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS projects_owner ON projects(user_id,updated_at);
CREATE INDEX IF NOT EXISTS ledger_owner ON ledger(user_id,created_at);
CREATE INDEX IF NOT EXISTS exports_owner ON export_jobs(user_id,created_at);
PRAGMA user_version=1;`)
// Additive migration preserves v9 prepaid projects and historical jobs.
if(!db.prepare('PRAGMA table_info(projects)').all().some(c=>c.name==='billing_version'))db.exec('ALTER TABLE projects ADD COLUMN billing_version INTEGER NOT NULL DEFAULT 1');
if(!db.prepare('PRAGMA table_info(export_jobs)').all().some(c=>c.name==='charged'))db.exec('ALTER TABLE export_jobs ADD COLUMN charged INTEGER NOT NULL DEFAULT 1');
db.exec('PRAGMA user_version=2');
export function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}
export function audit(actor,target,action,details={}){db.prepare('INSERT INTO audit(actor_id,target_id,action,details,created_at) VALUES(?,?,?,?,?)').run(actor||null,target||null,action,JSON.stringify(details),Date.now())}
