#!/bin/sh
# ids: TL-022 TL-023
set -e
# Texts: complete language files, the one word for a case, no text in the code.
node --test tests/check-texts.test.mjs
# Units of the user interface: the queue of page requests, the columns, dates, settings.
npm run test --workspace packages/ui
npm run typecheck:e2e
# The tests use the browser of this machine when one is named; otherwise Playwright's own.
if [ -z "$PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH" ] && [ -x /usr/bin/chromium ]; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
fi
# Builds the user interface, starts the simulator and runs the tests that name these ids and the ones of the earlier stories.
npx playwright test
# The lists of the backend with the visibility of two users, against MongoDB and Keycloak of Testcontainers.
cd ../business-cockpit-backend
mvn -B verify
