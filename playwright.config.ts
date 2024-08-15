// import 'dotenv/config';
import { defineConfig } from '@playwright/test';

//
//

(globalThis as any).__DEV__ = true;

//
//

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  reporter: 'list',
  outputDir: 'tests/test-results',

  projects: [
    {
      name: 'node',
      testMatch: /.*\.test\.ts/,
      use: {
        launchOptions: {
          headless: true,
        },
      },
    },
  ],

  // fullyParallel: false,
  // workers: 1,
});
