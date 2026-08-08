// parties.js

module.exports = async function runParties(page) {
  console.log("🎉 ================================");
  console.log("🎉 Starting Parties Script");
  console.log("🎉 ================================");

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
   * The Party Center can contain a bridesmaid entry like:
   *
   *   /party/center/planning.php?bridesmaid_party_id=7943
   *
   * That is NOT the actual active party.
   *
   * The actual party has a link containing:
   *
   *   /party/engagement.php?party=11365
   *
   * or:
   *
   *   /party/wedding.php?party=16365
   *
   * Therefore we specifically require:
   *
   *   ?party=
   *
   * and exclude the bridesmaid panel.
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
  // Examples:
  //
  // /party/engagement.php?party=11365
  // /party/wedding.php?party=16365
  // ------------------------------------------------------------

  const partyUrlStrip =
    await activePartyLink.getAttribute('href');

  if (!partyUrlStrip) {
    console.log(
      "❌ Active party found, but party URL could not be extracted."
    );

    console.log("🛑 Stopping Parties Script.");
    return;
  }

  // ------------------------------------------------------------
  // Extract Party ID
  // ------------------------------------------------------------

  const partyIdMatch =
    partyUrlStrip.match(/[?&]party=(\d+)/);

  if (!partyIdMatch) {
    console.log("❌ Could not extract Party ID.");
    console.log(
      "🔗 Party URL strip: " +
      partyUrlStrip
    );

    console.log("🛑 Stopping Parties Script.");
    return;
  }

  const partyId = partyIdMatch[1];

  console.log("────────────────────────────────");
  console.log("🎊 ACTIVE PARTY INFORMATION");
  console.log("────────────────────────────────");

  console.log(
    "👤 Party owner/name: " +
    (partyOwnerName || "Unknown")
  );

  console.log(
    "🔗 Party URL strip: " +
    partyUrlStrip
  );

  console.log(
    "🆔 Party ID: " +
    partyId
  );

  // ------------------------------------------------------------
  // Detect party type for logging
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
    "💒 Party type: " +
    partyType
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

  console.log(
    "\n📍 STEP 3: Opening active party page..."
  );

  console.log(
    "🌐 Full party URL: " +
    partyFullUrl
  );

  await page.goto(partyFullUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log("✅ Party page loaded.");
  console.log(
    "🔗 Current URL: " +
    page.url()
  );

  // ============================================================
  // STEP 4
  // Collect party attendance bonus
  // ============================================================

  console.log(
    "\n🎁 STEP 4: Collecting party attendance bonus..."
  );

  console.log(
    "📡 Sending internal party bonus request..."
  );

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

    console.log(
      "📡 HTTP status: " +
      bonusResponse.status
    );

    console.log(
      "📡 Request successful: " +
      bonusResponse.ok
    );

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
          (
            bonusResponse.data.bonus.item.name ||
            "Unknown item"
          )
        );
      }
    } else {
      console.log(
        "⚠️ Party bonus request returned a non-success status."
      );

      console.log("📦 Server response:");

      console.log(
        JSON.stringify(
          bonusResponse.data,
          null,
          2
        )
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
  // Reload party page, OPEN MISSIONS TAB, then find quests
  // ============================================================

  console.log(
    "\n📍 STEP 5: Refreshing party page..."
  );

  console.log(
    "🔄 Reloading before opening the Missions tab..."
  );

  await page.reload({
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log(
    "✅ Party page refreshed."
  );

  console.log(
    "🔗 Current URL: " +
    page.url()
  );

  // ------------------------------------------------------------
  // STEP 5A
  // Wait for the party tabs to exist
  // ------------------------------------------------------------

  console.log(
    "\n⏳ Waiting for party tabs to appear..."
  );

  try {
    await page.waitForSelector(
      'li.quests-tab',
      {
        timeout: 20000
      }
    );

    console.log(
      "✅ Missions tab found."
    );
  } catch (error) {
    console.log(
      "⚠️ Missions tab did not appear within the timeout."
    );
  }

  // ------------------------------------------------------------
  // STEP 5B
  // Inspect the Missions tab before opening it
  // ------------------------------------------------------------

  const missionsTabInfo =
    await page.evaluate(() => {
      const tab =
        document.querySelector(
          'li.quests-tab'
        );

      if (!tab) {
        return null;
      }

      return {
        exists: true,

        className:
          tab.className,

        onclick:
          tab.getAttribute('onclick'),

        activeQuestData:
          tab.getAttribute(
            'data-active-quest-data'
          ),

        rewardClaimed:
          tab.getAttribute(
            'data-is-reward-claimed'
          )
      };
    });

  console.log(
    "\n🔬 Missions tab information:"
  );

  console.log(
    JSON.stringify(
      missionsTabInfo,
      null,
      2
    )
  );

  // ------------------------------------------------------------
  // STEP 5C
  // OPEN THE MISSIONS TAB
  //
  // This is the important part.
  //
  // The completed quest HTML is not necessarily present while
  // the Missions tab is closed.
  //
  // Clicking the tab invokes:
  //
  //   getPartyTab('quests', this)
  //
  // which loads/populates the quest contents.
  // ------------------------------------------------------------

  console.log(
    "\n📂 Opening Missions tab..."
  );

  let missionsTabOpened = false;

  try {
    const missionsTab =
      await page.$(
        'li.quests-tab'
      );

    if (missionsTab) {
      await missionsTab.click();

      missionsTabOpened = true;

      console.log(
        "✅ Missions tab clicked."
      );
    } else {
      console.log(
        "⚠️ Could not find Missions tab element."
      );
    }
  } catch (error) {
    console.log(
      "⚠️ Normal Missions tab click failed: " +
      error.message
    );
  }

  // ------------------------------------------------------------
  // STEP 5D
  // If normal click failed, directly call getPartyTab()
  // ------------------------------------------------------------

  if (!missionsTabOpened) {
    console.log(
      "🔄 Trying site's getPartyTab('quests') function..."
    );

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
              success: false,
              reason:
                !tab
                  ? 'Missions tab not found'
                  : 'getPartyTab function not available'
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

      console.log(
        "🔬 Direct Missions-tab result:"
      );

      console.log(
        JSON.stringify(
          directResult,
          null,
          2
        )
      );

      if (directResult.success) {
        missionsTabOpened = true;
      }
    } catch (error) {
      console.log(
        "❌ Direct getPartyTab() call failed: " +
        error.message
      );
    }
  }

  // ------------------------------------------------------------
  // STEP 5E
  // Wait for the dynamically loaded quest content
  // ------------------------------------------------------------

  console.log(
    "\n⏳ Waiting for Missions tab content..."
  );

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

    console.log(
      "✅ Completed quest content loaded."
    );
  } catch (error) {
    console.log(
      "⚠️ Timed out waiting for completed quest content."
    );

    console.log(
      "🔎 We will still inspect the page."
    );
  }

  // ------------------------------------------------------------
  // Give the DOM a tiny moment to finish rendering.
  // ------------------------------------------------------------

  await page.waitForTimeout(500);

  // ============================================================
  // STEP 5F
  // Collect completed quest IDs
  // ============================================================

  console.log(
    "\n🔎 Looking for completed party quests..."
  );

  // ------------------------------------------------------------
  // Source 1:
  // data-completed-quests-ids
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
  // completed-quest elements
  //
  // Example:
  //
  // <div id="completed-quest-760051">
  //
  // <div id="completed-quest-760052">
  // ------------------------------------------------------------

  const questIdsFromElements =
    await page.$$eval(
      '#questsHolder [id^="completed-quest-"]',
      function(elements) {
        const ids = [];

        for (
          const element of elements
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
  // Search the whole document as a fallback.
  //
  // This is useful if the game's HTML structure changes and
  // completed quests are rendered somewhere outside #questsHolder.
  // ------------------------------------------------------------

  const questIdsFromDocument =
    await page.$$eval(
      '[id^="completed-quest-"]',
      function(elements) {
        const ids = [];

        for (
          const element of elements
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
  // STEP 5G
  // Quest detection debug
  // ============================================================

  console.log(
    "\n🔬 Quest detection debug:"
  );

  console.log(
    "📌 IDs from data-completed-quests-ids: " +
    (
      questIdsFromDataAttribute.length > 0
        ? questIdsFromDataAttribute.join(", ")
        : "none"
    )
  );

  console.log(
    "📌 IDs from #questsHolder elements: " +
    (
      questIdsFromElements.length > 0
        ? questIdsFromElements.join(", ")
        : "none"
    )
  );

  console.log(
    "📌 IDs from entire document: " +
    (
      questIdsFromDocument.length > 0
        ? questIdsFromDocument.join(", ")
        : "none"
    )
  );

  console.log(
    "📌 Unique quest IDs after merging: " +
    (
      quest_data_id.size > 0
        ? Array.from(
            quest_data_id
          ).join(", ")
        : "none"
    )
  );

  console.log(
    "\n📋 Completed quest count: " +
    quest_data_id.size
  );

  if (
    quest_data_id.size === 0
  ) {
    console.log(
      "ℹ️ No completed quests found."
    );

    // ----------------------------------------------------------
    // Extra diagnostics
    // ----------------------------------------------------------

    const questDebugInfo =
      await page.evaluate(() => {
        const questsHolder =
          document.querySelector(
            '#questsHolder'
          );

        const activeQuestView =
          document.querySelector(
            '#active-quest-view'
          );

        const missionsTab =
          document.querySelector(
            'li.quests-tab'
          );

        return {
          questsHolderExists:
            !!questsHolder,

          completedQuestElements:
            questsHolder
              ? questsHolder.querySelectorAll(
                  '[id^="completed-quest-"]'
                ).length
              : 0,

          completedQuestElementsWholePage:
            document.querySelectorAll(
              '[id^="completed-quest-"]'
            ).length,

          activeQuestData:
            activeQuestView
              ? activeQuestView.getAttribute(
                  'data-completed-quests-ids'
                )
              : null,

          missionsTabExists:
            !!missionsTab,

          missionsTabClass:
            missionsTab
              ? missionsTab.className
              : null,

          missionsTabRewardClaimed:
            missionsTab
              ? missionsTab.getAttribute(
                  'data-is-reward-claimed'
                )
              : null
        };
      });

    console.log(
      "🔬 Additional quest diagnostics:"
    );

    console.log(
      JSON.stringify(
        questDebugInfo,
        null,
        2
      )
    );
  } else {
    console.log(
      "🎯 Completed quest IDs found:"
    );

    for (
      const questId
      of quest_data_id
    ) {
      console.log(
        "   └── " +
        questId
      );
    }
  }

  // ============================================================
  // STEP 6
  // Collect reward for every completed quest
  // ============================================================

  if (
    quest_data_id.size === 0
  ) {
    console.log(
      "\n⏭️ No quest rewards to collect."
    );

    console.log(
      "🎉 Parties Script finished."
    );

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

  // ============================================================
  // Collect each reward
  // ============================================================

  for (
    const questId
    of quest_data_id
  ) {
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

    console.log(
      "📡 Request payload:"
    );

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

        console.log(
          "📦 Server response:"
        );

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

  console.log(
    "\n🎉 ================================"
  );

  console.log(
    "🎉 Parties Script Complete"
  );

  console.log(
    "🎉 ================================"
  );

  console.log(
    "👤 Party: " +
    (partyOwnerName || "Unknown")
  );

  console.log(
    "💒 Party type: " +
    partyType
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
