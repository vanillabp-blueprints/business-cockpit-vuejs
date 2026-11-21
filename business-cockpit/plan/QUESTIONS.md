# Questions

## ASK-001 Where does the backend repository live relative to the workspace git branch?

Story: S02
Date: 2026-11-21
Default taken: business-cockpit-backend/ in the workspace as its own git repository, ignored by the workspace repository.
Why this default: interview asks for a second repository; the user wants work on the current branch.
Answer: open

## ASK-002 Where does the types module read the types library before it is published?

Story: S02
Date: 2026-11-21
Default taken: `types/pom.xml` downloads `@example/bc-types` of `ui.version` from npmjs.org. When `../business-cockpit/packages/bc-types` exists next to the backend repository, the profile `bc-types-local` uses that folder instead and downloads nothing. `-Dbc-types.local=<folder>` names another folder. The generated `UiUriTypes.java` is compiled in both ways.
Why this default: the scope `@example` is a placeholder and nothing is published, so the registry answers 404. The build has to pass today, and a release has to take the registry.
Answer: open

## ASK-003 Which Keycloak redirect addresses does the local realm accept?

Story: S02
Date: 2026-11-21
Default taken: `http://localhost:*` for the client `business-cockpit`, so the integration tests can start the application on any free port. The README says that this is for local use only.
Why this default: Keycloak allows a wildcard only at the end of an address, and the tests must not use a fixed port.
Answer: open
