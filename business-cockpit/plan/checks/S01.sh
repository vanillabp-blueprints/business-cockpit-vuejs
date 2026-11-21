#!/bin/sh
# ids: PKG-002 PKG-003 PKG-006 PKG-008 PKG-009 PKG-011 PKG-014 PKG-017 PKG-019 PKG-020 PKG-032 PKG-033 PKG-035 PKG-044 PKG-045 PKG-046 PKG-047 PKG-052 PKG-055 PKG-059 PKG-061 PKG-062 PKG-063 PKG-064 CUST-002
set -e
cd "$(dirname "$0")/../.."

# One command builds everything, without Maven, Gradle or Java.
npm ci
npm run build

# The workspaces' own unit tests (types, theme, user interface), then the checks of the workspace.
npm run test:workspaces
npm test

# The UI jar exists and is installed where the backend reads it.
test -f jars/dist/business-cockpit-ui-0.1.0-SNAPSHOT.jar
test -f ~/.m2/repository/com/example/cockpit/business-cockpit-ui/0.1.0-SNAPSHOT/business-cockpit-ui-0.1.0-SNAPSHOT.jar
test -f ~/.m2/repository/com/example/cockpit/business-cockpit-ui/0.1.0-SNAPSHOT/business-cockpit-ui-0.1.0-SNAPSHOT.pom
test ! -f pom.xml
