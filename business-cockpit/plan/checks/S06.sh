#!/bin/sh
# ids: SRCH-010 SRCH-011 SRCH-012 SRCH-013 SRCH-014 SRCH-015 SRCH-016 SRCH-017 SRCH-018 SRCH-019 SRCH-020 SRCH-021 SRCH-022 SRCH-023 SRCH-024 SRCH-025 SRCH-028 SRCH-029 SRCH-030 SRCH-031 SRCH-032
set -e
# Texts: complete language files, the one word for a case, no text in the code.
node --test tests/check-texts.test.mjs
# Units of the user interface, among them the loading window and the cap with the timers of the test framework (SRCH-029).
npm run test --workspace packages/ui
npm run typecheck:e2e
# The tests use the browser of this machine when one is named; otherwise Playwright's own.
if [ -z "$PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH" ] && [ -x /usr/bin/chromium ]; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
fi
# Builds the user interface, starts the simulator and runs every end-to-end test: the ones of these ids
# (the measurement over 30,000 tasks and over 1,000,000 simulated entries, SRCH-031) and the ones of the earlier stories.
npx playwright test
# The lists of the backend are unchanged by this story, but its tests belong to the earlier stories.
cd ../business-cockpit-backend
mvn -B verify
