// claim-rewards.js
//
// ================================================================
// 💰 CLAIM ALL BEAUTY PAGEANT DUEL REWARDS
// ================================================================
//
// What this script does:
//
// 1. Opens the Beauty Pageant page.
// 2. Waits for the page to finish loading.
// 3. Sends the game's own internal POST request:
//      /ajax/beauty_pageant.php
//
//    with:
//      action = claimAllDuelRewards
//
// 4. Reads the JSON response.
// 5. Logs ONLY the response status:
//      status=1 → success
//      status=0 → failed
//
// Nothing else is done by this script.
// ================================================================


module.exports = async function runClaimRewards(page) {

  // ==============================================================
  // 1️⃣ OPEN BEAUTY PAGEANT PAGE
  // ==============================================================

  await page.goto(
    'https://v3.g.ladypopular.com/beauty_pageant.php',
    {
      // Wait until the page DOM has loaded.
      waitUntil: 'domcontentloaded',

      // Give the page up to 60 seconds to load.
      timeout: 60000
    }
  );


  // ==============================================================
  // 2️⃣ SEND THE INTERNAL GAME REQUEST
  // ==============================================================

  const response = await page.evaluate(async () => {

    // The request is made from inside the already logged-in page.
    // Therefore the browser's existing session/cookies are used.
    const res = await fetch(
      '/ajax/beauty_pageant.php',
      {
        // The game uses POST for this action.
        method: 'POST',

        // These are the request headers relevant to the
        // request shown in your Network information.
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded; charset=UTF-8',

          'X-Requested-With':
            'XMLHttpRequest'
        },

        // Use the existing Lady Popular login session.
        credentials: 'same-origin',

        // This is the exact payload you observed.
        body: new URLSearchParams({
          action: 'claimAllDuelRewards'
        })
      }
    );


    // Convert the game's JSON response into a JavaScript object
    // and return it back to Playwright.
    return await res.json();

  });


  // ==============================================================
  // 3️⃣ LOG ONLY THE STATUS
  // ==============================================================

  // According to your observed response:
  //
  // status: 1 = successful
  // status: 0 = failed
  //
  // We deliberately don't print dollars, keys, duel IDs, etc.
  console.log(`💰 Claim rewards status=${response.status}`);


  // ==============================================================
  // 4️⃣ DONE
  // ==============================================================

};
