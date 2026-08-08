```js
// parties.js

module.exports = async function runParties(page) {
  console.log("🎉 ================================");
  console.log("🎉 Starting Parties Script");
  console.log("🎉 ================================");

  const BASE_URL = 'https://v3.g.ladypopular.com';
  const PARTY_CENTER_URL = `${BASE_URL}/party/center.php`;
  const PARTY_AJAX_URL = `${BASE_URL}/ajax/party/party.php`;

  // ============================================================
  // STEP 1
  // Navigate to Party Center
  // ============================================================

  console.log("\n📍 STEP 1: Opening Party Center...");
  console.log(`🌐 URL: ${PARTY_CENTER_URL}`);

  await page.goto(PARTY_CENTER_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log("✅ Party Center page loaded.");
  console.log(`🔗 Current URL: ${page.url()}`);

  // ============================================================
  // STEP 2
  // Check for an active party
  // ============================================================

  console.log("\n🔎 STEP 2: Checking for an active party...");

  // There should only ever be one active party.
  const activeParty = await page.$('li.party-panel.active');

  if (!activeParty) {
    console.log("🚫 No active party found.");
    console.log("⏭️ No further party actions are needed.");
    console.log("🛑 Parties Script finished.");

    return;
  }

  console.log("🎉 Active party found!");

  // ------------------------------------------------------------
  // Get party owner/title
  // ------------------------------------------------------------

  const partyOwnerName = await activeParty
    .$eval(
      'h1.party-owners-names a.party-owners-names-link',
      el => el.textContent.trim()
    )
    .catch(() => null);

  // ------------------------------------------------------------
  // Get the party URL strip
  // Example:
  // /party/engagement.php?party=11463
  // ------------------------------------------------------------

  const partyUrlStrip = await activeParty
    .$eval(
      'div.buttons-wrap a.gradient.gradient-oval',
      el => el.getAttribute('href')
    )
    .catch(() => null);

  if (!partyUrlStrip) {
    console.log("❌ Active party was found, but its party URL could not be extracted.");
    console.log("🛑 Stopping Parties Script.");
    return;
  }

  // ------------------------------------------------------------
  // Extract Party ID from URL strip
  // Example:
  // /party/engagement.php?party=11463
  //                         ^^^^^
  // ------------------------------------------------------------

  const partyIdMatch = partyUrlStrip.match(/[?&]party=(\d+)/);

  if (!partyIdMatch) {
    console.log(`❌ Could not extract Party ID from URL strip: ${partyUrlStrip}`);
    console.log("🛑 Stopping Parties Script.");
    return;
  }

  const partyId = partyIdMatch[1];

  console.log("────────────────────────────────");
  console.log("🎊 ACTIVE PARTY INFORMATION");
  console.log("────────────────────────────────");
  console.log(`👤 Party owner/name: ${partyOwnerName || 'Unknown'}`);
  console.log(`🔗 Party URL strip: ${partyUrlStrip}`);
  console.log(`🆔 Party ID: ${partyId}`);

  // ============================================================
  // STEP 3
  // Navigate to the actual party page
  // ============================================================

  const partyFullUrl = `${BASE_URL}${partyUrlStrip}`;

  console.log("\n📍 STEP 3: Opening active party page...");
  console.log(`🌐 Full party URL: ${partyFullUrl}`);

  await page.goto(partyFullUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log("✅ Party page loaded.");
  console.log(`🔗 Current URL: ${page.url()}`);

  // ============================================================
  // STEP 4
  // Take party attendance bonus
  // ============================================================

  console.log("\n🎁 STEP 4: Collecting party attendance bonus...");
  console.log("📡 Sending internal party bonus request...");

  try {
    const bonusResponse = await page.evaluate(async ({ partyId }) => {
      const response = await fetch('/ajax/party/party.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: new URLSearchParams({
          type: 'takeBonus',
          party: partyId
        })
      });

      const text = await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        data = {
          rawResponse: text
        };
      }

      return {
        ok: response.ok,
        status: response.status,
        data
      };
    }, { partyId });

    console.log(`📡 HTTP status: ${bonusResponse.status}`);
    console.log(`📡 Request successful: ${bonusResponse.ok}`);

    if (bonusResponse.data?.status === 1) {
      console.log("✅ Party attendance bonus collected successfully!");

      if (bonusResponse.data?.bonus?.item) {
        console.log(
          `🎁 Bonus received: ${bonusResponse.data.bonus.item.name || 'Unknown item'}`
        );
      }
    } else {
      console.log("⚠️ Party bonus request returned a non-success status.");
      console.log("📦 Server response:");
      console.log(JSON.stringify(bonusResponse.data, null, 2));
    }
  } catch (error) {
    console.log(`❌ Error while collecting party bonus: ${error.message}`);
  }

  // ============================================================
  // STEP 5
  // Refresh party page and collect completed quest IDs
  // ============================================================

  console.log("\n📍 STEP 5: Refreshing party page...");
  console.log("🔄 Reloading so we can inspect the latest completed quests...");

  await page.reload({
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log("✅ Party page refreshed.");
  console.log(`🔗 Current URL: ${page.url()}`);

  console.log("\n🔎 Looking for completed party quests...");

  // ------------------------------------------------------------
  // Completed quests have IDs like:
  //
  // completed-quest-760049
  // completed-quest-760050
  //
  // We extract only the numerical portion.
  // ------------------------------------------------------------

  const completedQuestIds = await page.$$eval(
    '[id^="completed-quest-"]',
    elements => {
      const ids = new Set();

      for (const element of elements) {
        const match = element.id.match(/^completed-quest-(\d+)$/);

        if (match) {
          ids.add(match[1]);
        }
      }

      return [...ids];
    }
  );

  // Store them in a Set as requested.
  const quest_data_id = new Set(completedQuestIds);

  console.log(`📋 Completed quest count: ${quest_data_id.size}`);

  if (quest_data_id.size === 0) {
    console.log("ℹ️ No completed quests found.");
  } else {
    console.log("🎯 Completed quest IDs found:");

    for (const questId of quest_data_id) {
      console.log(`   └── ${questId}`);
    }
  }

  // ============================================================
  // STEP 6
  // Collect reward for each completed quest
  // ============================================================

  if (quest_data_id.size === 0) {
    console.log("\n⏭️ No quest rewards to collect.");
    console.log("🎉 Parties Script finished.");
    return;
  }

  console.log("\n📍 STEP 6: Collecting completed quest rewards...");
  console.log(`🎁 Total rewards to collect: ${quest_data_id.size}`);
  console.log(`🆔 Party ID being used: ${partyId}`);

  let successfulRewards = 0;
  let failedRewards = 0;

  for (const questId of quest_data_id) {
    console.log("\n────────────────────────────────");
    console.log(`🎁 Collecting reward for quest: ${questId}`);
    console.log("────────────────────────────────");

    console.log("📡 Request payload:");
    console.log(`   type          = takePartyQuestReward`);
    console.log(`   party         = ${partyId}`);
    console.log(`   quest_data_id = ${questId}`);

    try {
      const rewardResponse = await page.evaluate(
        async ({ partyId, questId }) => {
          const response = await fetch('/ajax/party/party.php', {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin',
            body: new URLSearchParams({
              type: 'takePartyQuestReward',
              party: partyId,
              quest_data_id: questId
            })
          });

          const text = await response.text();

          let data;

          try {
            data = JSON.parse(text);
          } catch {
            data = {
              rawResponse: text
            };
          }

          return {
            ok: response.ok,
            status: response.status,
            data
          };
        },
        {
          partyId,
          questId
        }
      );

      console.log(`📡 HTTP status: ${rewardResponse.status}`);
      console.log(`📡 Request successful: ${rewardResponse.ok}`);

      if (rewardResponse.data?.status === 1) {
        successfulRewards++;

        console.log(`✅ Reward successfully collected for quest ${questId}!`);

        // Show FP if the server included it.
        if (rewardResponse.data?.reward?.fp !== undefined) {
          console.log(
            `💰 Fashion Points received: ${rewardResponse.data.reward.fp}`
          );
        }
      } else {
        failedRewards++;

        console.log(
          `⚠️ Server did not report success for quest ${questId}.`
        );

        console.log("📦 Server response:");
        console.log(JSON.stringify(rewardResponse.data, null, 2));
      }
    } catch (error) {
      failedRewards++;

      console.log(
        `❌ Error collecting reward for quest ${questId}: ${error.message}`
      );
    }
  }

  // ============================================================
  // FINAL SUMMARY
  // ============================================================

  console.log("\n🎉 ================================");
  console.log("🎉 Parties Script Complete");
  console.log("🎉 ================================");

  console.log(`👤 Party: ${partyOwnerName || 'Unknown'}`);
  console.log(`🆔 Party ID: ${partyId}`);
  console.log(`🔗 Party URL: ${partyFullUrl}`);

  console.log(`🎁 Attendance bonus: Processed`);
  console.log(`📋 Completed quests found: ${quest_data_id.size}`);
  console.log(`✅ Quest rewards successfully collected: ${successfulRewards}`);
  console.log(`❌ Quest rewards failed: ${failedRewards}`);

  console.log("🏁 ================================");
};
```
