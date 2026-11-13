import { defineConfig } from '@playwright/test';

// A commit-stamped S42 run must never inherit another checkout's preview server.
const isS42CommitRun=Boolean(process.env.S42_TESTED_COMMIT_SHA);
const previewPort=isS42CommitRun?4182:4173;
const previewUrl=`http://127.0.0.1:${previewPort}`;
const strictPort=isS42CommitRun?' --strictPort':'';

export default defineConfig({
 testDir:'./e2e',timeout:60000,workers:1,fullyParallel:false,
 reporter:[['list'],['json',{outputFile:'test-results/e2e.json'}]],
 use:{baseURL:previewUrl,viewport:{width:1440,height:1080},headless:true,screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:{
  command:`npm run preview -- --host 127.0.0.1 --port ${previewPort}${strictPort}`,
  url:previewUrl,
  reuseExistingServer:isS42CommitRun?false:!process.env.CI,
 },
});
