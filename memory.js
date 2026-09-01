// memory.js

module.exports = async function runMemoryEvent(page) {
  const memoryUrl = process.env.LP_MEMORY_URL;
  
  console.log("🌐 Navigating to Memory Event...");
  await page.goto(memoryUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(30000);

  const emeraldText = await page.textContent('#player-emeralds');
  const emeralds = parseInt(emeraldText.replace(/\D/g, ''));
  console.log(`💎 Emeralds found: ${emeralds}`);
  if (emeralds < 8) {
    console.log("🚫 Not enough emeralds. Exiting.");
    return;
  }

  console.log("▶️ Clicking start game button...");
  const startButton = await page.waitForSelector(
    'button.btn-free-reset',
    { timeout: 180000 }
  );

  await page.waitForTimeout(1000);
  await startButton.click({ force: true });

  await page.waitForSelector(
    '.memory-grid-wrapper',
    { timeout: 30000 }
  );

  console.log("🎯 Memory grid loaded.");

  console.log("🔁 Final pre-game refresh...");
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(30000);

  const getAllTiles = async () =>
    await page.$$('.memory-grid-item:not(.memory-grid-item-fake)');

  // ============================================================
  // NORMAL TILE CLICK
  // ============================================================
  //
  // Waits 10 seconds, clicks the tile, then reads its hidden ID.
  //
  // This is used by the original game logic.
  // ============================================================

  async function clickTileAndGetId(index) {
    const tiles = await getAllTiles();
    const tile = tiles[index];

    if (!tile) return null;

    console.log(`🕒 Waiting 10s before clicking tile ${index}...`);
    await page.waitForTimeout(10000);

    await tile.click({ force: true });

    console.log(`✅ Clicked tile ${index}`);

    await page.waitForTimeout(100);

    const inner = await tile
      .waitForSelector(
        '.memory-grid-item-inner',
        { timeout: 7000 }
      )
      .catch(() => null);

    if (!inner) return null;

    const className =
      await inner.getAttribute('class');

    const match =
      className.match(/memory-grid-item-inner-(\d+)/);

    return match ? match[1] : null;
  }


  // ============================================================
  // NOMINAL TILE CLICK
  // ============================================================
  //
  // Used ONLY when a Phase 1 pair fails to match.
  //
  // It:
  //   1. Gets the same tile
  //   2. Waits 10 seconds
  //   3. Clicks it
  //
  // It DOES NOT:
  //   - read the tile ID
  //   - update clickedOnce
  //   - update matched
  //   - update known
  //
  // Therefore these clicks have no effect on the script's
  // bookkeeping or decision-making.
  // ============================================================

  async function nominalClickTile(index) {
    const tiles = await getAllTiles();
    const tile = tiles[index];

    if (!tile) return;

    await page.waitForTimeout(10000);

    await tile.click({ force: true });
    );
  }


  // ============================================================
  // CHECK WHETHER A TILE IS MATCHED
  // ============================================================

  async function isTileMatched(index) {
    const tiles = await getAllTiles();
    const tile = tiles[index];

    if (!tile) return false;

    const className =
      await tile.getAttribute('class');

    return (
      className.includes('opened') ||
      className.includes('matched') ||
      className.includes('disable-on-match')
    );
  }


  // ============================================================
  // INITIAL SETUP
  // ============================================================

  const totalTiles =
    (await getAllTiles()).length;

  console.log(
    `🎯 Detected ${totalTiles} real tiles.`
  );

  const clickedOnce = new Set();
  const matched = new Set();
  const known = {};


  // ============================================================
  // PHASE 1
  // DISCOVERING INNER NUMBERS
  // ============================================================

  console.log(
    "🧠 Phase 1: Discovering inner numbers..."
  );

  while (clickedOnce.size < totalTiles) {

    let firstIndex = null;

    // ----------------------------------------------------------
    // Find the first tile that hasn't been clicked yet.
    // ----------------------------------------------------------

    for (let i = 0; i < totalTiles; i++) {

      if (
        !clickedOnce.has(i) &&
        !matched.has(i)
      ) {
        firstIndex = i;
        break;
      }
    }

    if (firstIndex === null) break;


    // ----------------------------------------------------------
    // Click first tile and discover its ID.
    // ----------------------------------------------------------

    const firstId =
      await clickTileAndGetId(firstIndex);

    clickedOnce.add(firstIndex);

    if (!firstId) continue;


    // ----------------------------------------------------------
    // See if we already know another tile with this ID.
    // ----------------------------------------------------------

    const knownMatch =
      (known[firstId] || []).find(
        i =>
          i !== firstIndex &&
          !matched.has(i)
      );


    // ----------------------------------------------------------
    // If we already know the matching tile, use it.
    //
    // Otherwise choose another undiscovered tile.
    // ----------------------------------------------------------

    let secondIndex =
      knownMatch != null
        ? knownMatch
        : Array.from(
            { length: totalTiles },
            (_, i) => i
          ).find(
            i =>
              !clickedOnce.has(i) &&
              !matched.has(i) &&
              i !== firstIndex
          );


    if (secondIndex == null) continue;


    // ----------------------------------------------------------
    // Click second tile and discover its ID.
    // ----------------------------------------------------------

    const secondId =
      await clickTileAndGetId(secondIndex);

    clickedOnce.add(secondIndex);

    if (!secondId) continue;


    // ----------------------------------------------------------
    // Store what we learned.
    // ----------------------------------------------------------

    known[firstId] = [
      ...(known[firstId] || []),
      firstIndex
    ];

    known[secondId] = [
      ...(known[secondId] || []),
      secondIndex
    ];


    // ----------------------------------------------------------
    // Check whether the two tiles actually matched.
    // ----------------------------------------------------------

    await page.waitForTimeout(500);

    const m1 =
      await isTileMatched(firstIndex);

    const m2 =
      await isTileMatched(secondIndex);


    // ==========================================================
    // SUCCESSFUL MATCH
    // ==========================================================

    if (m1 && m2) {

      matched.add(firstIndex);
      matched.add(secondIndex);

      console.log(
        `✅ MATCHED: ${firstIndex} & ${secondIndex}`
      );

    }


    // ==========================================================
    // FAILED MATCH
    // ==========================================================

    else {

      console.log(
        `❌ Not a match: ${firstIndex} & ${secondIndex}`
      );

      await nominalClickTile(firstIndex);
      await nominalClickTile(secondIndex);

    }
  }


  // ============================================================
  // PHASE 2
  // MATCHING ALL KNOWN PAIRS
  // ============================================================

  console.log(
    "🧠 Phase 2: Matching all known pairs..."
  );

  for (
    const [innerId, indices]
    of Object.entries(known)
  ) {

    const unmatched =
      indices.filter(
        i => !matched.has(i)
      );


    for (
      let i = 0;
      i < unmatched.length;
      i += 2
    ) {

      const a = unmatched[i];
      const b = unmatched[i + 1];

      if (
        a == null ||
        b == null
      ) {
        continue;
      }


      await clickTileAndGetId(a);
      await clickTileAndGetId(b);

      await page.waitForTimeout(500);


      const m1 =
        await isTileMatched(a);

      const m2 =
        await isTileMatched(b);


      if (m1 && m2) {

        matched.add(a);
        matched.add(b);

        console.log(
          `✅ MATCHED in Phase 2: ${a} & ${b}`
        );

      } else {

        console.log(
          `❌ Phase 2 mismatch: ${a} & ${b}`
        );
      }
    }
  }


  // ============================================================
  // FINAL RESULT
  // ============================================================

  if (matched.size === totalTiles) {

    console.log(
      "🎉 All pairs matched!"
    );

  } else {

    console.log(
      `⚠️ Game incomplete: Matched ${matched.size}/${totalTiles}`
    );
  }
};
