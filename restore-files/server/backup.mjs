import {backup} from 'node:sqlite'
import path from 'node:path'
import {mkdirSync} from 'node:fs'
import {db} from './db.mjs'
const root=path.resolve(process.env.BACKUP_DIR||'backups');mkdirSync(root,{recursive:true,mode:0o700});const target=path.join(root,`box-studio-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);await backup(db,target);console.log('Database backup created:',target);console.log('Keep backups private. Export recovery files are temporary and are not included.')
