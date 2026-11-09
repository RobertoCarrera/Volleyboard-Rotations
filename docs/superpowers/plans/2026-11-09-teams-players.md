# Teams and players Implementation Plan

> **For agentic workers:** Use the current root coordinator and the assigned backend/frontend agents. Steps use checkbox (`- [x]`) syntax for tracking. The user has requested implementation, including the UI.

**Goal:** Persistent, private CRUD for teams and players with five position ratings and reusable team lineups.

**Architecture:** Add private NoCodeBackend tables and a same-origin Netlify API. Keep the legacy board intact. Share canonical player references across each team's sets and flush pending saves before switching teams.

**Tech Stack:** Existing React 18, Vite, Auth.js, Netlify Functions, NoCodeBackend MariaDB, node:test and react-test-renderer. No new service or dependency required.

**Spec:** `docs/superpowers/specs/2026-11-09-teams-players-design.md`

## Global Constraints

- Scores are integers 0–5 or null; five position keys COL, O, R, C, L.
- Account ownership is derived only from the verified Google session.
- Preserve existing whiteboard_sets and authentication behavior.
- Five sets and eight selected players per set; 100 teams and 200 team players including deleted records.
- Production deletions in this feature are recoverable; no physical user-data deletion.

## Review Focus

- A zero score must round-trip and display red, while null stays unassigned.
- A failed initial load must never allow an empty board to overwrite saved data.
- A team switch while a save is pending must save to the original team or remain blocked.
- Deleted players stay off the court until restored; foreign-team IDs are rejected.
- A renamed player must update across all sets without duplicating the player.

## Task 1: Private team and player API

**Files:** `server/teams.mjs`, `netlify/functions/teams.mjs`, `tests/teams.test.mjs`, `migrations/2026-11-09-teams-players.sql`.

**Interfaces:** `createTeamsHandler({readSession,fetchImpl})` returns a web Request handler. Team API contract is defined in the spec; owner_key is never public.

- [x] Write and run failing CRUD/isolation/ratings/board-reference tests.
- [x] Implement validators, fixed-table storage adapter, pagination and endpoints.
- [x] Run `node --test tests/teams.test.mjs` and inspect failures.
- [x] Apply the two additive CREATE statements separately to the existing database.

## Task 2: API client and team-aware cloud lifecycle

**Files:** `src/api.js`, `src/components/useWhiteboardCloud.js`, `tests/team-api.test.mjs`, `tests/team-cloud.test.mjs`.

**Interfaces:** listTeams/createTeam/getTeam/updateTeam/deleteTeam/createPlayer/updatePlayer/deletePlayer return the existing `{status,data,error,httpStatus}` contract. loadWhiteboard/saveWhiteboard accept `options.teamId`. The cloud hook accepts teamId and returns `flush():Promise<boolean>`.

- [x] Verify failing tests for team routes, malformed IDs, zero ratings and reference-only board hydration.
- [x] Implement client methods and strict hydration.
- [x] Verify failing mounted-hook tests for waiting on an existing save, newest snapshot persistence and failed-flush blocking.
- [x] Implement flush and team scoping; retain legacy/session cancellation behavior.

## Task 3: Team and player management UI

**Files:** `src/components/Whiteboard.jsx`, new focused team/player/board components, related CSS and position metadata, `tests/teams-ui.test.mjs`.

**Interfaces:** Board components register cloud.flush using `onRegisterFlush(fn)`. Parent awaits it before changing teams or mutating the selected roster. Canonical roster comes from getTeam.

- [x] Write failing component tests for CRUD controls, numeric/color ratings and reusable player references.
- [x] Implement team selector, player forms, ratings, deleted-record recovery and team board.
- [x] Preserve personal board and keep current board mounted while hidden in the simulator or roster view.
- [x] Verify component tests and update the existing lifecycle network fixture to return an empty team list.

## Task 4: Integration and publication

- [x] Review whole diff independently for authorization, reference and async state errors.
- [x] Run `npm run build` (lint, full tests, production compilation).
- [x] Verify the real data API using only uniquely marked records created for this test workflow.
- [ ] Publish the reviewed commit with an expected-head check and confirm the Netlify deploy.
- [ ] Verify signed-in UI CRUD, refresh persistence, rating colors and deletion/restoration; leave no active test data.
- [ ] Report implemented behavior and links to the actual commit/deploy.

## Verification before publication

`npm run build`: lint passed, 67 tests passed and Vite built successfully.
Independent review found two UI draft-loss paths; both have RED/GREEN regression tests and are fixed.
Real NoCodeBackend integration verified two teams per owner, CRUD, zero/null scores, board persistence, cross-team rejection, and recoverable deletion/restoration. The three test rows were removed by their exact generated IDs after verification.
