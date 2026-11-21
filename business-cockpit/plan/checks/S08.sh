#!/bin/sh
# ids: PKG-039 PKG-040 PKG-041 PKG-042 PKG-043 PKG-048 PKG-049 PKG-050 PKG-051 PKG-053 PKG-056 PKG-057 TF-001 TF-019 TF-020 TF-024 TF-025 TF-026 TF-027 TF-029 TF-038 TF-039 TF-040 TF-042 TF-043 TF-044 TF-045 EXT-005 EXT-016 EXT-026 EXT-027 EXT-029 EXT-033 EXT-034 EXT-035 EXT-036 EXT-037 EXT-044 EXT-045 EXT-046 EXT-047 EXT-048 EXT-049 EXT-050 EXT-051 EXT-052 EXT-053
set -e
# Builds the libraries, the user interface and the three test modules (React, Vue, Angular); a module that is up to date is skipped.
npm run build --workspace packages/bc-types --workspace packages/bc-module-kit --workspace packages/bc-module-host --workspace packages/ui --workspace e2e/modules/react-module --workspace e2e/modules/vue-module --workspace e2e/modules/angular-module
# Checks of the workspaces and of the module contract: bc-check-entries over the three test modules, the host and the loader rules.
npm test
# Units of the workspaces: the module kit (names, manifest, bc-check-entries) and the user interface.
npm run test:workspaces
npm run typecheck:e2e
# The tests use the browser of this machine when one is named; otherwise Playwright's own.
if [ -z "$PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH" ] && [ -x /usr/bin/chromium ]; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
fi
# Runs every end-to-end test: the ones of these ids and the ones of the earlier stories. This story
# changes the user interface and the simulator only, so the backend tests of the earlier checks stay as they were.
npx playwright test
