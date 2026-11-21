# Business Cockpit user interface

The user interface of the Business Cockpit of `com.example.cockpit`: a Vue 3.5 single-page
application with Vuetify 4.3.4, built with Vite, in one npm workspaces repository. It is themed
with the tokens of the [VanillaBP design system](https://github.com/vanillabp/design-system).
The backend lives in a second repository, `business-cockpit-backend`, and takes the UI jar of this
one as a dependency.

The repository needs Node 24 or newer and no Java, Maven or Gradle.

| Folder | What it holds |
|--------|---------------|
| `packages/bc-types` | `@example/bc-types`: the data of the GUI API (generated), the constants, `ui-uri-types.json`, the names of the theme tokens |
| `packages/bc-module-kit` | `@example/bc-module-kit`: what a workflow module installs (for now it passes on the types) |
| `packages/bc-module-host` | `@example/bc-module-host`: the cockpit's side of loading module parts (not built yet) |
| `packages/bc-theme` | `@example/bc-theme`: colours, fonts, logo and spacing as CSS custom properties and plain values |
| `packages/ui` | the user interface; `src/lists` (task list, columns, page queue), `src/counts`, `src/settings`, `src/router` |
| `e2e/simulator`, `e2e/tests` | the simulator that stands in for the backend, and the Playwright tests |
| `e2e/compare` | the tests that compare a part in the cockpit and in a dev shell (nothing to compare yet) |
| `scripts/` | loading the OpenAPI files, setting one version everywhere |
| `jars/` | building, installing and uploading the UI jar |
| `tests/` | checks of the workspace itself, run with `npm test` |
| `plan/` | the plan of the work in stories, see `plan/INDEX.md` |

## Build

```bash
npm ci
npm run build
```

`npm run build` does these steps in this order:

1. Loads the two OpenAPI files of the GUI API out of the jars of the Business Cockpit
   (`io.vanillabp.businesscockpit` 0.9.0-SNAPSHOT from the snapshot repository of Maven Central,
   see `cockpit.config.json`) into `build/openapi/`. A token for a company repository is read from
   `COCKPIT_REPOSITORY_TOKEN`; set `COCKPIT_REPOSITORY_URL` to use a mirror. Without network, the
   files of the last run are used.
2. Builds the workspaces in the order types, module kit, module host, theme, user interface. The
   types and the GUI API client are generated with `@hey-api/openapi-ts` into `src/generated/`,
   which Git ignores.
3. Builds the UI jar `jars/dist/business-cockpit-ui-<version>.jar` with its pom, and installs both
   into the local Maven repository `~/.m2`, where the backend finds them.

`npm test` runs the checks of the workspace. `npm run test:workspaces` runs the unit tests of the
workspaces.

## Publish

One version holds for the whole repository, the one in the root `package.json`.

```bash
npm run set-version -- 1.0.0     # writes it into every package.json and updates the lock file
npm run build
npm publish --workspace packages/bc-types --workspace packages/bc-module-kit \
            --workspace packages/bc-module-host --workspace packages/bc-theme
MAVEN_REPOSITORY_URL=https://nexus.example.com/repository/releases \
MAVEN_REPOSITORY_USERNAME=... MAVEN_REPOSITORY_PASSWORD=... npm run publish:jars
```

The npm packages go to the registry of the scope `@example`, in the order of the build. The UI jar
goes into the Maven repository with HTTP `PUT`, together with its checksums. The script uploads
release versions only, and it refuses to overwrite a release that is already there.

## Developing against the backend

1. Start the backend repository as its `README.md` says, with the profile `ui-dev-server` added to
   `local`.
2. Run `npm run dev`. The dev server listens on port 5173 at the base path `/` and refuses to
   start on another port, because the backend names its address.
3. Open the address of the backend and log in. Never open the dev server directly: the browser
   talks to the backend only, so the login, the cookie and the paths are those of production.

The hot reload connects to port 5173 directly, because the gateway of the backend forwards no
WebSocket. When it does not reach the browser, reload the page by hand after a change.

The base path of the GUI API is `/gui/api/v1`. A page that serves it elsewhere says so with
`<meta name="bc-gui-api-base-path" content="...">`.

## The nginx image

Not generated yet. The cockpit runs embedded in the backend (`Q-HOSTING`), so the image is only
needed for a separate deployment. When it exists, it is built with
`docker build -f docker/Dockerfile .` at the root and answers every unknown path with `index.html`.

## End-to-end tests

They use Playwright, one test per checklist item, with the test title starting with the id of the
item, for example `TL-003 each primary filter shows its count`. They run against the simulator in
`e2e/simulator/`, which stands in for the backend: it serves the built user interface, plays the
login and answers the GUI API in memory. The tests need Node and a browser, no Java.

```bash
npm run test:e2e        # builds the user interface, starts the simulator, runs the tests
npm run typecheck:e2e   # types of the simulator and the tests
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` names a Chromium that is already installed; without it,
Playwright uses its own browser (`npx playwright install chromium`). The simulator listens on port
8090 (`SIMULATOR_PORT`). A test changes it through `/simulator/*`, see `e2e/support/test.ts`.

The texts of the user interface are in `packages/ui/src/i18n/<language>.json`. `npm run build`
fails when a file misses a key of `de.json`, and names the file and the key.
