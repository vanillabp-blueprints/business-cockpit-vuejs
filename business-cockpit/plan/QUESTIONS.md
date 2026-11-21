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

## ASK-006 What does the start page show before the dashboard exists?

Story: S04
Date: 2026-11-21
Default taken: `/` redirects to the task list in the language of the viewer (`/aufgaben`), because the dashboard is a later story.
Why this default: the interview wants the dashboard as the start page, so the redirect is a stop-gap with no commitment.
Answer: open

## ASK-007 Which paths do the translated screens have?

Story: S04
Date: 2026-11-21
Default taken: tasks `/aufgaben` `/tasks` `/taches`; my tasks `/meine-aufgaben` `/my-tasks` `/mes-taches`; a task `/aufgaben/:id` `/tasks/:id` `/taches/:id`; cases `/faelle` `/workflows` `/dossiers`. All are registered, so each opens its screen in every language. The case list and the task page are routes with no content until their stories.
Why this default: `Q-ROUTES` asks for translated paths and names no words; the English ones are the proposal of the description.
Answer: open

## ASK-008 How are the scroll bars of the list reserved when the browser of the tests hides them?

Story: S04
Date: 2026-11-21
Default taken: the list has `overflow: scroll` in both directions, so the room is there always. The test proves the computed style and that the inner size does not change while the list loads, because the headless browser has no visible scroll bars to measure.
Why this default: nothing in the description names a stricter proof.
Answer: open

## ASK-009 Does the `read` timestamp of a task decide the bold row?

Story: S04
Date: 2026-11-21
Default taken: a task without `read` in the answer is unread and its row is bold; any value of `read` makes it normal.
Why this default: the GUI API sets `read` only for a user who read the task, see gui-api.md on marking as read.
Answer: open
