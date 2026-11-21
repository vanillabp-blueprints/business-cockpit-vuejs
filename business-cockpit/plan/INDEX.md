# Plan

Job: generate the Business Cockpit (Vue, Vuetify) and its backend
Reference: 1.0.0
Started: 2026-11-21

| Id | Title | Status | Checklist ids | Check command |
|----|-------|--------|---------------|---------------|
| S01 | The workspace builds: npm workspaces, types, theme, generated client and an empty UI jar | done | PKG-002, PKG-003, PKG-006, PKG-008, PKG-009, PKG-011, PKG-014, PKG-017, PKG-019, PKG-020, PKG-032, PKG-033, PKG-035, PKG-044, PKG-045, PKG-046, PKG-047, PKG-052, PKG-055, PKG-059, PKG-061, PKG-062, PKG-063, PKG-064, CUST-002 | `sh plan/checks/S01.sh` |
| S02 | The backend starts locally with login at Keycloak and serves the UI jar | done | PKG-004, PKG-005, BE-001, BE-002, BE-003, BE-005, BE-006, BE-007, BE-008, BE-010, BE-011, BE-012, BE-013, BE-014, BE-017, BE-018, BE-019, BE-020, BE-024, BE-025, BE-027, BE-028, BE-031 | `sh plan/checks/S02.sh` |
| S03 | A clerk logs in and the frame shows their name (simulator-tested UI) | done | PKG-054, AUTH-002, AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-007, AUTH-008, AUTH-009, NAV-004, NAV-009, NAV-011, NAV-013, NAV-019, NAV-020, NAV-021, NAV-022, NAV-027, NAV-029, NAV-030, I18N-001, I18N-002, I18N-004, I18N-005, I18N-006 | `sh plan/checks/S03.sh` |
| S04 | The clerk sees the user tasks waiting for them | done | BE-004, NAV-001, NAV-002, NAV-006, NAV-010, TL-001, TL-002, TL-003, TL-005, TL-007, TL-008, TL-009, TL-010, TL-011, TL-012, TL-013, TL-015, TL-016, TL-018, TL-024, COL-015, COL-017, COL-018, COL-019, COL-021 | `sh plan/checks/S04.sh` |
| S05 | The clerk sees closed tasks and the look of each state | done | TL-022, TL-023 | `sh plan/checks/S05.sh` |
| S06 | The clerk with 30,000 tasks still scrolls smoothly | done | SRCH-010, SRCH-011, SRCH-012, SRCH-013, SRCH-014, SRCH-015, SRCH-016, SRCH-017, SRCH-018, SRCH-019, SRCH-020, SRCH-021, SRCH-022, SRCH-023, SRCH-024, SRCH-025, SRCH-028, SRCH-029, SRCH-030, SRCH-031, SRCH-032 | `sh plan/checks/S06.sh` |
| S07 | The clerk searches, filters and sorts the lists | open | SRCH-001, SRCH-002, SRCH-003, SRCH-004, SRCH-005, SRCH-006, SRCH-007, SRCH-008, SRCH-009, SRCH-026, SRCH-027 | `sh plan/checks/S07.sh` |
| S08 | The clerk opens a task and works on it in the form of a module | open | PKG-039, PKG-040, PKG-041, PKG-042, PKG-043, PKG-048, PKG-049, PKG-050, PKG-051, PKG-053, PKG-056, PKG-057, TF-001, TF-019, TF-020, TF-024, TF-025, TF-026, TF-027, TF-029, TF-038, TF-039, TF-040, TF-042, TF-043, TF-044, TF-045, EXT-005, EXT-016, EXT-026, EXT-027, EXT-029, EXT-033, EXT-034, EXT-035, EXT-036, EXT-037, EXT-044, EXT-045, EXT-046, EXT-047, EXT-048, EXT-049, EXT-050, EXT-051, EXT-052, EXT-053 | `sh plan/checks/S08.sh` |
| S09 | Workflow modules add their own columns to the lists | open | COL-001, COL-003, COL-004, COL-005, COL-006, COL-007, COL-008, COL-009, COL-010, COL-011, COL-012, COL-013, COL-016, COL-020, WL-003, EXT-043 | `sh plan/checks/S09.sh` |
| S10 | Parts of modules talk to the cockpit: events, dialogs, toasts, messages | open | TF-016, TF-022, EXT-007, EXT-008, EXT-009, EXT-010, EXT-011, EXT-012, EXT-013, EXT-018, EXT-019, EXT-021, EXT-023, EXT-024, EXT-039, EXT-041, EXT-042, EXT-054, EXT-055, EXT-056, EXT-057, EXT-059 | `sh plan/checks/S10.sh` |
| S11 | The clerk claims, proposes, follows up and notes tasks | open | TL-014, TL-017, TL-019, TL-021, TL-025, ACT-001, ACT-003, ACT-004, ACT-005, ACT-006, ACT-007, ACT-008, ACT-009, ACT-010, ACT-012, ACT-013, ACT-015, ACT-016, ACT-017, ACT-018, TF-030, TF-031, TF-035 | `sh plan/checks/S11.sh` |
| S12 | The open task has its header actions and the list in its own window | open | TF-004, TF-005, TF-006, TF-007, TF-008, TF-013, TF-014, TF-017, TF-018, TF-023, TF-041 | `sh plan/checks/S12.sh` |
| S13 | The clerk looks up cases in the case list and opens a case | open | NAV-003, WL-001, WL-002, WL-004, WL-005, WL-006, WL-007, WL-008, WL-009, WL-010, WP-001, WP-003, WP-007, WP-008, WP-009, WP-010, WP-011, WP-012, WP-014, WP-015 | `sh plan/checks/S13.sh` |
| S14 | The clerk sees the dashboard with tiles and pie charts | open | BE-030, NAV-005, CUST-004 | `sh plan/checks/S14.sh` |
| S15 | The clerk chooses language, settings and notifications | open | BE-016, NAV-014, NAV-015, NAV-016, NAV-028, EXT-014, SET-001, SET-002, SET-003, SET-004, SET-005, SET-006, I18N-003, I18N-007, I18N-008, NOTI-001, NOTI-002, NOTI-003, CUST-003 | `sh plan/checks/S15.sh` |
| S16 | A new task shows up without a reload | open | TL-006, TF-011, TF-037, LIVE-001, LIVE-002, LIVE-003, LIVE-004, LIVE-005, LIVE-006, LIVE-007, LIVE-010, LIVE-011, LIVE-012, LIVE-013, LIVE-014, LIVE-015, LIVE-016, LIVE-017, LIVE-018, LIVE-019, LIVE-020, LIVE-021, LIVE-022, LIVE-023 | `sh plan/checks/S16.sh` |
| S17 | A module developer works on a form in the dev shell | open | PKG-034, DS-001, DS-002, DS-003, DS-004, DS-005, DS-006, DS-007, DS-008, DS-009, DS-010, DS-011, DS-012, DS-013, DS-014, DS-015, DS-017, DS-018, DS-019, DS-020, DS-021, DS-022, DS-023, DS-024 | `sh plan/checks/S17.sh` |
| S18 | The types jar and demo data with README for manual testing | open | PKG-036, PKG-037, CUST-005 | `sh plan/checks/S18.sh` |
| S19 | Every checklist item has a passing test | open | - | `sh plan/checks/S19.sh` |
| S20 | Run against a running cockpit with the blueprints | open | EXT-040, EXT-058 | `sh plan/checks/S20.sh` |
