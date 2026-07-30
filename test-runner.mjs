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

    // Navigate to shopping tab
    await page.click('[data-tab="shopping"]');
    await page.waitForTimeout(500);

    const sectionRows = page.locator('#shopping-list-container .shopping-section[data-store-id="greengrocer"] .shopping-item-row');
    const rowCount = await sectionRows.count();
    console.log(`Greengrocer store items count: ${rowCount}`);

    if (rowCount >= 2) {
      const item0Before = await sectionRows.nth(0).locator('.shopping-item-name').innerText();
      const item1Before = await sectionRows.nth(1).locator('.shopping-item-name').innerText();
      console.log(`BEFORE REORDER: Item 0 = "${item0Before}", Item 1 = "${item1Before}"`);

      // Call reorderStoreItems
      const res = await page.evaluate(() => {
        if (window.itemsByStore && window.itemsByStore['greengrocer']) {
          window.reorderStoreItems(window.itemsByStore['greengrocer'], 0, 1);
          return 'REORDERED_OK';
        }
        return 'ITEMS_BY_STORE_NOT_FOUND';
      });
      console.log(`reorderStoreItems execution status: ${res}`);

      await page.waitForTimeout(500);

      const item0After = await sectionRows.nth(0).locator('.shopping-item-name').innerText();
      const item1After = await sectionRows.nth(1).locator('.shopping-item-name').innerText();
      console.log(`AFTER REORDER: Item 0 = "${item0After}", Item 1 = "${item1After}"`);

      const didSwap = (item0After === item1Before && item1After === item0Before);
      console.log(`Drag & Drop / Reordering locked position successfully: ${didSwap ? 'YES' : 'NO'}`);
    }

    await page.screenshot({ path: 'test-screenshot.png' });
    console.log('Screenshot saved to test-screenshot.png');

  } catch (e) {
    console.error('Playwright Test Error:', e);
  } finally {
    await browser.close();
    server.close();
  }
});
