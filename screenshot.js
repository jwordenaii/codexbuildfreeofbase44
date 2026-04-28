const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:5175/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/ui_home.png', fullPage: false });
  console.log('Home page screenshot saved');
  
  const avatarBtn = await page.$('button[aria-label*="Mr. Worden"]');
  if (avatarBtn) {
    await avatarBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/tmp/ui_chat_open.png', fullPage: false });
    console.log('Chat panel open screenshot saved');
    
    const helpTab = await page.$('button:has-text("Help")');
    if (helpTab) {
      await helpTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/ui_help_tab.png', fullPage: false });
      console.log('Help tab screenshot saved');
    }
    
    const contactTab = await page.$('button:has-text("Contact")');
    if (contactTab) {
      await contactTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/ui_contact_tab.png', fullPage: false });
      console.log('Contact tab screenshot saved');
    }
  } else {
    console.log('Avatar button not found');
    const btns = await page.$$eval('button', function(bs) { return bs.map(function(b) { return b.getAttribute('aria-label') || b.textContent.trim(); }); });
    console.log('Buttons found:', JSON.stringify(btns.slice(0, 10)));
  }
  
  await browser.close();
})().catch(function(e) { console.error(e.message); process.exit(1); });
