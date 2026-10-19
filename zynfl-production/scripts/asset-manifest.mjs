// Prepare a full static-asset manifest for the official Cloudflare upload API.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
const root=path.resolve('public'),manifest={},files={};
async function walk(dir){for(const ent of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,ent.name);if(ent.isDirectory())await walk(file);else if(ent.isFile()){
 const data=await fs.readFile(file),ext=path.extname(file).slice(1),hash=crypto.createHash('sha256').update(data.toString('base64')+ext).digest('hex').slice(0,32),name='/'+path.relative(root,file).replaceAll('\\','/');manifest[name]={hash,size:data.length};files[hash]=file;
}}}
await walk(root);await fs.writeFile(process.argv[2]||'/tmp/zynfl-asset-manifest.json',JSON.stringify({manifest,files}));console.log(`Prepared ${Object.keys(manifest).length} assets`);
