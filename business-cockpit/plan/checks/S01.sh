#!/bin/sh
# ids: PKG-002 PKG-003 PKG-006 PKG-008 PKG-009 PKG-011 PKG-014 PKG-017 PKG-019 PKG-020 PKG-032 PKG-033 PKG-035 PKG-044 PKG-045 PKG-046 PKG-047 PKG-052 PKG-055 PKG-059 PKG-061 PKG-062 PKG-063 PKG-064 CUST-002
set -e
npm ci
npm run build
test -f packages/bc-types/package.json
test ! -f pom.xml
test -f packages/ui-jar/dist/*.jar || ls ~/.m2/repository/com/example/cockpit/business-cockpit-ui
