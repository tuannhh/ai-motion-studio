import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
if(!fs.existsSync('.env'))throw Error('Sao chép .env.next.example thành .env và cấu hình trước khi setup.');
const config=Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').map(l=>l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2]]));
if(config.DB_NAME!=='ams_next'||config.DB_PORT!=='3319')throw Error('Setup này chỉ dành cho database tách biệt ams_next:3319.');
function run(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||'Docker command failed');return r.stdout;}
if(spawnSync('docker',['info'],{stdio:'ignore'}).status!==0)throw Error('Hãy mở Docker Desktop.');
if(spawnSync('docker',['inspect','ams-next-mysql'],{stdio:'ignore'}).status!==0){run(['run','-d','--name','ams-next-mysql','--restart','unless-stopped','-p','127.0.0.1:3319:3306','-e','MYSQL_DATABASE=ams_next','-e','MYSQL_USER=ams','-e',`MYSQL_PASSWORD=${config.DB_PASSWORD}`,'-e',`MYSQL_ROOT_PASSWORD=${config.LOCAL_DB_ROOT_PASSWORD||'ams_next_local_root'}`,'-v','ams-next-data:/var/lib/mysql','mysql:8.0']);}else run(['start','ams-next-mysql']);
let ready=false;for(let n=0;n<60;n++){if(spawnSync('docker',['exec','-e',`MYSQL_PWD=${config.DB_PASSWORD}`,'ams-next-mysql','mysql','-uams','-e','SELECT 1','ams_next'],{stdio:'ignore'}).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}
if(!ready)throw Error('MySQL chưa sẵn sàng. Kiểm tra cấu hình mật khẩu.');
const dir='apps/server/startup/database';const files=[path.join(dir,'schema.sql'),...fs.readdirSync(path.join(dir,'changelogs')).filter(f=>f.endsWith('.sql')).sort().map(f=>path.join(dir,'changelogs',f))];
for(const file of files){run(['exec','-i','-e',`MYSQL_PWD=${config.DB_PASSWORD}`,'ams-next-mysql','mysql','--default-character-set=utf8mb4','-uams','ams_next'],fs.readFileSync(file));console.log(`Applied ${path.basename(file)}`);}
console.log('Database sẵn sàng. Tạo admin bằng pnpm --filter @ams/server seed; chạy pnpm renderer:build nếu chưa có renderer image.');
