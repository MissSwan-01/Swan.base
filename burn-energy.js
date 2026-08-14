module.exports = async function runBurnEnergy(page) {

  // ==============================================================
  // 🎟️ TICKET SPENDING
  // ==============================================================

  async function spendExcessTickets() {

    try {

      console.log("🎟️ Checking ticket count...");

      // Ticket count is read from the Beauty Pageant page.
      await page.goto(
        'https://v3.g.ladypopular.com/beauty_pageant.php',
        {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        }
      );

      const getTicketCount = async () => {
        const ticketText = await page.innerText('.bp-pass-amount');
        return parseInt(ticketText.trim());
      };

      const tickets = await getTicketCount();

      console.log(`🎟️ You have ${tickets} tickets.`);

      const ticketsToUse = tickets - 90;

      if (ticketsToUse <= 0) {
        console.log("🚫 No excess tickets to spend.");
        return;
      }

      console.log(
        `🎯 Sending ${ticketsToUse} competeInDuel requests...`
      );

      for (let i = 1; i <= ticketsToUse; i++) {

        try {

          await page.evaluate(async () => {

            await fetch('/ajax/beauty_pageant.php', {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/x-www-form-urlencoded'
              },
              credentials: 'same-origin',
              body: new URLSearchParams({
                action: 'competeInDuel'
              })
            });

          });

          await page.waitForTimeout(10);

        } catch (err) {

          console.log(
            `⚠️ Ticket request ${i} failed: ${err.message}`
          );

        }
      }

      console.log("✅ Excess ticket spending finished.");

    } catch (err) {

      // Ticket spending failure must never stop
      // Beauty Pageant or Fashion Arena.
      console.log(
        `⚠️ Ticket spending skipped: ${err.message}`
      );

    }
  }


  // ==============================================================
  // 💅 BEAUTY PAGEANT
  // ==============================================================

  async function runBeautyPageant() {

    async function getJudgeCycles() {

      const energySelector =
        '#header > div.wrapper > div > div.player-panel-middle > div.player-panel-energy > a.player-energy.player-bp-energy > span.player-energy-value';

      const blueEnergyText =
        await page.innerText(energySelector);

      const blueEnergy =
        parseInt(blueEnergyText.trim());

      const judgeCycles =
        Math.floor(blueEnergy / 2);

      return {
        blueEnergy,
        judgeCycles
      };
    }


    async function performJudgeCycle() {

      const timeoutMs = 10000;
      const pollInterval = 500;
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {

        const duelRes = await page.evaluate(async () => {

          const res = await fetch(
            '/ajax/beauty_pageant.php',
            {
              method: 'POST',
              body: new URLSearchParams({
                action: 'judgeDuel'
              }),
              credentials: 'same-origin'
            }
          );

          return await res.json();

        });


        const matchRegex =
          /<a id="ladyIdContainer-(\d+)-([^"]+)"/g;

        const matches =
          [...duelRes.html.matchAll(matchRegex)];


        if (
          duelRes.duel_id &&
          matches.length === 2
        ) {

          const id1 = matches[0][1];
          const gameId1 = matches[0][2];

          const id2 = matches[1][1];
          const gameId2 = matches[1][2];


          const pickFirst =
            Math.random() < 0.5;

          const winner =
            pickFirst ? id1 : id2;

          const winnerGameId =
            pickFirst ? gameId1 : gameId2;


          await page.evaluate(
            async ({
              duelId,
              winnerId,
              winnerGameId
            }) => {

              const res = await fetch(
                '/ajax/beauty_pageant.php',
                {
                  method: 'POST',
                  body: new URLSearchParams({
                    action: 'chooseWinner',
                    duel_id: duelId,
                    winner_id: winnerId,
                    winner_game_id: winnerGameId
                  }),
                  credentials: 'same-origin'
                }
              );

              return await res.json();

            },
            {
              duelId: duelRes.duel_id,
              winnerId: winner,
              winnerGameId
            }
          );


          console.log(
            `👑 Judged duel ${duelRes.duel_id} ✔️`
          );

          return;
        }


        await page.waitForTimeout(pollInterval);
      }


      console.log(
        '❌ Timeout: Could not get valid duel data in 10s. Skipping.'
      );
    }


    console.log(
      "🔷 Starting Beauty Pageant energy burn..."
    );


    try {

      while (true) {

        await page.goto(
          'https://v3.g.ladypopular.com/beauty_pageant.php',
          {
            waitUntil: 'domcontentloaded',
            timeout: 60000
          }
        );

        await page.waitForTimeout(5000);


        const {
          blueEnergy,
          judgeCycles
        } = await getJudgeCycles();


        console.log(
          `🔷 You have ${blueEnergy} blue energy. Judge cycles: ${judgeCycles}`
        );


        if (judgeCycles < 1) {

          console.log(
            "✅ No judge cycles left. Skipping Beauty Pageant judging."
          );

          break;
        }


        for (
          let i = 0;
          i < judgeCycles;
          i++
        ) {

          try {

            await performJudgeCycle();

            await page.waitForTimeout(3000);

          } catch (err) {

            console.log(
              `⚠️ Judge cycle ${i + 1} failed: ${err.message}`
            );

          }
        }
      }

    } catch (err) {

      // Beauty Pageant failure must not prevent
      // the rest of the script.
      console.log(
        `⚠️ Beauty Pageant section failed: ${err.message}`
      );

    }
  }


  // ==============================================================
  // 🟧 FASHION ARENA
  // ==============================================================

  async function runFashionArena() {

    let arenaEnergy = 1;
    let arenaErrors = 0;


    while (arenaEnergy > 0) {

      try {

        console.log(
          "🟧 Navigating to BP..."
        );


        await page.goto(
          'https://v3.g.ladypopular.com/beauty_pageant.php',
          {
            timeout: 60000
          }
        );


        for (let i = 1; i <= 3; i++) {

          console.log(
            `🔄 Refreshing Fashion Arena page (${i}/3)...`
          );

          await page.reload({
            timeout: 30000
          });

          await page.waitForLoadState(
            'domcontentloaded'
          );
        }


        const energyText =
          await page.innerText(
            '#header > div.wrapper > div > div.player-panel-middle > div.player-panel-energy > a.player-energy.player-arena-energy > span.player-energy-value > span'
          );


        arenaEnergy =
          parseInt(energyText.trim());


        if (
          arenaEnergy <= 0 ||
          isNaN(arenaEnergy)
        ) {

          console.log(
            "✅ No energy left. Skipping Fashion Arena."
          );

          break;
        }


        console.log(
          `🔋 You have ${arenaEnergy} energy. Starting duels...`
        );


        for (
          let i = 0;
          i < arenaEnergy;
          i++
        ) {

          try {

            await page.evaluate(() => {

              return fetch(
                'https://v3.g.ladypopular.com/ajax/arena.php',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type':
                      'application/x-www-form-urlencoded',
                    'X-Requested-With':
                      'XMLHttpRequest'
                  },
                  body: new URLSearchParams({
                    action: 'challenge'
                  })
                }
              );

            });


            console.log(
              `⚔️ Duel ${i + 1}`
            );

            await page.waitForTimeout(100);

          } catch (e) {

            console.log(
              `⚠️ Duel ${i + 1} failed: ${e.message}`
            );

            throw e;
          }
        }


        await page.reload({
          timeout: 30000
        });

        await page.waitForLoadState(
          'domcontentloaded'
        );


        const energyAfter =
          await page.innerText(
            '#header > div.wrapper > div > div.player-panel-middle > div.player-panel-energy > a.player-energy.player-arena-energy > span.player-energy-value > span'
          );


        arenaEnergy =
          parseInt(energyAfter.trim());


        if (arenaEnergy > 0) {

          console.log(
            `🔁 Still ${arenaEnergy} energy left. Repeating duels.`
          );

        } else {

          console.log(
            "✅ Finished all duels in Fashion Arena."
          );

          break;
        }


        // Successful cycle resets consecutive errors.
        arenaErrors = 0;


      } catch (err) {

        arenaErrors++;


        console.log(
          `⚠️ Fashion Arena error ${arenaErrors}/3: ${err.message}`
        );


        if (arenaErrors >= 3) {

          console.log(
            "⛔ Fashion Arena failed 3 times. Moving on."
          );

          break;
        }


        console.log(
          "🔁 Refreshing page to retry Fashion Arena..."
        );


        try {

          await page.reload({
            timeout: 60000
          });

          await page.waitForTimeout(5000);

        } catch (reloadError) {

          console.log(
            `⚠️ Retry refresh failed: ${reloadError.message}`
          );

        }
      }
    }
  }


  // ==============================================================
  // 🔄 FINAL EXECUTION ORDER
  // ==============================================================

  // 1️⃣ FIRST TICKET SPENDING
  await spendExcessTickets();


  // 2️⃣ FIRST BEAUTY PAGEANT
  await runBeautyPageant();


  // 3️⃣ SECOND TICKET SPENDING
  await spendExcessTickets();


  // 4️⃣ FASHION ARENA
  await runFashionArena();


  // 5️⃣ FINAL BEAUTY PAGEANT
  await runBeautyPageant();


  // 6️⃣ FINAL TICKET SPENDING
  await spendExcessTickets();


  console.log(
    "🏁 Burn Energy finished."
  );
};
