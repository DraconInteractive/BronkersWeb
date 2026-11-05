import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',
  fullyParallel:false,
  workers:1,
  timeout:20000,
  use:{baseURL:'http://127.0.0.1:43187',trace:'retain-on-failure'},
  webServer:{command:'./scripts/dev',url:'http://127.0.0.1:43187',reuseExistingServer:true},
  projects:[
    {name:'chromium-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},
    {name:'firefox-desktop',use:{...devices['Desktop Firefox'],viewport:{width:1280,height:720}}},
    {name:'mobile-chromium',use:{...devices['Pixel 7']}},
  ],
});
