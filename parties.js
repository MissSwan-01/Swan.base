// parties.js

module.exports = async function runParties(page) {
  console.log("\n🎉 Starting Parties Script");

  const BASE_URL =
    'https://v3.g.ladypopular.com';

  const PARTY_CENTER_URL =
    'https://v3.g.ladypopular.com/party/center.php';

  const PARTY_AJAX_URL =
    'https://v3.g.ladypopular.com/ajax/party/party.php';

  // ============================================================
  // STEP 1
  // Navigate to Party Center
  // ============================================================

  await page.goto(PARTY_CENTER_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // ============================================================
  // STEP 2
  // Check for an actual active engagement/wedding party
  //
  // IMPORTANT:
  // The Party Center can contain a bridesmaid entry such as:
  //
  //   /party/center/planning.php?bridesmaid_party_id=7943
  //
  // That is NOT the actual active party.
  //
  // The actual party has a link containing:
  //
  //   /party/engagement.php?party=11365
  //
  // or:
  //
  //   /party/wedding.php?party=16365
  //
  // Therefore we specifically require ?party= and exclude
  // the bridesmaid panel.
  // ============================================================

  const activePartyLink = await page.$(
    'li.party-panel.active:not(.brides) a[href*="/party/"][href*="?party="]'
  );

  if (!activePartyLink) {
    console.log("ℹ️ No active engagement/wedding party.");
    return;
  }

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
    // Not critical. The script can continue without the name.
  }

  // ------------------------------------------------------------
  // Get party URL
  // ------------------------------------------------------------

  const partyUrlStrip =
    await activePartyLink.getAttribute('href');

  if (!partyUrlStrip) {
    console.log("❌ Active party found, but URL could not be extracted.");
    return;
  }

  // ------------------------------------------------------------
  // Extract Party ID
  // ------------------------------------------------------------

  const partyIdMatch =
    partyUrlStrip.match(/[?&]party=(\d+)/);

  if (!partyIdMatch) {
    console.log("❌ Could not extract Party ID.");
    return;
  }

  const partyId = partyIdMatch[1];

  // ------------------------------------------------------------
  // Detect party type
  // ------------------------------------------------------------

  let partyType = "Unknown";

  if (
    partyUrlStrip.includes(
      "/party/engagement.php"
    )
  ) {
    partyType = "Engagement";
  } else if (
    partyUrlStrip.includes(
      "/party/wedding.php"
    )
  ) {
    partyType = "Wedding";
  }

  console.log(
    `🎊 Active ${partyType.toLowerCase()} party: ${partyOwnerName || "Unknown"} (ID ${partyId})`
  );

  // ============================================================
  // STEP 3
  // Navigate to party page
  // ============================================================

  const partyFullUrl =
    new URL(
      partyUrlStrip,
      BASE_URL
    ).href;

  await page.goto(partyFullUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // ============================================================
  // STEP 4
  // Collect party attendance bonus
  // ============================================================

  try {
    const bonusResponse =
      await page.evaluate(
        async function(partyId) {
          const response =
            await fetch(
              '/ajax/party/party.php',
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/x-www-form-urlencoded; charset=UTF-8',

                  'X-Requested-With':
                    'XMLHttpRequest'
                },

                credentials:
                  'same-origin',

                body:
                  new URLSearchParams({
                    type: 'takeBonus',
                    party: partyId
                  })
              }
            );

          const text =
            await response.text();

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
        },
        partyId
      );

    if (
      bonusResponse.data &&
      bonusResponse.data.status === 1
    ) {
      console.log("🎁 Attendance bonus collected.");
    } else {
      // "Already received" is a normal situation, so don't
      // treat it as an error or dump the entire server response.
      if (
        bonusResponse.data &&
        bonusResponse.data.message ===
          "You've already received this booster."
      ) {
        console.log("🎁 Attendance bonus already collected.");
      } else {
        console.log("⚠️ Attendance bonus could not be collected.");
      }
    }
  } catch (error) {
    console.log(
      "❌ Attendance bonus error: " +
      error.message
    );
  }

  // ============================================================
  // STEP 5
  // Reload party page, OPEN MISSIONS TAB, then find quests
  //
  // IMPORTANT:
  // When the Missions tab is closed, the completed quest
  // elements are not necessarily present in the DOM.
  //
  // Therefore the sequence is:
  //
  //   1. Reload
  //   2. Wait for Missions tab
  //   3. Open Missions tab using the game's existing function
  //   4. Wait for quest content
  //   5. Collect completed quest IDs
  // ============================================================

  await page.reload({
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // ------------------------------------------------------------
  // STEP 5A
  // Wait for the Missions tab to exist
  // ------------------------------------------------------------

  try {
    await page.waitForSelector(
      'li.quests-tab',
      {
        timeout: 20000
      }
    );
  } catch (error) {
    console.log("⚠️ Missions tab did not appear.");
  }

  // ------------------------------------------------------------
  // STEP 5B
  // OPEN THE MISSIONS TAB
  //
  // The site's own function is:
  //
  //   getPartyTab('quests', this)
  //
  // We first use the normal element click.
  //
  // If that somehow fails, we fall back to directly invoking
  // the site's existing getPartyTab() function.
  // ------------------------------------------------------------

  let missionsTabOpened = false;

  try {
    const missionsTab =
      await page.$(
        'li.quests-tab'
      );

    if (missionsTab) {
      await missionsTab.click();

      missionsTabOpened = true;
    }
  } catch (error) {
    // Fall through to the direct getPartyTab() fallback.
  }

  // ------------------------------------------------------------
  // STEP 5C
  // Fallback: directly call the game's getPartyTab() function
  // ------------------------------------------------------------

  if (!missionsTabOpened) {
    try {
      const directResult =
        await page.evaluate(() => {
          const tab =
            document.querySelector(
              'li.quests-tab'
            );

          if (
            !tab ||
            typeof window.getPartyTab !==
              'function'
          ) {
            return {
              success: false
            };
          }

          window.getPartyTab(
            'quests',
            tab
          );

          return {
            success: true
          };
        });

      if (directResult.success) {
        missionsTabOpened = true;
      }
    } catch (error) {
      console.log(
        "❌ Could not open Missions tab: " +
        error.message
      );
    }
  }

  // ------------------------------------------------------------
  // STEP 5D
  // Wait for dynamically loaded completed quest content
  // ------------------------------------------------------------

  try {
    await page.waitForFunction(
      () => {
        const questsHolder =
          document.querySelector(
            '#questsHolder'
          );

        if (!questsHolder) {
          return false;
        }

        const completedQuests =
          questsHolder.querySelectorAll(
            '[id^="completed-quest-"]'
          );

        return completedQuests.length > 0;
      },
      {
        timeout: 20000
      }
    );
  } catch (error) {
    // We still inspect the page below. This makes the script
    // resilient if the game's loading timing changes slightly.
  }

  // Give the DOM a tiny moment to finish rendering.
  await page.waitForTimeout(500);

  // ============================================================
  // STEP 5E
  // Collect completed quest IDs
  // ============================================================

  // ------------------------------------------------------------
  // Source 1:
  // data-completed-quests-ids
  //
  // Example:
  //
  // data-completed-quests-ids='["760051","760052"]'
  //
  // This is particularly useful because it can contain multiple
  // completed quests even though only the latest active quest
  // is shown elsewhere on the page.
  // ------------------------------------------------------------

  const questIdsFromDataAttribute =
    await page.evaluate(() => {
      const activeQuestView =
        document.querySelector(
          '#active-quest-view[data-completed-quests-ids]'
        );

      if (!activeQuestView) {
        return [];
      }

      const rawValue =
        activeQuestView.getAttribute(
          'data-completed-quests-ids'
        );

      if (!rawValue) {
        return [];
      }

      try {
        const parsed =
          JSON.parse(rawValue);

        if (Array.isArray(parsed)) {
          return parsed
            .map(id => String(id))
            .filter(
              id => /^\d+$/.test(id)
            );
        }
      } catch (error) {
        // Ignore malformed attribute.
      }

      return [];
    });

  // ------------------------------------------------------------
  // Source 2:
  // completed-quest elements inside #questsHolder
  // ------------------------------------------------------------

  const questIdsFromElements =
    await page.$$eval(
      '#questsHolder [id^="completed-quest-"]',
      function(elements) {
        const ids = [];

        for (
          const element
          of elements
        ) {
          const match =
            element.id.match(
              /^completed-quest-(\d+)$/
            );

          if (match) {
            ids.push(match[1]);
          }
        }

        return ids;
      }
    );

  // ------------------------------------------------------------
  // Source 3:
  // Search the entire document as a fallback.
  // ------------------------------------------------------------

  const questIdsFromDocument =
    await page.$$eval(
      '[id^="completed-quest-"]',
      function(elements) {
        const ids = [];

        for (
          const element
          of elements
        ) {
          const match =
            element.id.match(
              /^completed-quest-(\d+)$/
            );

          if (match) {
            ids.push(match[1]);
          }
        }

        return ids;
      }
    );

  // ------------------------------------------------------------
  // Merge all sources.
  //
  // A Set prevents duplicate IDs when the same quest appears
  // in multiple places in the DOM.
  // ------------------------------------------------------------

  const quest_data_id =
    new Set();

  for (
    const questId
    of questIdsFromDataAttribute
  ) {
    quest_data_id.add(
      questId
    );
  }

  for (
    const questId
    of questIdsFromElements
  ) {
    quest_data_id.add(
      questId
    );
  }

  for (
    const questId
    of questIdsFromDocument
  ) {
    quest_data_id.add(
      questId
    );
  }

  // ============================================================
  // Quest summary
  // ============================================================

  if (
    quest_data_id.size === 0
  ) {
    console.log(
      "📋 No completed party quests found."
    );
  } else {
    console.log(
      `📋 Completed quests: ${quest_data_id.size} (${Array.from(quest_data_id).join(", ")})`
    );
  }

  // ============================================================
  // STEP 6
  // Collect reward for every completed quest
  // ============================================================

  if (
    quest_data_id.size === 0
  ) {
    console.log(
      "⏭️ No quest rewards to collect."
    );

    console.log(
      "✅ Parties finished."
    );

    return;
  }

  let successfulRewards = 0;
  let failedRewards = 0;

  // ------------------------------------------------------------
  // Collect each reward
  // ------------------------------------------------------------

  for (
    const questId
    of quest_data_id
  ) {
    try {
      const rewardResponse =
        await page.evaluate(
          async function(data) {
            const response =
              await fetch(
                '/ajax/party/party.php',
                {
                  method: 'POST',

                  headers: {
                    'Content-Type':
                      'application/x-www-form-urlencoded; charset=UTF-8',

                    'X-Requested-With':
                      'XMLHttpRequest'
                  },

                  credentials:
                    'same-origin',

                  body:
                    new URLSearchParams({
                      type:
                        'takePartyQuestReward',

                      party:
                        data.partyId,

                      quest_data_id:
                        data.questId
                    })
                }
              );

            const text =
              await response.text();

            let responseData;

            try {
              responseData =
                JSON.parse(text);
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

      if (
        rewardResponse.data &&
        rewardResponse.data.status === 1
      ) {
        successfulRewards++;

        const fp =
          rewardResponse.data.reward &&
          rewardResponse.data.reward.fp !== undefined
            ? rewardResponse.data.reward.fp
            : null;

        console.log(
          `🎁 Quest ${questId}: collected${fp !== null ? ` (+${fp} FP)` : ""}`
        );
      } else {
        failedRewards++;

        console.log(
          `⚠️ Quest ${questId}: reward collection failed.`
        );
      }
    } catch (error) {
      failedRewards++;

      console.log(
        `❌ Quest ${questId}: ${error.message}`
      );
    }
  }

  // ============================================================
  // FINAL SUMMARY
  // ============================================================

  console.log(
    `🎉 Parties finished — ${successfulRewards}/${quest_data_id.size} rewards collected.`
  );

  if (
    failedRewards > 0
  ) {
    console.log(
      `⚠️ Failed rewards: ${failedRewards}`
    );
  }
};
