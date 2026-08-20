// cars.js
//
// ================================================================
// 🚗 CAR BONUS ACTIVATION
// ================================================================
//
// PURPOSE:
// 1. Open the Cars page.
// 2. Inspect all car containers on the page.
// 3. Count the total cars.
// 4. Determine which cars are currently available for activation.
// 5. Determine which cars are on cooldown.
// 6. Collect the unique Car IDs of the activatable cars.
// 7. Activate ONE activatable car using the game's internal
//    /ajax/cars.php POST request instead of performing a click.
//
// IMPORTANT:
// The instructions provided specify that ONE activatable car should
// be activated, but they do NOT specify how to choose that one when
// multiple cars are available.
//
// Therefore this script intentionally DOES NOT choose a car by:
// - lowest ID
// - highest ID
// - first car
// - random car
// - highest bonus
// - longest/shortest duration
// - any other invented priority.
//
// Until a selection rule is specified, the script will report the
// available Car IDs and stop safely.
//
// ================================================================


module.exports = async function runCars(page) {

  // ================================================================
  // STEP 1
  // Go to the Cars page and wait for it to load.
  // ================================================================

  console.log("🚗 Starting Car Bonus Activation...");

  const carsUrl = 'https://v3.g.ladypopular.com/cars.php';

  console.log(`🗺️ Navigating to Cars page: ${carsUrl}`);

  await page.goto(carsUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log("✅ Cars page loaded.");


  // ================================================================
  // Make sure the actual car containers are present before trying
  // to inspect them.
  //
  // The supplied inspect data shows each car as:
  //
  // <div class="pets-cars-wrapper" id="car22" ...>
  //
  // <div class="pets-cars-wrapper" id="car23" ...>
  //
  // etc.
  //
  // Therefore .pets-cars-wrapper is the container we inspect.
  // ================================================================

  await page.waitForSelector('.pets-cars-wrapper', {
    timeout: 30000
  });

  console.log("🔎 Car containers found on the page.");


  // ================================================================
  // STEP 2
  // Inspect every car container.
  //
  // We use the actual HTML structure described in the instructions.
  //
  // Each car has:
  //
  //     class="pets-cars-wrapper"
  //     id="carXX"
  //
  // For example:
  //
  //     id="car22"
  //
  //     id="car23"
  //
  // The ID number is the game's unique Car ID.
  // ================================================================

  const cars = await page.$$eval(
    '.pets-cars-wrapper',
    carElements => {

      return carElements.map(car => {

        // ------------------------------------------------------------
        // Extract the ID from:
        //
        //     id="car22"
        //
        //     id="car23"
        //
        // etc.
        // ------------------------------------------------------------

        const rawId = car.getAttribute('id') || '';

        const match = rawId.match(/^car(\d+)$/);

        const carId = match ? Number(match[1]) : null;


        // ------------------------------------------------------------
        // The activation button in the supplied HTML is:
        //
        // <button id="bonusCar"
        //         ...
        //         onclick="useCar(23); return false;">
        //
        // When the car is available:
        //
        //     style=""
        //
        // and the button is visible.
        //
        // When the car is on cooldown:
        //
        //     style="display: none"
        //
        // while the .car-stats element is displayed.
        //
        // We therefore inspect the actual visibility of these
        // elements rather than relying on a hard-coded list of
        // Car IDs.
        // ------------------------------------------------------------

        const activateButton =
          car.querySelector('button#bonusCar');

        const carStats =
          car.querySelector('.car-stats');


        // ------------------------------------------------------------
        // Determine whether the activation button is actually
        // displayed.
        //
        // getComputedStyle() is used because the HTML may contain
        // inline style such as:
        //
        //     style="display: none"
        //
        // or:
        //
        //     style=""
        //
        // ------------------------------------------------------------

        let activateButtonVisible = false;

        if (activateButton) {

          const buttonStyle =
            window.getComputedStyle(activateButton);

          activateButtonVisible =
            buttonStyle.display !== 'none' &&
            buttonStyle.visibility !== 'hidden';
        }


        // ------------------------------------------------------------
        // Determine whether the cooldown section is displayed.
        //
        // The supplied cooldown example contains:
        //
        // <div class="car-stats"
        //      style="display: flex !important">
        //
        // and the available example contains:
        //
        // <div class="car-stats"
        //      style="display: none">
        //
        // ------------------------------------------------------------

        let cooldownVisible = false;

        if (carStats) {

          const statsStyle =
            window.getComputedStyle(carStats);

          cooldownVisible =
            statsStyle.display !== 'none' &&
            statsStyle.visibility !== 'hidden';
        }


        // ------------------------------------------------------------
        // Extract the cooldown text if the cooldown section exists.
        //
        // For example:
        //
        //     30:11:47
        //
        // or:
        //
        //     18:13:39
        //
        // This is only for logging/debugging.
        // ------------------------------------------------------------

        let cooldownText = null;

        if (carStats) {

          const spans =
            [...carStats.querySelectorAll('span')];

          const possibleTimer =
            spans
              .map(span => span.textContent.trim())
              .find(text => /^\d+:\d{2}:\d{2}$/.test(text));

          if (possibleTimer) {
            cooldownText = possibleTimer;
          }
        }


        // ------------------------------------------------------------
        // Extract the car name.
        //
        // The supplied HTML contains:
        //
        // <input
        //     class="pets-cars-name"
        //     value="Beetle"
        // >
        //
        // This is not required for activation, but is extremely
        // useful for debugging.
        // ------------------------------------------------------------

        const nameInput =
          car.querySelector('input.pets-cars-name');

        const carName =
          nameInput
            ? nameInput.value
            : null;


        // ------------------------------------------------------------
        // Extract the onclick value from the activation button.
        //
        // Example:
        //
        //     useCar(23)
        //
        // This gives us an additional check that the button belongs
        // to the same Car ID we extracted from the container.
        // ------------------------------------------------------------

        let onclickCarId = null;

        if (activateButton) {

          const onclick =
            activateButton.getAttribute('onclick') || '';

          const onclickMatch =
            onclick.match(/useCar\((\d+)\)/);

          if (onclickMatch) {
            onclickCarId = Number(onclickMatch[1]);
          }
        }


        // ------------------------------------------------------------
        // A car is considered activatable only when:
        //
        // 1. We successfully extracted its Car ID.
        // 2. Its Activate Bonus button is visible.
        // 3. Its cooldown section is not visible.
        //
        // This follows the supplied HTML examples:
        //
        // AVAILABLE:
        // button visible + car-stats hidden
        //
        // COOLDOWN:
        // button hidden + car-stats visible
        // ------------------------------------------------------------

        const canActivate =
          carId !== null &&
          activateButtonVisible &&
          !cooldownVisible;


        return {
          carId,
          carName,
          activateButtonVisible,
          cooldownVisible,
          cooldownText,
          onclickCarId,
          canActivate
        };
      });
    }
  );


  // ================================================================
  // STEP 2A
  // Count total cars.
  // ================================================================

  const totalCars = cars.length;

  console.log(`🚗 Total cars found: ${totalCars}`);


  // ================================================================
  // STEP 2B
  // Separate the cars into:
  //
  //     activatableCars
  //
  // and
  //
  //     cooldownCars
  //
  // based on the inspected page state.
  // ================================================================

  const activatableCars =
    cars.filter(car => car.canActivate);

  const cooldownCars =
    cars.filter(car => car.cooldownVisible);


  console.log(
    `🟢 Activatable cars: ${activatableCars.length}`
  );

  console.log(
    `🔴 Cars on cooldown: ${cooldownCars.length}`
  );


  // ================================================================
  // STEP 2C
  // Print every car for debugging.
  //
  // This makes it much easier to compare what the automation sees
  // against what you see in Inspect.
  // ================================================================

  console.log("────────────────────────────────────────────────────────────────────────────────");
  console.log("🚗 CAR INSPECTION RESULTS");
  console.log("────────────────────────────────────────────────────────────────────────────────");

  for (const car of cars) {

    if (car.canActivate) {

      console.log(
        `🟢 Car ${car.carId}` +
        `${car.carName ? ` (${car.carName})` : ''}` +
        ` → CAN ACTIVATE`
      );

    } else if (car.cooldownVisible) {

      console.log(
        `🔴 Car ${car.carId}` +
        `${car.carName ? ` (${car.carName})` : ''}` +
        ` → ON COOLDOWN` +
        `${car.cooldownText ? ` → ${car.cooldownText} remaining` : ''}`
      );

    } else {

      console.log(
        `⚪ Car ${car.carId}` +
        `${car.carName ? ` (${car.carName})` : ''}` +
        ` → NOT CLASSIFIED AS ACTIVATABLE`
      );
    }
  }


  // ================================================================
  // STEP 2D
  // Print ONLY the Car IDs of the activatable cars.
  //
  // This is the list requested by your instructions.
  // ================================================================

  const activatableCarIds =
    activatableCars.map(car => car.carId);


  console.log("────────────────────────────────────────────────────────────────────────────────");

  console.log(
    `🟢 Activatable Car IDs: ${activatableCarIds.join(', ')}`
  );

  console.log(
    `📊 Total cars: ${totalCars}`
  );

  console.log(
    `📊 On cooldown: ${cooldownCars.length}`
  );

  console.log(
    `📊 Activatable: ${activatableCars.length}`
  );

  console.log("────────────────────────────────────────────────────────────────────────────────");


  // ================================================================
  // STEP 3
  //
  // The supplied instructions say:
  //
  // "activate one of the cars that is activable from the list"
  //
  // However, they do NOT specify WHICH car to choose when the list
  // contains multiple Car IDs.
  //
  // Because you specifically asked me not to make assumptions, we
  // cannot legitimately write:
  //
  //     activatableCarIds[0]
  //
  // or:
  //
  //     Math.random()
  //
  // or:
  //
  //     Math.max(...)
  //
  // etc.
  //
  // Those would all introduce a selection rule that isn't present
  // in the instructions.
  //
  // Therefore the script stops here for now if there is more than
  // one possible car.
  // ================================================================

  if (activatableCarIds.length === 0) {

    console.log(
      "⛔ No activatable cars found. Nothing to activate."
    );

    console.log("🏁 Car script finished.");

    return;
  }


  if (activatableCarIds.length > 1) {

    console.log(
      "⚠️ Multiple cars are available for activation."
    );

    console.log(
      `🟢 Available Car IDs: ${activatableCarIds.join(', ')}`
    );

    console.log(
      "⛔ No car was activated because the supplied instructions do not specify which available car should be selected."
    );

    console.log("🏁 Car script stopped safely.");

    return;
  }


  // ================================================================
  // The only case where there is no ambiguity:
  //
  // exactly ONE car is activatable.
  //
  // In that situation, we can activate that car because there is
  // only one possible choice.
  // ================================================================

  const carIdToActivate =
    activatableCarIds[0];


  console.log(
    `🎯 Exactly one car is activatable: Car ${carIdToActivate}`
  );

  console.log(
    `🚀 Activating Car ${carIdToActivate} using internal request...`
  );


  // ================================================================
  // STEP 3A
  //
  // Send the exact request described in the supplied Inspect data.
  //
  // Request:
  //
  //     POST https://v3.g.ladypopular.com/ajax/cars.php
  //
  // Form data:
  //
  //     type=useCar
  //     car_id=<Car ID>
  //
  // The supplied successful response is:
  //
  //     {"status":1,"message":"car_used"}
  //
  // We use page.evaluate() so the request is made from the logged-in
  // browser page and therefore uses the existing authenticated
  // session.
  // ================================================================

  try {

    const response =
      await page.evaluate(async (carId) => {

        const res =
          await fetch(
            'https://v3.g.ladypopular.com/ajax/cars.php',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/x-www-form-urlencoded',
                'X-Requested-With':
                  'XMLHttpRequest'
              },

              body:
                new URLSearchParams({
                  type: 'useCar',
                  car_id: String(carId)
                }),

              credentials: 'same-origin'
            }
          );


        // Try to parse the game's JSON response.
        const data =
          await res.json();


        return {
          httpStatus: res.status,
          data
        };

      }, carIdToActivate);


    // ================================================================
    // STEP 3B
    // Log the HTTP response and game's response.
    // ================================================================

    console.log(
      `📡 Cars activation HTTP status: ${response.httpStatus}`
    );

    console.log(
      `📦 Cars activation response: ${JSON.stringify(response.data)}`
    );


    // ================================================================
    // STEP 3C
    // Confirm the exact successful response described in the
    // instructions.
    // ================================================================

    if (
      response.httpStatus === 200 &&
      response.data &&
      response.data.status === 1 &&
      response.data.message === 'car_used'
    ) {

      console.log(
        `🎉 Car ${carIdToActivate} activated successfully!`
      );

    } else {

      console.log(
        `⚠️ Car ${carIdToActivate} activation request completed, but the response was not the expected successful response.`
      );

    }

  } catch (err) {

    // ================================================================
    // If the request itself fails, report the error without hiding
    // the reason from the main script.
    // ================================================================

    console.log(
      `❌ Failed to activate Car ${carIdToActivate}: ${err.message}`
    );

    throw err;
  }


  console.log("🏁 Car Bonus Activation finished.");
};
