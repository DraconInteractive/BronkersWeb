import {resolve} from 'node:path';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRoundServer} from './http.mjs';
process.umask(0o077);
const port=Number(process.env.BRONKERS_API_PORT??43188);
if(!Number.isSafeInteger(port)||port<0||port>65535)throw Error('Invalid BRONKERS_API_PORT');
const app=createRoundServer({filename:resolve(process.env.BRONKERS_DATA_DIR??'.data','rounds.sqlite')});
app.server.listen(port,'127.0.0.1',()=>console.log(`Bronkers round API listening on 127.0.0.1:${app.server.address().port}`));
let stopping=false;
async function stop(){if(stopping)return;stopping=true;clearInterval(watcher);const timeout=setTimeout(()=>process.exit(1),8000);timeout.unref();await app.close();clearTimeout(timeout);process.exit(0);}
// systemd restarts on exit: follow the atomically activated API release without
// granting the deploy user any permission to control privileged services.
const watcher=setInterval(()=>{
  const entry=process.env.BRONKERS_ENTRYPOINT;if(!entry)return;
  try{if(realpathSync(entry)!==fileURLToPath(import.meta.url))void stop();}catch{} // A temporarily missing link leaves this healthy process running.
},2000);watcher.unref();
process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
