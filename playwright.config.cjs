const { defineConfig } = require('@playwright/test');
const path = require('node:path');

// Keep browser binaries disposable and independent from a user's global cache.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(__dirname, 'runtime/playwright-browsers');

// Missing baselines are failures, not implicit approvals (including in CI).
const accepting = process.env.npm_lifecycle_event === 'test:operator:update';
if (!accepting && process.argv.some(arg => arg.startsWith('--update-snapshots'))) {
  throw new Error('Accept operator baselines only with npm run test:operator:update.');
}

module.exports = defineConfig({
  testDir: './tests/browser',
  testMatch: ['operator.spec.cjs', 'startup.spec.cjs'],
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  expect: { timeout: 7000, toHaveScreenshot: { animations: 'disabled', maxDiffPixels: 0 } },
  updateSnapshots: accepting ? 'all' : 'none',
  snapshotPathTemplate: '{testDir}/../visual-baselines/operator/{arg}{ext}',
  outputDir: './runtime/operator-browser/results',
  reporter: [['list'], ['html', { outputFolder: 'runtime/operator-browser/report', open: 'never' }]],
  use: { locale: 'es-MX', timezoneId: 'UTC', colorScheme: 'dark' },
});
