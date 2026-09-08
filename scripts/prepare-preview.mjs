import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
fs.mkdirSync(path.join(root,'apps/web/public'),{recursive:true});
fs.cpSync(path.join(root,'assets/sfx'),path.join(root,'apps/web/public/sfx'),{recursive:true});
