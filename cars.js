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
// 7. If one or more cars are activatable, randomly select ONE.
// 8. Activate that ONE car using the game's internal
//    /ajax/cars.php POST request instead of performing a click.
//
// IMPORTANT:
// - If 0 cars are activatable → stop safely.
// - If exactly 1 car is activatable → activate that car.
// - If multiple cars are activatable → randomly choose ONE.
// - Only ONE activation request is ever sent.
//
// ================================================================


module.exports = async function runCars(page) {

  // ================================================================
  // STEP 1
  // Go to the Cars page.
  // ================================================================

  console.log("🚗 Starting Car Bonus Activation...");

  const carsUrl =
    'https://v3.g.ladypopular.com/cars.php';

  console.log(
    `🗺️ Navigating to Cars page: ${carsUrl}`
  );

  await page.goto(carsUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log("✅ Cars page loaded.");


  // ================================================================
  // Wait for the car containers to EXIST in the DOM.
  //
  // IMPORTANT:
  //
  // We use state: 'attached' rather than waiting for visibility.
  //
  // The previous version timed out even though Playwright reported:
  //
  //     locator resolved to 12 elements
  //
  // That means the cars existed in the DOM, but Playwright was
  // waiting for them to become visible.
  //
  // We only need to inspect their HTML, so visibility is not
  // required here.
  // ================================================================

  await page.waitForSelector(
    '.pets-cars-wrapper',
    {
      state: 'attached',
      timeout: 30000
    }
  );

  console.log(
    "🔎 Car containers are present in the page DOM."
  );


  // ================================================================
  // STEP 2
  // Inspect every car container.
  //
  // Each car has:
  //
  //     class="pets-cars-wrapper"
  //     id="carXX"
  //
  // Example:
  //
  //     id="car22"
  //
  //     id="car23"
  //
  // The number is the game's Car ID.
  // ================================================================

  const cars = await page.$$eval(
    '.pets-cars-wrapper',
    carElements => {

      return carElements.map(car => {

        // ------------------------------------------------------------
        // Extract Car ID.
        //
        // Example:
        //
        //     id="car22"
        //
        // becomes:
        //
        //     22
        // ------------------------------------------------------------

        const rawId =
          car.getAttribute('id') || '';

        const match =
          rawId.match(/^car(\d+)$/);

        const carId =
          match ? Number(match[1]) : null;


        // ------------------------------------------------------------
        // Find the activation button.
        //
        // Expected structure:
        //
        // <button
        //     id="bonusCar"
        //     onclick="useCar(23); return false;"
        // >
        // ------------------------------------------------------------

        const activateButton =
          car.querySelector('button#bonusCar');


        // ------------------------------------------------------------
        // Find the cooldown section.
        // ------------------------------------------------------------

        const carStats =
          car.querySelector('.car-stats');


        // ------------------------------------------------------------
        // Determine whether the activation button is visible.
        // ------------------------------------------------------------

        let activateButtonVisible = false;

        if (activateButton) {

          const buttonStyle =
            window.getComputedStyle(
              activateButton
            );

          activateButtonVisible =
            buttonStyle.display !== 'none' &&
            buttonStyle.visibility !== 'hidden';
        }


        // ------------------------------------------------------------
        // Determine whether the cooldown section is visible.
        // ------------------------------------------------------------

        let cooldownVisible = false;

        if (carStats) {

          const statsStyle =
            window.getComputedStyle(
              carStats
            );

          cooldownVisible =
            statsStyle.display !== 'none' &&
            statsStyle.visibility !== 'hidden';
        }


        // ------------------------------------------------------------
        // Extract cooldown timer.
        //
        // Example:
        //
        //     30:11:47
        //
        // This is only used for logging/debugging.
        // ------------------------------------------------------------

        let cooldownText = null;

        if (carStats) {

          const spans =
            [...carStats.querySelectorAll('span')];

          const possibleTimer =
            spans
              .map(span =>
                span.textContent.trim()
              )
              .find(text =>
                /^\d+:\d{2}:\d{2}$/.test(text)
              );

          if (possibleTimer) {
            cooldownText = possibleTimer;
          }
        }


        // ------------------------------------------------------------
        // Extract car name.
        //
        // Example:
        //
        //     <input
        //         class="pets-cars-name"
        //         value="Beetle"
        //     >
        // ------------------------------------------------------------

        const nameInput =
          car.querySelector(
            'input.pets-cars-name'
          );

        const carName =
          nameInput
            ? nameInput.value
            : null;


        // ------------------------------------------------------------
        // Extract the Car ID from onclick.
        //
        // Example:
        //
        //     useCar(23)
        // ------------------------------------------------------------

        let onclickCarId = null;

        if (activateButton) {

          const onclick =
            activateButton.getAttribute(
              'onclick'
            ) || '';

          const onclickMatch =
            onclick.match(
              /useCar\((\d+)\)/
            );

          if (onclickMatch) {

            onclickCarId =
              Number(onclickMatch[1]);
          }
        }


        // ------------------------------------------------------------
        // Determine whether the car can be activated.
        //
        // A car is considered activatable when:
        //
        // 1. Car ID was successfully found.
        // 2. Activation button is visible.
        // 3. Cooldown section is NOT visible.
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

  const totalCars =
    cars.length;

  console.log(
    `🚗 Total cars found: ${totalCars}`
  );


  // ================================================================
  // STEP 2B
  // Separate cars into:
  //
  //     activatableCars
  //
  // and:
  //
  //     cooldownCars
  // ================================================================

  const activatableCars =
    cars.filter(
      car => car.canActivate
    );

  const cooldownCars =
    cars.filter(
      car => car.cooldownVisible
    );


  console.log(
    `🟢 Activatable cars: ${activatableCars.length}`
  );

  console.log(
    `🔴 Cars on cooldown: ${cooldownCars.length}`
  );


  // ================================================================
  // STEP 2C
  // Print every car for debugging.
  // ================================================================

  console.log(
    "────────────────────────────────────────────────────────────────────────────────"
  );

  console.log(
    "🚗 CAR INSPECTION RESULTS"
  );

  console.log(
    "────────────────────────────────────────────────────────────────────────────────"
  );


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
  // Create the list containing ONLY the Car IDs of cars that
  // can currently be activated.
  // ================================================================

  const activatableCarIds =
    activatableCars.map(
      car => car.carId
    );


  console.log(
    "────────────────────────────────────────────────────────────────────────────────"
  );

  console.log(
    `🟢 Activatable Car IDs: ${
      activatableCarIds.join(', ')
    }`
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

  console.log(
    "────────────────────────────────────────────────────────────────────────────────"
  );


  // ================================================================
  // STEP 3
  // SELECT ONE CAR
  //
  // Rules:
  //
  // 0 activatable cars:
  //     → stop
  //
  // 1 activatable car:
  //     → choose that car
  //
  // More than 1:
  //     → randomly choose ONE
  //
  // No other selection rule is used.
  // ================================================================

  if (activatableCarIds.length === 0) {

    console.log(
      "⛔ No activatable cars found. Nothing to activate."
    );

    console.log(
      "🏁 Car script finished."
    );

    return;
  }


  let carIdToActivate;


  // ================================================================
  // Multiple cars available.
  // Randomly select exactly ONE.
  // ================================================================

  if (activatableCarIds.length > 1) {

    const randomIndex =
      Math.floor(
        Math.random() *
        activatableCarIds.length
      );

    carIdToActivate =
      activatableCarIds[randomIndex];


    console.log(
      `🎲 Multiple cars are activatable: ${
        activatableCarIds.join(', ')
      }`
    );

    console.log(
      `🎯 Randomly selected Car ${
        carIdToActivate
      } for activation.`
    );


  } else {

    // ==============================================================
    // Exactly one car is available.
    // ==============================================================

    carIdToActivate =
      activatableCarIds[0];

    console.log(
      `🎯 Exactly one car is activatable: Car ${
        carIdToActivate
      }`
    );
  }


  // ================================================================
  // STEP 3A
  // Send the internal game request.
  //
  // POST:
  //
  //     https://v3.g.ladypopular.com/ajax/cars.php
  //
  // Payload:
  //
  //     type=useCar
  //     car_id=<selected Car ID>
  //
  // The request is made inside the logged-in browser page, so the
  // existing authenticated session is used.
  // ================================================================

  console.log(
    `🚀 Activating Car ${carIdToActivate} using internal request...`
  );


  try {

    const response =
      await page.evaluate(
        async (carId) => {

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


          // ----------------------------------------------------------
          // Read the game's JSON response.
          // ----------------------------------------------------------

          const data =
            await res.json();


          return {
            httpStatus: res.status,
            data
          };

        },
        carIdToActivate
      );


    // ================================================================
    // STEP 3B
    // Log HTTP status.
    // ================================================================

    console.log(
      `📡 Cars activation HTTP status: ${
        response.httpStatus
      }`
    );


    // ================================================================
    // STEP 3C
    // Log game's response.
    // ================================================================

    console.log(
      `📦 Cars activation response: ${
        JSON.stringify(response.data)
      }`
    );


    // ================================================================
    // STEP 3D
    // Confirm successful activation.
    //
    // Expected successful response from the captured request:
    //
    //     status: 1
    //
    //     message: "car_used"
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
    // If the request itself fails, show the actual error.
    // ================================================================

    console.log(
      `❌ Failed to activate Car ${carIdToActivate}: ${
        err.message
      }`
    );

    throw err;
  }


  // ================================================================
  // DONE
  // ================================================================

  console.log(
    "🏁 Car Bonus Activation finished."
  );
};
