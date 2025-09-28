const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting browser...');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  console.log('Navigating to homepage...');
  await page.goto('http://localhost:3000');
  
  console.log('Page loaded, checking for auth modal...');
  await page.waitForSelector('#auth-modal', {timeout: 5000});
  
  await browser.close();
  console.log('Done!');
})().catch(console.error);
