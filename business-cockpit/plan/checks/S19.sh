#!/bin/sh
# ids: 
set -e
for id in $(cat plan/ids.txt); do
  grep -rq "$id" e2e/ plan/checks/ ../business-cockpit-backend/application/src/test 2>/dev/null || { echo "no test names $id"; exit 1; }
done
npx playwright test
cd ../business-cockpit-backend && mvn -B verify
