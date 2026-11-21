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

## ASK-004 Which side does the menu open from?

Story: S03
Date: 2026-11-21
Default taken: the menu is a drawer on the right, and the burger is at the right end of the header.
Why this default: the overview of roles and rights must open below the name, aligned to its right edge, and is wider than a narrow menu. With the name at the right edge, the overview fits on screen.
Answer: open

## ASK-005 Does a login started by the user interface bring the user back to the deep link?

Story: S03
Date: 2026-11-21
Default taken: when current-user has no user, or a request answers 401, the user interface sends the browser to `/oauth2/authorization/keycloak`. The backend does not know the address the user came from, so after the login the user lands on the start page. A first visit to a deep link is not affected, because the backend saves that request itself.
Why this default: it is the plain contract of the description, and it commits to nothing.
Answer: open
