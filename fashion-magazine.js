// fashion-magazine.js..

module.exports = async function runFashionMagazine(page) {
  const eventUrl = process.env.LP_FASHION_MAGAZINE_URL;

  if (!eventUrl || eventUrl === 'OFF') {
    console.log("⏭️ Fashion Magazine skipped (URL missing or OFF)");
    return;
  }

  console.log("📰 Starting Fashion Magazine event...");

  while (true) {
    try {
      // STEP 1: Open event page
      console.log("🌐 Opening Fashion Magazine page...");
      await page.goto(eventUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      // STEP 1: Check price type
      const priceInfo = await page.$('.price-wrapper .square-price-tag');

      if (!priceInfo) {
        console.log("❌ Price info not found. Stopping.");
        break;
      }

      const priceClass = await priceInfo.getAttribute('class');

      // If NOT emeralds → STOP SCRIPT
      if (!priceClass.includes('icon-currency-emeralds')) {
        console.log("💎 Price is NOT emeralds. Skipping event completely.");
        break;
      }

      console.log("🟢 Price is emeralds. Allowed to click ONE square.");

      // ⏸️ 5-minute safety delay
      // await page.waitForTimeout(5 * 60 * 1000);

      // STEP 2: Read the grid
      await page.waitForSelector('.zone-grid .square', { timeout: 30000 });

      const gridData = await page.$$eval(
        '.zone-grid .square',
        squares =>
          squares.map(square => {
            const cls = square.className;
            if (cls.includes('opened') && cls.includes('completed')) return 2;
            if (cls.includes('opened')) return 1;
            return 0;
          })
      );

      if (gridData.length !== 121) {
        console.log(`⚠️ Grid size unexpected: ${gridData.length}. Stopping.`);
        break;
      }

      // Convert to 11x11 grid (for logic clarity)
      const grid = [];
      for (let i = 0; i < 11; i++) {
        grid.push(gridData.slice(i * 11, i * 11 + 11));
      }

      // Find all CLOSED squares (0)
      const closedIndexes = [];
      gridData.forEach((val, idx) => {
        if (val === 0) closedIndexes.push(idx);
      });

      if (closedIndexes.length === 0) {
        console.log("✅ No closed squares left. Stopping.");
        break;
      }

      // Pick ONE random closed square
      const randomIndex =
        closedIndexes[Math.floor(Math.random() * closedIndexes.length)];

      console.log(`🎯 Clicking square index ${randomIndex} (closed)`);

      const squares = await page.$$('.zone-grid .square');
      await squares[randomIndex].scrollIntoViewIfNeeded();
      await squares[randomIndex].click();

      // Wait for server to process
      await page.waitForTimeout(8000);

      console.log("🔁 Cycle complete. Re-checking price...");

    } catch (err) {
      console.log(`❌ Fashion Magazine error: ${err.message}`);
      await page.screenshot({
        path: 'fashion-magazine-error.png',
        fullPage: true
      });
      break;
    }
  }

  console.log("🏁 Fashion Magazine script finished.");
};
