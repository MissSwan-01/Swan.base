// ================================================================
// 🏠 APARTMENT INCOME + 🎁 GIFTS FLASHBACK EVENT
// ================================================================
//
// This script performs two jobs:
//
// 1. Collect apartment income.
// 2. If the player is NOT already playing a flashback event,
//    find an unlocked Gifts flashback event and activate one.
//
// IMPORTANT:
// - This script uses internal game requests instead of normal clicks
//   wherever possible.
// - The existing Playwright "page" from mspc.js is reused.
// ================================================================


module.exports = async function runApartmentAndGifts(page) {

  console.log('🏠 Apartment + Gifts flashback starting.');


  // ==============================================================
  // STEP 1 + STEP 2
  // 🏠 APARTMENT INCOME
  // ==============================================================

  await page.goto(
    'https://v3.g.ladypopular.com/apartment.php',
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }
  );


  // --------------------------------------------------------------
  // STEP 2
  // Collect apartment income using the game's internal request.
  //
  // The request observed from the game is:
  //
  // GET
  // /ajax/apartment.php?type=collectApartmentRent
  //
  // The response is not used to decide whether the collection
  // succeeded, because your instructions say that sending the
  // request is sufficient.
  // --------------------------------------------------------------

  try {

    const apartmentResponse = await page.evaluate(async () => {

      const response = await fetch(
        'https://v3.g.ladypopular.com/ajax/apartment.php?type=collectApartmentRent',
        {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        }
      );

      return await response.json();

    });


    if (apartmentResponse && apartmentResponse.status === 1) {

      console.log('💰 Apartment income collected.');

    } else {

      console.log(
        `⚠️ Apartment collection returned status=${apartmentResponse?.status}`
      );

    }

  } catch (error) {

    console.log(
      `❌ Apartment income failed: ${error.message}`
    );

    // We throw the error here because the apartment request itself
    // failed. This allows mspc.js to handle the failure normally.
    throw error;

  }


  // ==============================================================
  // STEP 3 + STEP 4
  // 🎁 OPEN GUILD PAGE
  // CHECK WHETHER A FLASHBACK EVENT IS ALREADY ACTIVE
  // ==============================================================

  await page.goto(
    'https://v3.g.ladypopular.com/guild.php',
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }
  );


  // --------------------------------------------------------------
  // STEP 4
  //
  // We need to determine whether an EVENT flashback is already
  // active.
  //
  // IMPORTANT:
  //
  // We specifically look for:
  //
  // .header-event-banner[data-is_flashback="1"]
  //
  // A normal/new event has:
  //
  // data-is_flashback=""
  //
  // An active flashback event has:
  //
  // data-is_flashback="1"
  //
  // We only care about the EVENT flashback slot here.
  // We do NOT treat a flashback collection as an active
  // flashback event.
  // --------------------------------------------------------------

  const activeFlashbackEvents = await page.locator(
    '#header-events-container .header-event-banner[data-is_flashback="1"]'
  ).count();


  // --------------------------------------------------------------
  // CASE 1
  // A flashback event is already active.
  //
  // According to your instructions:
  // STOP HERE.
  // Do not request the event list.
  // Do not activate another event.
  // --------------------------------------------------------------

  if (activeFlashbackEvents > 0) {

    console.log('🎁 Flashback event already active. Skipping.');

    return;

  }


  // --------------------------------------------------------------
  // CASE 2
  // No flashback event is active.
  //
  // Continue to Step 5.
  // --------------------------------------------------------------


  // ==============================================================
  // STEP 5
  // 🎁 GET GIFTS FLASHBACK EVENTS
  // ==============================================================

  let eventsResponse;


  try {

    eventsResponse = await page.evaluate(async () => {

      const response = await fetch(
        'https://v3.g.ladypopular.com/ajax/events.php',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
          },

          body: new URLSearchParams({
            'event_types[]': 'gifts',
            'ignore_won_rewards': 'false',
            'type': 'loadMoreEvents',
            'offset': '0',
            'name': ''
          }),

          credentials: 'same-origin'
        }
      );

      return await response.json();

    });


  } catch (error) {

    console.log(
      `❌ Failed to request Gifts events: ${error.message}`
    );

    throw error;

  }



  // --------------------------------------------------------------
  // Make sure the response has the structure we expect.
  // --------------------------------------------------------------

  if (!eventsResponse) {

    console.log('❌ Events response was empty.');

    throw new Error('Empty response received from events.php.');

  }


  if (eventsResponse.status !== 1) {

    console.log(
      `❌ Events request returned status=${eventsResponse.status}`
    );

    throw new Error(
      `Gifts flashback event request failed with status ${eventsResponse.status}.`
    );

  }



  // --------------------------------------------------------------
  // The event list is inside:
  //
  // response.search_events.list
  //
  // According to the response you provided.
  // --------------------------------------------------------------

  const events = eventsResponse.search_events?.list;


  if (!Array.isArray(events)) {

    console.log('❌ Invalid events response.');

    throw new Error(
      'Unexpected events response structure: search_events.list is missing.'
    );

  }



  // --------------------------------------------------------------
  // Separate the returned flashback events into:
  //
  // 🔒 LOCKED
  // 🟢 UNLOCKED
  //
  // Your rule:
  //
  // can_be_activated === true
  //       → unlocked
  //
  // can_be_activated === false
  //       → locked
  // --------------------------------------------------------------

  const unlockedEvents = [];
  const lockedEvents = [];


  for (const event of events) {

    // We are expecting flashback events here, but we still
    // explicitly check is_flashback so the script does not
    // accidentally treat some other record as a flashback event.

    if (event.is_flashback !== true) {

      continue;

    }


    if (event.can_be_activated === true) {

      unlockedEvents.push({
        id: event.id,
        title: event.title
      });

    } else {

      lockedEvents.push({
        id: event.id,
        title: event.title,
        lockReason: event.lock_type_info
      });

    }

  }



  // --------------------------------------------------------------
  // Log locked events.
  // --------------------------------------------------------------

  // --------------------------------------------------------------
  // Log unlocked events.
  // --------------------------------------------------------------



  // --------------------------------------------------------------
  // If there are no unlocked events, we cannot activate anything.
  // --------------------------------------------------------------

  if (unlockedEvents.length === 0) {

    console.log('🎁 No unlocked Gifts flashback events. Skipping.');

    return;

  }



  // ==============================================================
  // STEP 6
  // 🎯 RANDOMLY CHOOSE ONE UNLOCKED EVENT
  // ==============================================================

  // Your instructions say that only ONE event should be activated,
  // and that the event should be selected randomly.

  const randomIndex = Math.floor(
    Math.random() * unlockedEvents.length
  );


  const selectedEvent = unlockedEvents[randomIndex];


  console.log(
    `🎯 Activating Gifts event: ${selectedEvent.title} (ID ${selectedEvent.id})`
  );



  // ==============================================================
  // STEP 6 - ACTIVATE EVENT
  // ==============================================================

  let activationResponse;


  try {

    activationResponse = await page.evaluate(async (eventId) => {

      const response = await fetch(
        'https://v3.g.ladypopular.com/ajax/events.php',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
          },

          body: new URLSearchParams({
            type: 'activateEvent',
            event_id: String(eventId)
          }),

          credentials: 'same-origin'
        }
      );

      return await response.json();

    }, selectedEvent.id);


  } catch (error) {

    console.log(
      `❌ Event activation failed: ${error.message}`
    );

    throw error;

  }


  if (activationResponse?.status === 1) {

    console.log(
      `✅ Gifts flashback activated: ${selectedEvent.title}`
    );

  } else {

    console.log(
      `❌ Event activation failed. Status=${activationResponse?.status}`
    );

    // Do not silently pretend activation worked.
    // Throwing allows mspc.js to record this script as failed.
    throw new Error(
      `Failed to activate Gifts event "${selectedEvent.title}" (ID ${selectedEvent.id}). Server status: ${activationResponse?.status}`
    );

  }


};
