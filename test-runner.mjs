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

    const plannerCardsCount = await page.locator('.dinner-card').count();
    console.log(`Planner cards count: ${plannerCardsCount}`);

    const navButtonsCount = await page.locator('.nav-item').count();
    console.log(`Nav buttons count: ${navButtonsCount}`);

    await page.screenshot({ path: 'test-screenshot.png' });
    console.log('Screenshot saved to test-screenshot.png');

  } catch (e) {
    console.error('Playwright Test Error:', e);
  } finally {
    await browser.close();
    server.close();
  }
});
