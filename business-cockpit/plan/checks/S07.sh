#!/bin/sh
# ids: SRCH-001 SRCH-002 SRCH-003 SRCH-004 SRCH-005 SRCH-006 SRCH-007 SRCH-008 SRCH-009 SRCH-026 SRCH-027
set -e
# Texts: complete language files, the one word for a case, no text in the code.
node --test tests/check-texts.test.mjs
# Units of the user interface: the request part of a query, the clicks on a header, the suggestions.
npm run test --workspace packages/ui
npm run typecheck:e2e
# The tests use the browser of this machine when one is named; otherwise Playwright's own.
if [ -z "$PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH" ] && [ -x /usr/bin/chromium ]; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
fi
# Builds the user interface, starts the simulator and runs every end-to-end test: the ones of these ids
# and the ones of the earlier stories.
npx playwright test
# The backend tests include the one that asks the sort and filter paths of the columns, and the suggestions.
cd ../business-cockpit-backend
mvn -B verify
