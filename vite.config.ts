import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
let buildCommit='unknown';
try {buildCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())buildCommit+='-dirty';}catch{}

export default defineConfig({
  base: './',
  define:{__BUILD_COMMIT__:JSON.stringify(buildCommit)},
  server: { host: '0.0.0.0', port: 43187, strictPort: true, proxy:{'/api':{target:'http://127.0.0.1:43188',changeOrigin:false}} },
  preview: { host: '0.0.0.0', port: 43187, strictPort: true },
});
