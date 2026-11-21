# Interview

Reference: 1.0.0
Started: 2026-11-21
Last answer: 2026-11-21

## Q-REPOSITORIES

Where do the repositories go?

Answer: UI repository in `business-cockpit/` of the workspace (committed on the workspace branch).
Backend repository in `business-cockpit-backend/` of the workspace, as a second git repository.

## Q-FRAMEWORK

Which UI framework does the cockpit use, and which version?

Answer: Vue 3.5

## Q-DESIGN-LIBRARY

Which component or design library, and which version?

Answer: Vuetify 4.3.4 (peer dependency vue ^3.5.0, fits Q-FRAMEWORK), themed with the tokens of
https://github.com/vanillabp/design-system

## Q-MODULE-FRAMEWORKS

Which frameworks do the workflow modules use?

Answer: the same as the cockpit: Vue 3.5 (one dev shell, for Vue)

## Q-BUNDLER

Which build tool builds the cockpit?

Answer: Vite

## Q-THEME

Colours, fonts, logo, spacing, colours of new/changed/removed rows, grey ended rows, lighter
suspended text.

Answer: Design system tokens. Read tokens, fonts and logo from
https://github.com/vanillabp/design-system; derive row-state colours from them.

## Q-THEME-TOKENS

Shall the theme be handed to module parts as CSS custom properties?

Answer: yes

## Q-STATE-MARKERS

How does a user task or a case show its state?

