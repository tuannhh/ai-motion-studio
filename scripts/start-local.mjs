import {spawn,spawnSync} from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
if(!fs.existsSync('.env'))throw Error('Thiếu .env. Sao chép .env.next.example và điền khóa Gemini.');
for(const port of [4620,4621]){const busy=await new Promise(r=>{const s=net.connect({port,host:'127.0.0.1'});s.on('connect',()=>{s.destroy();r(true);});s.on('error',()=>r(false));});if(busy)throw Error(`Cổng ${port} đang dùng. Nếu Studio đã chạy, mở http://localhost:4621; không cần chạy lần nữa.`);}
if(spawnSync('docker',['start','ams-next-mysql'],{stdio:'ignore'}).status!==0)throw Error('Mở Docker Desktop rồi chạy pnpm setup:local.');
await import('./prepare-preview.mjs');
const children=[spawn('pnpm',['--filter','@ams/server','start'],{stdio:'inherit'}),spawn('pnpm',['--filter','@ams/web','dev','--host','127.0.0.1'],{stdio:'inherit'})];
let closing=false;function stop(){if(closing)return;closing=true;for(const child of children)child.kill('SIGTERM');}
process.on('SIGINT',stop);process.on('SIGTERM',stop);for(const child of children){child.on('error',e=>{console.error(e.message);stop();process.exitCode=1;});child.on('exit',code=>{if(!closing&&code){process.exitCode=code;stop();}});}
console.log('\nAI Motion Studio Next — http://localhost:4621\n');
