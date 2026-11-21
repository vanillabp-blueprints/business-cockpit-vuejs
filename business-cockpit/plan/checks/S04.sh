#!/bin/sh
# ids: BE-004 NAV-001 NAV-002 NAV-006 NAV-010 TL-001 TL-002 TL-003 TL-005 TL-007 TL-008 TL-009 TL-010 TL-011 TL-012 TL-013 TL-015 TL-016 TL-018 TL-024 COL-015 COL-017 COL-018 COL-019 COL-021
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
