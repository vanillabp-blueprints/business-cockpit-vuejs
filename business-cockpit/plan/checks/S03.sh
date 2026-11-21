#!/bin/sh
# ids: PKG-054 AUTH-002 AUTH-003 AUTH-004 AUTH-005 AUTH-006 AUTH-007 AUTH-008 AUTH-009 NAV-004 NAV-009 NAV-011 NAV-013 NAV-019 NAV-020 NAV-021 NAV-022 NAV-027 NAV-029 NAV-030 I18N-001 I18N-002 I18N-004 I18N-005 I18N-006
set -e
# Texts: complete language files, the one word for a case, no text in the code.
node --test tests/check-texts.test.mjs
# Units of the user interface: fallback of texts, formats, initials, the tables of roles and rights.
npm run test --workspace packages/ui
npm run typecheck:e2e
# The tests use the browser of this machine when one is named; otherwise Playwright's own.
if [ -z "$PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH" ] && [ -x /usr/bin/chromium ]; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
fi
# Builds the user interface, starts the simulator and runs the tests that name these ids.
npx playwright test --grep "PKG-054|AUTH-002|AUTH-003|AUTH-004|AUTH-005|AUTH-006|AUTH-007|AUTH-008|AUTH-009|NAV-004|NAV-009|NAV-011|NAV-013|NAV-019|NAV-020|NAV-021|NAV-022|NAV-027|NAV-029|NAV-030|I18N-001|I18N-002|I18N-004|I18N-005|I18N-006"
