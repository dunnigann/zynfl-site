// Uses only the short-lived, upload-only JWT returned by Cloudflare. The session
// and completion files belong outside the repository and must never be committed.
import fs from 'node:fs/promises';import path from 'node:path';
const [manifestPath,sessionPath,completionPath]=process.argv.slice(2),{files}=JSON.parse(await fs.readFile(manifestPath,'utf8')),session=JSON.parse(await fs.readFile(sessionPath,'utf8'));
const mime={html:'text/html',js:'application/javascript',mjs:'application/javascript',css:'text/css',json:'application/json',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',txt:'text/plain'};
let completion=session.buckets.length?null:session.jwt;
for(const [i,bucket]of session.buckets.entries()){
 const form=new FormData();for(const hash of bucket){const file=files[hash];if(!file)throw Error('Unknown asset hash');form.set(hash,new Blob([(await fs.readFile(file)).toString('base64')],{type:mime[path.extname(file).slice(1).toLowerCase()]||'application/octet-stream'}),hash);}
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${session.accountId}/workers/assets/upload?base64=true`,{method:'POST',headers:{Authorization:`Bearer ${session.jwt}`},body:form,signal:AbortSignal.timeout(120000)});
 const data=await response.json();if(!response.ok||!data.success)throw Error(`Asset upload ${response.status}: ${JSON.stringify(data.errors)}`);if(data.result?.jwt)completion=data.result.jwt;console.log(`Uploaded bucket ${i+1}/${session.buckets.length} (${bucket.length} assets)`);
}
if(!completion)throw Error('Completion token missing');await fs.writeFile(completionPath,JSON.stringify({jwt:completion}),{mode:0o600});console.log('Asset upload complete');
