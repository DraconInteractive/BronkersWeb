import {createServer} from 'node:http';
import {isIP} from 'node:net';
import {parseRound,InvalidRecord} from './contract.ts';
import {RoundStore} from './store.mjs';
const MAX_BODY=8192;
function problem(status,message){return Object.assign(new Error(message),{status});}
function readBody(req) {
  return new Promise((resolve,reject)=>{
    let size=0,parts=[],failed=false;
    req.on('data',part=>{size+=part.length;if(size>MAX_BODY){if(!failed){failed=true;parts=[];reject(problem(413,'Round record too large'));}}else if(!failed)parts.push(part);});
    req.on('end',()=>{if(!failed)resolve(Buffer.concat(parts).toString('utf8'));});
    req.on('error',reject);
  });
}
function query(url) {
  const allowed=['after','through','limit','mode','aiPolicy'];
  for(const key of url.searchParams.keys())if(!allowed.includes(key)||url.searchParams.getAll(key).length!==1)throw problem(400,'Invalid query parameter');
  const result={};
  for(const [key,fallback,max]of [['after',0,Number.MAX_SAFE_INTEGER],['through',undefined,Number.MAX_SAFE_INTEGER],['limit',100,1000]]){
    const text=url.searchParams.get(key);
    if(text===null){result[key]=fallback;continue;}
    if(!/^\d+$/.test(text))throw problem(400,'Invalid numeric parameter');
    const n=Number(text);if(!Number.isSafeInteger(n)||n<(key==='limit'?1:0)||n>max)throw problem(400,'Numeric parameter out of range');result[key]=n;
  }
  result.mode=url.searchParams.get('mode');if(result.mode!==null&&!['goals','points'].includes(result.mode))throw problem(400,'Invalid mode');
  result.aiPolicy=url.searchParams.get('aiPolicy');if(result.aiPolicy!==null&&!/^[A-Za-z0-9._-]{1,80}$/.test(result.aiPolicy))throw problem(400,'Invalid policy');
  return result;
}
export function createRoundServer({filename,store=new RoundStore(filename),rateLimit=120,now=Date.now}={}) {
  const windows=new Map();
  const server=createServer(async(req,res)=>{
    const send=(status,body,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body)+'\n');};
    try {
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET'&&url.pathname==='/api/health'){send(200,{status:'ok',schemaVersion:1});return;}
      if(req.method==='GET'&&url.pathname==='/api/rounds'){send(200,store.rounds(query(url)));return;}
      if(req.method==='GET'&&url.pathname==='/api/stats'){send(200,store.stats(query(url)));return;}
      if(req.method!=='POST'||url.pathname!=='/api/rounds'){send(404,{error:'Not found'});return;}
      if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{throw problem(403,'Origin not allowed');}
        if(origin.host!==req.headers.host)throw problem(403,'Origin not allowed');}
      if(req.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json')throw problem(415,'Expected application/json');
      const forwarded=String(req.headers['x-forwarded-for']??'').split(',').at(-1).trim();
      const address=isIP(forwarded)?forwarded:req.socket.remoteAddress;
      const time=now();
      if(windows.size>10000)for(const [key,window]of windows)if(window.until<=time)windows.delete(key);
      let window=windows.get(address);if(!window||window.until<=time){window={until:time+60000,count:0};windows.set(address,window);}
      if(++window.count>rateLimit){req.resume();send(429,{error:'Try again later'},{'Retry-After':String(Math.max(1,Math.ceil((window.until-time)/1000)))});return;}
      if(Number(req.headers['content-length']??0)>MAX_BODY){req.resume();throw problem(413,'Round record too large');}
      let value;try{value=JSON.parse(await readBody(req));}catch(error){if(error.status)throw error;throw problem(400,'Invalid JSON');}
      const result=store.save(parseRound(value));send(result.duplicate?200:201,result);
    }catch(error){
      const status=error instanceof InvalidRecord?400:error.status??500;
      if(status>=500)console.error('Round API request failed:',error.message);
      req.resume();
      if(!res.headersSent)send(status,{error:status>=500?'Storage unavailable':error.message});
    }
  });
  server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
  return {server,store,async close(){await new Promise(resolve=>server.close(resolve));store.close();}};
}
