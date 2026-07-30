import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
};

const server = createServer(async (req, res) => {
  try {
    let filePath = join(process.cwd(), req.url === '/' ? 'index.html' : req.url);
    const ext = extname(filePath);
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(content);
  } catch (err) {
    res.writeHead(404);
    res.end('Not found: ' + err.message);
  }
});

server.listen(8080, async () => {
  console.log('Test server running at http://localhost:8080');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => pageErrors.push(err.message));

  try {
    await page.goto('http://localhost:8080/index.html');
    await page.waitForTimeout(1000);

    console.log('--- BROWSER CONSOLE LOGS ---');
    consoleLogs.forEach(l => console.log(l));

    console.log('--- PAGE UNCAUGHT ERRORS ---');
    pageErrors.forEach(e => console.log(e));

    // TEST TAB VISIBILITY SWITCHING
    console.log('\n--- TESTING TAB PAGE VISIBILITY SWITCHING ---');

    // 1. Click Shopping Tab
    await page.click('[data-tab="shopping"]');
    await page.waitForTimeout(300);
    const plannerVisibleOnShopping = await page.locator('#page-planner').isVisible();
    const shoppingVisibleOnShopping = await page.locator('#page-shopping').isVisible();
    console.log(`Shopping tab active: #page-planner visible=${plannerVisibleOnShopping}, #page-shopping visible=${shoppingVisibleOnShopping}`);

    // 2. Click Settings Tab
    await page.click('[data-tab="settings"]');
    await page.waitForTimeout(300);
    const plannerVisibleOnSettings = await page.locator('#page-planner').isVisible();
    const settingsVisibleOnSettings = await page.locator('#page-settings').isVisible();
    console.log(`Settings tab active: #page-planner visible=${plannerVisibleOnSettings}, #page-settings visible=${settingsVisibleOnSettings}`);

    // 3. Return to Planner Tab
    await page.click('[data-tab="planner"]');
    await page.waitForTimeout(300);
    const plannerVisibleOnPlanner = await page.locator('#page-planner').isVisible();
    console.log(`Planner tab active: #page-planner visible=${plannerVisibleOnPlanner}`);

    const isTabSwitchingClean = (!plannerVisibleOnShopping && shoppingVisibleOnShopping && !plannerVisibleOnSettings && settingsVisibleOnSettings && plannerVisibleOnPlanner);
    console.log(`Tab visibility switching clean and complete: ${isTabSwitchingClean ? 'YES' : 'NO'}`);

    await page.screenshot({ path: 'test-screenshot.png' });
    console.log('Screenshot saved to test-screenshot.png');

  } catch (e) {
    console.error('Playwright Test Error:', e);
  } finally {
    await browser.close();
    server.close();
  }
});
