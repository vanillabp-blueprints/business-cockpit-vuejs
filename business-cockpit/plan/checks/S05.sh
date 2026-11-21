#!/bin/sh
# ids: TL-022 TL-023
set -e
npx playwright test --grep "TL-022|TL-023"
