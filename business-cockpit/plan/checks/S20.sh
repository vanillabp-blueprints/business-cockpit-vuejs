#!/bin/sh
# ids: EXT-040 EXT-058
set -e
npx playwright test --grep "EXT-040|EXT-058"