Answer: none (the cockpit's default look, no symbols)

## Q-WORDING

Which word does the user interface use for a business case?

Answer: English Case, German Fall, French Dossier.

## Q-CASE-KIND

Which field names the kind of a case?

Answer: the case title (`workflowTitle` in the task list, `title` in the case list, a text per
language).

## Q-AVATARS

Are there pictures of persons (avatars)?

Answer: no, initials only

## Q-AVATAR-SOURCE

Not asked, because `Q-AVATARS` is no.

## Q-AVATAR-CACHE

Not asked, because `Q-AVATARS` is no.

## Q-LANGUAGE-DEFAULT

Which language is the default?

Answer: German

## Q-LANGUAGE-SWITCH

Can the user switch the language?

Answer: yes

## Q-LANGUAGES

Which languages are offered?

Answer: German (default), English, French

## Q-SCREENS

Which screens exist beyond the minimum?

Answer: the minimum plus a dashboard

## Q-DASHBOARD

What does the dashboard show?

Answer: two pie charts (open user tasks by task type, open cases by kind) plus count tiles (my
tasks, all tasks, overdue). A click opens the list, narrowed.

## Q-SUB-LISTS

Are there sub-lists?

Answer: none

## Q-NOTIFICATIONS

Is there a screen where the user sets up notifications?

Answer: yes

## Q-ROUTES

Which paths do the screens have, and are they translated?

Answer: translated paths, one per language (de, en, fr); all work in every language; module pages
always /<workflowModuleId>/<pageId>.

## Q-VISIBLE-GROUPS

Do some groups of users see other screens or menu entries?

Answer: no, everybody sees the same

## Q-FOLLOW-UP

Is there a follow-up feature?

Answer: yes

## Q-CLOSED-TASKS

Are closed user tasks shown?

Answer: yes

## Q-PRIMARY-FILTERS

Which primary filters does the task list offer, and which is the default?

Answer: all four (OpenTasksWithFollowUp, OpenTasksWithoutFollowUp, OpenTaskOnlyFollowUp,
ClosedTasksOnly); default OpenTasksWithoutFollowUp

## Q-WORKFLOW-FILTERS

Which primary filters does the case list offer, and which is the default?

Answer: InProgress and Done; default InProgress

## Q-NOTES

Can user tasks and cases carry notes?

Answer: yes

## Q-TASK-COLUMNS

Which fixed columns does the task list have, and in which order?

Answer: id, case kind, title, due, notes, assignee, candidate users, follow-up, ended. ("created"
not added, case kind after id.)

## Q-WORKFLOW-COLUMNS

Which fixed columns does the case list have, and in which order?

Answer: id, title, notes, created, ended (default without case kind).

## Q-MODULE-COLUMNS

Do the workflow modules add columns of their own?

Answer: yes

## Q-BULK-ACTIONS

Which actions are offered for several selected tasks or cases?

Answer: tasks: claim, propose to a person, mark read/unread, follow-up, notes; cases: notes

## Q-CLAIM

Is claiming informal, or hard?

Answer: hard

## Q-PAGE-SIZE

How many rows does one page of a list load?

Answer: 20

## Q-MAX-LIST-ENTRIES

How many entries does a list show at most?

Answer: 100,000

## Q-HEADER

What does the application header show in the views where no user task is open?

Answer: the title, the toggle of the lists, the user and the menu

## Q-TASK-PAGE-AREAS

Which areas does the cockpit lay out on the page of a user task?

Answer: body, information, actions (plus all)

## Q-WORKFLOW-PAGE-AREAS

Which areas does the cockpit lay out on the page of a case?

Answer: body, information, actions (plus all)

## Q-TASK-INFORMATION-AREA

Which information about the task do the workflow modules show in the area information?

Answer: business id, case title

## Q-TASK-HEADER-INFO

Which information about the open user task does the application header show?

Answer: nothing

## Q-TASK-HEADER-ACTIONS

Which actions on the open user task does the application header offer?

Answer: claim, follow-up, note, mark as unread, list in its own window

## Q-WORKFLOW-HEADER-INFO

Which information about the open case does the application header show?

Answer: nothing

## Q-WORKFLOW-HEADER-ACTIONS

Which actions on the open case does the application header offer?

Answer: note

## Q-OWN-WINDOW

Is there a button "list in its own window" in the header of an open user task?

Answer: yes

## Q-LIVE-MODE

How do lists react to changes?

Answer: live

## Q-EXTENSION-POINTS

Which extension points exist beyond the four minimum ones?

Answer: Header yes; Pages no

## Q-CELL-RENDERING

Shall workflow modules draw cells of a list themselves?

Answer: yes. The skill does not generate this yet; it becomes a CUST- item marked as not
generated, to be revisited with a newer skill version.

## Q-UI-URI-TYPE

Which values of ui-uri-type does this user interface understand?

Answer: ES_MODULES, EXTERNAL

## Q-DATA-ENTRY-LIMIT

How large may a data entry of a module be, together with every file it imports?

Answer: 32 KB before compression

## Q-BACKEND

Shall the skill create the backend repository?

Answer: yes, the skill creates it, in a second repository

## Q-BUILD-TOOL

Which build tool builds the Java side?

Answer: Maven

## Q-BACKEND-FRAMEWORK

Not asked, because the skill creates the backend: Spring Boot.

## Q-LOGIN-KIND

How does a user log in?

Answer: oidc, with the Keycloak of the docker-compose.yaml

## Q-TOKEN

Where does the browser keep the login?

Answer: cookie (the only generable option). Not asked as a choice.

## Q-HOSTING

Where does the user interface run?

Answer: embedded (backend takes the UI jar as a dependency and serves it)

## Q-LOGIN

Which paths does the login use?

Answer: defaults for oidc: /oauth2/authorization/<id>, /login/oauth2/code/<id>, /logout

## Q-COCKPIT-VERSION

Which Business Cockpit does it run against?

Answer: group io.vanillabp.businesscockpit, version 0.9.0-SNAPSHOT (main branch; 1.0.0 not
released yet, latest release 0.4.3 lacks needed features). Move to 1.0.0 when released.

## Q-COCKPIT-REPOSITORY

From which Maven repository are the cockpit jars loaded?

Answer: Maven Central (repo1.maven.org) for releases,
central.sonatype.com/repository/maven-snapshots for snapshots, no token

## Q-UI-JAR

Maven coordinates of the UI jar.

Answer: Placeholder: com.example.cockpit:business-cockpit-ui:0.1.0-SNAPSHOT (group
com.example.cockpit, change later)

## Q-TYPES-JAR

Maven coordinates and Java package of the types jar.

Answer: Placeholder: com.example.cockpit:business-cockpit-ui-types, package com.example.cockpit.ui;
module types of the backend repository

## Q-MAVEN-REPOSITORY

Into which Maven repository is the UI jar uploaded?

Answer: local only for now (local Maven repository ~/.m2, no HTTP upload). The upload script stays
configurable through MAVEN_REPOSITORY_URL, MAVEN_REPOSITORY_USERNAME, MAVEN_REPOSITORY_PASSWORD.

## Q-NPM-SCOPE

The npm scope and names of the published libraries, and the npm registry.

Answer: Placeholder: @example (@example/bc-types, @example/bc-module-kit,
@example/bc-module-host, @example/bc-theme, @example/bc-dev-shell-vue); registry npmjs.org

## Q-BACKEND-COORDINATES

Group id, artifact id and Java package of the backend repository.

Answer: Placeholder: com.example.cockpit:business-cockpit-backend, package com.example.cockpit
(not asked; derived from Q-UI-JAR and Q-TYPES-JAR)

## Q-JAVA-VERSION

Which Java version does the backend build with?

Answer: 25

## Q-OIDC-PROVIDER

Which OIDC provider?

Answer: the Keycloak of the docker-compose.yaml: realm business-cockpit, client business-cockpit,
user id from preferred_username

## Q-USER-DIRECTORY

Where does the backend find the users and their groups?

Answer: keycloak

## Q-LIST-CONTROLLERS

Which lists get a controller in the backend?

Answer: task list (/tasks), own tasks (/my-tasks), case list, workflow modules; the visibilities
the cockpit ships

## Q-BPMS-API-USER

The workflow modules report to the BPMS API with HTTP basic. Which user and password?

Answer: user from BPMS_API_USERNAME, password from BPMS_API_PASSWORD; local values in
application-local.yaml

## Q-KAFKA

Do the workflow modules report through Kafka as well?

Answer: no

## Q-MAIL

Does the backend send notification e-mails?

Answer: yes

## Q-E2E-TOOL

Which tool runs the end-to-end tests of the UI repository?

Answer: Playwright

## Q-MEMORY-LIMIT

How much JavaScript heap may the browser use after the memory test?

Answer: 150 MB

## Placeholders

Q-UI-JAR, Q-TYPES-JAR, Q-NPM-SCOPE, Q-BACKEND-COORDINATES. The user keeps them for now.
