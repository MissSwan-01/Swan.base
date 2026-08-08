// parties.js

module.exports = async function runParties(page) {
  console.log("🎉 ================================");
  console.log("🎉 Starting Parties Script");
  console.log("🎉 ================================");

  const BASE_URL = 'https://v3.g.ladypopular.com';
  const PARTY_CENTER_URL = 'https://v3.g.ladypopular.com/party/center.php';
  const PARTY_AJAX_URL = 'https://v3.g.ladypopular.com/ajax/party/party.php';

  // ============================================================
  // STEP 1
  // Navigate to Party Center
  // ============================================================

  console.log("\n📍 STEP 1: Opening Party Center...");
  console.log("🌐 URL: " + PARTY_CENTER_URL);

  await page.goto(PARTY_CENTER_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log("✅ Party Center page loaded.");
  console.log("🔗 Current URL: " + page.url());

  // ============================================================
  // STEP 2
  // Check for an actual active engagement/wedding party
  // ============================================================

  console.log("\n🔎 STEP 2: Checking for an active party...");

  /*
   * IMPORTANT:
   *
   * The Party Center also contains a bridesmaid entry like:
   *
   *   <li class="party-panel active brides">
   *       ...
   *       /party/center/planning.php?bridesmaid_party_id=7943
   *
   * That is NOT the party we want.
   *
   * The actual active party has a link like:
   *
   *   /party/engagement.php?party=11365
   *
   * Therefore we specifically look for a party link containing
   * "?party=" instead of simply selecting ".party-panel.active".
   */

  const activePartyLink = await page.$(
    'li.party-panel.active:not(.brides) a[href*="/party/"][href*="?party="]'
  );

  if (!activePartyLink) {
    console.log("🚫 No active engagement/wedding party found.");
    console.log("⏭️ No further party actions are needed.");
    console.log("🛑 Parties Script finished.");
    return;
  }

  console.log("🎉 Active party found!");

  // ------------------------------------------------------------
  // Get the containing party panel
  // ------------------------------------------------------------

  const activeParty = await activePartyLink.evaluate(el => {
    const panel = el.closest('li.party-panel');
    return panel ? panel.outerHTML : null;
  });

  // ------------------------------------------------------------
  // Get party owner/name
  // ------------------------------------------------------------

  let partyOwnerName = null;

  try {
    partyOwnerName = await activePartyLink.evaluate(el => {
      const panel = el.closest('li.party-panel');

      const ownerLink = panel?.querySelector(
        'h1.party-owners-names a.party-owners-names-link'
      );

      return ownerLink
        ? ownerLink.textContent.trim()
        : null;
    });
  } catch (error) {
    console.log("⚠️ Could not extract party owner/name.");
  }

  // ------------------------------------------------------------
  // Get party URL
  //
  // Example:
  // /party/engagement.php?party=11365
  // ------------------------------------------------------------

  const partyUrlStrip = await activePartyLink.getAttribute('href');

  if (!partyUrlStrip) {
    console.log("❌ Active party found, but party URL could not be extracted.");
    console.log("🛑 Stopping Parties Script.");
    return;
  }

  // ------------------------------------------------------------
  // Extract Party ID
  // ------------------------------------------------------------

  const partyIdMatch = partyUrlStrip.match(/[?&]party=(\d+)/);

  if (!partyIdMatch) {
    console.log("❌ Could not extract Party ID.");
    console.log("🔗 Party URL strip: " + partyUrlStrip);
    console.log("🛑 Stopping Parties Script.");
    return;
  }

  const partyId = partyIdMatch[1];

  console.log("────────────────────────────────");
  console.log("🎊 ACTIVE PARTY INFORMATION");
  console.log("────────────────────────────────");
  console.log("👤 Party owner/name: " + (partyOwnerName || "Unknown"));
  console.log("🔗 Party URL strip: " + partyUrlStrip);
  console.log("🆔 Party ID: " + partyId);

  // ============================================================
  // STEP 3
  // Navigate to party page
  // ============================================================

  const partyFullUrl = new URL(
    partyUrlStrip,
    BASE_URL
  ).href;

  console.log("\n📍 STEP 3: Opening active party page...");
  console.log("🌐 Full party URL: " + partyFullUrl);

  await page.goto(partyFullUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log("✅ Party page loaded.");
  console.log("🔗 Current URL: " + page.url());

  // ============================================================
  // STEP 4
  // Collect party attendance bonus
  // ============================================================

  console.log("\n🎁 STEP 4: Collecting party attendance bonus...");
  console.log("📡 Sending internal party bonus request...");

  try {
    const bonusResponse = await page.evaluate(async function(partyId) {
      const response = await fetch('/ajax/party/party.php', {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded; charset=UTF-8',
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
        data: data
      };
    }, partyId);

    console.log("📡 HTTP status: " + bonusResponse.status);
    console.log("📡 Request successful: " + bonusResponse.ok);

    if (
      bonusResponse.data &&
      bonusResponse.data.status === 1
    ) {
      console.log(
        "✅ Party attendance bonus collected successfully!"
      );

      if (
        bonusResponse.data.bonus &&
        bonusResponse.data.bonus.item
      ) {
        console.log(
          "🎁 Bonus received: " +
          (bonusResponse.data.bonus.item.name || "Unknown item")
        );
      }
    } else {
      console.log(
        "⚠️ Party bonus request returned a non-success status."
      );

      console.log("📦 Server response:");
      console.log(
        JSON.stringify(bonusResponse.data, null, 2)
      );
    }
  } catch (error) {
    console.log(
      "❌ Error while collecting party bonus: " +
      error.message
    );
  }

  // ============================================================
  // STEP 5
  // Refresh party page and collect completed quest IDs
  // ============================================================

  console.log("\n📍 STEP 5: Refreshing party page...");
  console.log(
    "🔄 Reloading so we can inspect completed quests..."
  );

  await page.reload({
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log("✅ Party page refreshed.");
  console.log("🔗 Current URL: " + page.url());

  console.log("\n🔎 Looking for completed party quests...");

  const completedQuestIds = await page.$$eval(
    '[id^="completed-quest-"]',
    function(elements) {
      const ids = new Set();

      for (const element of elements) {
        const match = element.id.match(
          /^completed-quest-(\d+)$/
        );

        if (match) {
          ids.add(match[1]);
        }
      }

      return Array.from(ids);
    }
  );

  const quest_data_id = new Set(completedQuestIds);

  console.log(
    "📋 Completed quest count: " +
    quest_data_id.size
  );

  if (quest_data_id.size === 0) {
    console.log("ℹ️ No completed quests found.");
  } else {
    console.log("🎯 Completed quest IDs found:");

    for (const questId of quest_data_id) {
      console.log("   └── " + questId);
    }
  }

  // ============================================================
  // STEP 6
  // Collect reward for every completed quest
  // ============================================================

  if (quest_data_id.size === 0) {
    console.log("\n⏭️ No quest rewards to collect.");
    console.log("🎉 Parties Script finished.");
    return;
  }

  console.log(
    "\n📍 STEP 6: Collecting completed quest rewards..."
  );

  console.log(
    "🎁 Total rewards to collect: " +
    quest_data_id.size
  );

  console.log(
    "🆔 Party ID being used: " +
    partyId
  );

  let successfulRewards = 0;
  let failedRewards = 0;

  for (const questId of quest_data_id) {
    console.log(
      "\n────────────────────────────────"
    );

    console.log(
      "🎁 Collecting reward for quest: " +
      questId
    );

    console.log(
      "────────────────────────────────"
    );

    console.log("📡 Request payload:");
    console.log(
      "   type          = takePartyQuestReward"
    );

    console.log(
      "   party         = " +
      partyId
    );

    console.log(
      "   quest_data_id = " +
      questId
    );

    try {
      const rewardResponse = await page.evaluate(
        async function(data) {
          const response = await fetch(
            '/ajax/party/party.php',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
              },

              credentials: 'same-origin',

              body: new URLSearchParams({
                type: 'takePartyQuestReward',
                party: data.partyId,
                quest_data_id: data.questId
              })
            }
          );

          const text = await response.text();

          let responseData;

          try {
            responseData = JSON.parse(text);
          } catch {
            responseData = {
              rawResponse: text
            };
          }

          return {
            ok: response.ok,
            status: response.status,
            data: responseData
          };
        },
        {
          partyId: partyId,
          questId: questId
        }
      );

      console.log(
        "📡 HTTP status: " +
        rewardResponse.status
      );

      console.log(
        "📡 Request successful: " +
        rewardResponse.ok
      );

      if (
        rewardResponse.data &&
        rewardResponse.data.status === 1
      ) {
        successfulRewards++;

        console.log(
          "✅ Reward successfully collected for quest " +
          questId +
          "!"
        );

        if (
          rewardResponse.data.reward &&
          rewardResponse.data.reward.fp !== undefined
        ) {
          console.log(
            "💰 Fashion Points received: " +
            rewardResponse.data.reward.fp
          );
        }
      } else {
        failedRewards++;

        console.log(
          "⚠️ Server did not report success for quest " +
          questId +
          "."
        );

        console.log("📦 Server response:");

        console.log(
          JSON.stringify(
            rewardResponse.data,
            null,
            2
          )
        );
      }
    } catch (error) {
      failedRewards++;

      console.log(
        "❌ Error collecting reward for quest " +
        questId +
        ": " +
        error.message
      );
    }
  }

  // ============================================================
  // FINAL SUMMARY
  // ============================================================

  console.log("\n🎉 ================================");
  console.log("🎉 Parties Script Complete");
  console.log("🎉 ================================");

  console.log(
    "👤 Party: " +
    (partyOwnerName || "Unknown")
  );

  console.log(
    "🆔 Party ID: " +
    partyId
  );

  console.log(
    "🔗 Party URL: " +
    partyFullUrl
  );

  console.log(
    "🎁 Attendance bonus: Processed"
  );

  console.log(
    "📋 Completed quests found: " +
    quest_data_id.size
  );

  console.log(
    "✅ Quest rewards successfully collected: " +
    successfulRewards
  );

  console.log(
    "❌ Quest rewards failed: " +
    failedRewards
  );

  console.log(
    "🏁 ================================"
  );
};
