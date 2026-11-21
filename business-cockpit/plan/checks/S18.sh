#!/bin/sh
# ids: PKG-036 PKG-037 CUST-005
set -e
cd ../business-cockpit-backend && mvn -B verify
