#!/bin/sh
# ids: BE-030 NAV-005 CUST-004
set -e
npx playwright test --grep "BE-030|NAV-005|CUST-004"
cd ../business-cockpit-backend && mvn -B verify
