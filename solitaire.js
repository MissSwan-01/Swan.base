//VERSION 1–
// solitaire.js
// Safe solitaire automation: 1 free click ONLY if cooldown is over
// Playwright-correct version..

module.exports = async function runSolitaireEvent(page) {
  const solUrl = process.env.LP_SOLITAIRE_URL;

  console.log("🃏 Solitaire Event: Starting");

  // 🛑 Safety: URL must exist
  if (!solUrl || solUrl === "OFF") {
    console.log("🚫 Solitaire URL missing or OFF. Skipping.");
    return;
  }

  try {
    // STEP 1️⃣ — Go to URL
    console.log("🌐 Navigating to Solitaire Event...");
    await page.goto(solUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // ⏳ Let animations & JS finish
    await page.waitForTimeout(6000);

    // ─────────────────────────────────────────
    // STEP 2️⃣ — Inspect REGULAR deck state
    // ─────────────────────────────────────────
    const regularInner = page.locator('.solitaire-draw-card-regular-inner');

    if (!(await regularInner.count())) {
      console.log("🚫 Regular deck not found. Unknown layout. Skipping safely.");
      return;
    }

    console.log("✅ Regular deck found. Inspecting cooldown state...");

    const timerExists = await regularInner.locator('.timer').count();
    const emeraldPriceExists = await regularInner.locator('.currency-emeralds').count();

    if (timerExists > 0 || emeraldPriceExists > 0) {
      console.log("⏳ Cooldown is ACTIVE (timer or emerald cost detected).");
      console.log("🚫 No click will be made. Exiting Solitaire safely.");
      return;
    }

    console.log("🆓 Cooldown is OVER. Free move detected.");

    // ─────────────────────────────────────────
    // STEP 3️⃣ — Cards left BEFORE click
    // ─────────────────────────────────────────
    const cardsLeftBefore = parseInt(
      (await regularInner.locator('.cards-left').innerText()).trim(),
      10
    );

    if (isNaN(cardsLeftBefore) || cardsLeftBefore <= 0) {
      console.log("🚫 Invalid or zero cards-left. Skipping safely.");
      return;
    }

    console.log(`🃏 Cards left BEFORE click: ${cardsLeftBefore}`);

    // ─────────────────────────────────────────
    // STEP 4️⃣ — Click REAL clickable deck (FIX)
    // ─────────────────────────────────────────
    const regularDeck = page.locator(
      '.solitaire-draw-cards-wrapper > div:nth-child(2) .solitaire-draw-card-regular-deck'
    );

    if (!(await regularDeck.count())) {
      console.log("🚫 Regular deck clickable element not found. Skipping safely.");
      return;
    }

    console.log("🖱️ Clicking REAL regular deck element...");

    await regularDeck.waitFor({ state: 'visible', timeout: 10000 });
    await regularDeck.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    // ✅ This is the critical click
    await regularDeck.click();

    console.log("🖱️ Click executed. Waiting for UI update...");

    // ─────────────────────────────────────────
    // STEP 5️⃣ — Wait for cards-left to change
    // ─────────────────────────────────────────
    let cardsLeftAfter = cardsLeftBefore;

    try {
      await page.waitForFunction(
        (before) => {
          const el = document.querySelector(
            '.solitaire-draw-card-regular-inner .cards-left'
          );
          if (!el) return false;
          return parseInt(el.textContent.trim(), 10) === before - 1;
        },
        cardsLeftBefore,
        { timeout: 5000 }
      );

      cardsLeftAfter = parseInt(
        (await regularInner.locator('.cards-left').innerText()).trim(),
        10
      );

    } catch {
      cardsLeftAfter = parseInt(
        (await regularInner.locator('.cards-left').innerText()).trim(),
        10
      );
    }

    console.log(`🃏 Cards left AFTER click: ${cardsLeftAfter}`);

    if (cardsLeftAfter === cardsLeftBefore - 1) {
      console.log("✅ SUCCESS: Cards-left decreased by 1. Click confirmed.");
    } else {
      console.log("⚠️ Click attempted, but cards-left did NOT decrease.");
      console.log("⚠️ Possibly card already active. Ending safely.");
    }

    console.log("🏁 Solitaire Event completed safely.");

  } catch (err) {
    console.log(`❌ Solitaire Event error: ${err.message}`);
    console.log("🛑 Exiting Solitaire to avoid accidental spending.");
    await page.screenshot({
      path: 'solitaire-error.png',
      fullPage: true
    });
  }
};
