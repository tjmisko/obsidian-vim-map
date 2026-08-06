# Deviations from upstream

This repository is a fork of [esm7/obsidian-map-view](https://github.com/esm7/obsidian-map-view).
This file catalogs everything this fork adds or changes on top of upstream, so
the custom surface stays legible and rebasing onto future upstream releases is
tractable.

- **Upstream baseline:** `esm7/obsidian-map-view` `master` @ `1008df8` ("Skill
  update"), package version **6.1.4**.
- **Nature of the deviation:** two feature arcs — **boundary layers**
  (note-sourced political/region overlays, plus the interaction, styling, and
  per-note-color work that grew out of it) and **keyboard-first map interaction**
  (a modal/vim-like control model with single-key command modals). The fork also
  **removes** the upstream Links (marker-edge) feature.

Keep this file updated when you add another deviation. To see the raw diff at
any time: `git diff origin/master..HEAD`.

---

## 1. Feature: Boundary layers

Turns notes into toggleable region overlays (countries, states, counties,
cities). Each "level" is an independently toggleable layer whose regions are
selected by a query and drawn with a fine border and a light fill.

**Authoring convention** (see `docs/boundary-note-authoring.md`): a boundary
note has an empty `locations:` key (enables geojson parsing, no centroid pin),
exactly one `#boundary/<level>` tag, and one inline `geojson` block.

**Default levels** (in `DEFAULT_SETTINGS.boundaryLayers`):

| Layer     | id                 | Tag                 | Level | Color     |
| --------- | ------------------ | ------------------- | ----- | --------- |
| Countries | `boundary-country` | `#boundary/country` | 0     | `#c0392b` |
| States    | `boundary-state`   | `#boundary/state`   | 1     | `#2980b9` |
| Counties  | `boundary-county`  | `#boundary/county`  | 2     | `#27ae60` |
| Cities    | `boundary-city`    | `#boundary/city`    | 3     | `#8e44ad` |

Levels drive z-order: higher level → higher Leaflet pane → drawn on top and wins
native hover hit-testing, so the **smallest / most-nested region is on top**.

**Rendering integration:** boundary regions reuse the existing
cache → query-filter → display-rules → render pipeline. They are `GeoJsonLayer`s
whose belonging is decided by matching each boundary layer's query
(`getBoundaryLayerForLayer`). Per-level panes are named `mv-boundary-pane-<level>`
with z-index `410 + level` (below the marker pane at 600).

**Per-view toggle state** rides `MapState.enabledBoundaryLayerIds` (persisted in
embeds, presets, and view URLs). Toggles are exposed in the map controls under a
**Layers** section.

**Note-level default for embeds:** an embedded `mapview` inside a boundary note
defaults that note's own level on, so the region you're reading about shows
without a manual toggle. Applied only when the code block does **not** pin a
non-empty `enabledBoundaryLayerIds` (empty/missing is treated as "unspecified").
Consequence: a boundary note's embed always shows at least its own region.

**Settings migration:** `loadSettings` calls `ensureDefaultBoundaryLayers`,
which appends any built-in boundary layer (by stable `id`) missing from saved
settings. Non-destructive — never edits or removes user layers. This is how a
`data.json` predating a newly-added level (e.g. Cities) still gets it.

## 2. Feature: Per-note `map-color` frontmatter

A note can set a frontmatter property to a CSS color to override how it's drawn
on the map — its marker, its paths/regions, and its boundary outline + fill —
winning over display rules and the boundary layer's own color.

- The property name is configurable: setting `frontMatterColorKey`, default
  `map-color` (mirrors the existing `frontMatterKey` for locations).
- Applied last in `DisplayRulesCache.runOn` (marker + path color) and again in
  `newLeafletGeoJson` after the boundary style (so it beats the boundary color).
- Helper: `utils.getFrontMatterColorOverride`.
- Note: the marker library renders **named** colors best; hex works cleanly for
  paths/regions.

## 3. Interaction & styling changes

- **Click-to-pin regions.** Clicking a boundary region opens its note popup and
  gives the region a persistent selection highlight (`mv-boundary-selected`),
  driven by selection state — not `:hover` — so the popup stays reachable with
  the mouse. Clicking it again, clicking the map, pressing <kbd>Escape</kbd>, or
  closing the popup unpins. (Escape is a document capture-phase listener active
  only while a region is pinned, so it closes the popup before Obsidian acts on
  the key.)
- **Hover is a cue only.** Mouseover fades the fill in (`mv-boundary-hover`) for
  discoverability but no longer opens the popup.
- **Light resting fill.** Boundary regions have a nonzero resting
  `fill-opacity: 0.07` (hover `0.12`, selected `0.18`), so regions read as filled
  areas, not just outlines. All in `styles.css`.
- **Horizontal-scroll pan.** Horizontal mouse-wheel / trackpad scroll pans the
  map left–right (Leaflet keeps vertical scroll for zoom). Respects a locked map.
- **Right-click nested-region select.** Right-clicking a boundary region lists
  every boundary polygon stacked under the cursor ("Select region: <name>",
  smallest-first) so an occluded larger region is still reachable. Uses
  point-in-polygon (`utils.isPointInGeometry`) and `utils.geometryArea`.

## 4. Data-model & settings additions

- `PluginSettings.boundaryLayers: BoundaryLayer[]` and the `BoundaryLayer` type
  (`src/settings.ts`).
- `PluginSettings.frontMatterColorKey: string` (default `map-color`).
- `MapState.enabledBoundaryLayerIds: string[]`, wired through `mergeStates`,
  `areStatesEqual` (order-insensitive set compare), `stateToRawObject`,
  `stateFromParsedUrl`, and `getCodeBlock` (`src/mapState.ts`).
- `DEFAULT_SETTINGS.defaultState.enabledBoundaryLayerIds` seeds the default
  enabled set.
- Boundary CSS class-name constants in `src/consts.ts`
  (`BOUNDARY_CLASS_NAME`, `BOUNDARY_HOVER_CLASS_NAME`,
  `BOUNDARY_SELECTED_CLASS_NAME`).

## 5. New files

| File                              | Purpose                                                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/boundaryLayers.ts`           | Pure boundary logic: `filterOutDisabledBoundaryLayers`, `getBoundaryLayerForLayer`, `boundaryPaneName`, `boundaryLayerIdForNote`. |
| `src/placeSearch.ts`              | Pure Go-to logic: collect/classify/label/sort the places on the map, fuzzy filter, distance format, geocoder-result merge.        |
| `docs/boundary-layers-plan.md`    | Design & implementation plan for the feature.                                                                                     |
| `docs/boundary-note-authoring.md` | How to tag a note as a boundary region.                                                                                           |
| `tests/boundaryLayers.test.ts`    | Tests for the boundary logic helpers.                                                                                             |
| `tests/geometryUtils.test.ts`     | Tests for point-in-polygon and area helpers.                                                                                      |
| `tests/placeSearch.test.ts`       | Tests for the Go-to place helpers.                                                                                                |

## 6. Modified upstream files

| File                                                                                      | What changed                                                                                                                                                        |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/settings.ts`                                                                         | `BoundaryLayer` type; `boundaryLayers` + `frontMatterColorKey` settings; `DEFAULT_SETTINGS` boundary layers and default enabled ids.                                |
| `src/mapState.ts`                                                                         | `enabledBoundaryLayerIds` field + (de)serialization + set-wise equality.                                                                                            |
| `src/mapContainer.ts`                                                                     | Boundary rendering with per-level panes; click-to-pin selection + hover cue; horizontal-scroll pan; `map-color` override at render; right-click nested-region menu. |
| `src/main.ts`                                                                             | Boundary-layer settings migration; note-level boundary default for embeds; passes settings to `DisplayRulesCache`.                                                  |
| `src/displayRulesCache.ts`                                                                | Takes `settings`; applies the `map-color` frontmatter override to marker + path color.                                                                              |
| `src/utils.ts`                                                                            | `getFrontMatterColorOverride`, `isPointInGeometry`, `geometryArea`.                                                                                                 |
| `src/consts.ts`                                                                           | Boundary CSS class-name constants.                                                                                                                                  |
| `src/settingsTab.ts`                                                                      | Boundary-layers editor UI; `map-color` key setting.                                                                                                                 |
| `src/geojsonLayer.ts`                                                                     | Inherit a note's own tags onto its geojson layers so `tag:` queries match regions.                                                                                  |
| `src/components/MarkerPopup.svelte`                                                       | Show note body for geojson region popups; gate the elevation chart to tracks with elevation.                                                                        |
| `src/components/ViewControlsPanel.svelte`                                                 | **Layers** toggle section in map controls.                                                                                                                          |
| `src/components/DisplayRules.svelte`                                                      | Pass `settings` to `DisplayRulesCache`.                                                                                                                             |
| `styles.css`                                                                              | `.mv-boundary` resting/hover/selected fill + transitions.                                                                                                           |
| `rollup.config.js`                                                                        | Keep the TS `outDir` off the project root so the dev build emits `main.js` to the plugin folder.                                                                    |
| `tests/__mocks__/obsidian.ts`                                                             | `getAllTags` mock returns the cache's tags.                                                                                                                         |
| `tests/displayRulesCache.test.ts`, `tests/geojsonLayer.test.ts`, `tests/mapState.test.ts` | Coverage for the above.                                                                                                                                             |

## 7. Feature: Keyboard-first map interaction

Builds on the existing `ModalController` (Normal/Edit/Insert modes, wheel-pan,
`+`/`-` zoom, Escape chain) with a **single-key command namespace** for
driving the whole map from the keyboard, plus supporting UI cleanups.

**Command modals** — in Normal mode, the _uppercase_ first letters (i.e.
`Shift+<letter>`) open keyboard-navigable modals. They are registered
shift-agnostic in `KEYMAP`, so the lowercase vim bindings (`f`=fit,
`e`=toggle-draw, `hjkl`=pan) are untouched — no conflict.

| Key       | Command | Modal                                                               |
| --------- | ------- | ------------------------------------------------------------------- |
| `Shift+F` | Filters | Live query editor (reuses `QueryTextField`)                         |
| `Shift+V` | View    | Numbered option list (map source, mode, labels, follow, fit, reset) |
| `Shift+L` | Layers  | Fuzzy list of boundary layers; digits 1-9 toggle, stays open        |
| `Shift+P` | Presets | Fuzzy preset list; digit/Enter applies and closes                   |
| `Shift+E` | Edit    | On-map edit tools (drawing mode, note/heading/tags)                 |
| `Shift+M` | Menu    | Toggles the top-left controls panel (minimize)                      |
| `Shift+G` | Go to   | Fuzzy place finder over the map's layers + OpenStreetMap            |

All modals mount a Svelte component via `SvelteModal`, receive the
`MapContainer` as `view`, and apply changes through `view.highLevelSetViewState`
(which re-renders the map and re-syncs the controls panel). The fuzzy modals
share `KeyboardNavList.svelte` — a reusable numbered/fuzzy list where digits 1-9
are _row shortcuts_ (never filter text), arrows move the highlight, Enter
chooses, Escape closes, and `stayOpen` decides toggle-vs-select.

**Go to (`Shift+G`)** — a place finder that navigates without touching the
filter. It lists the layers currently on the map (markers, boundary regions,
GeoJSON/GPX paths) nearest-first with a distance sublabel, and appends
OpenStreetMap geocoder results in a second section once four characters are
typed. Sourcing from `display.layers` rather than the plugin-wide cache keeps
the list in step with the active query _and_ guarantees `getBounds()` has a
rendered Leaflet layer to measure. `Enter` centers at `zoomOnGoFromNote` (or
fits a region/path to its extent); `Shift+Enter` keeps the current zoom. All the
list math is pure and lives in `src/placeSearch.ts`.

`KeyboardNavList` gained five additive props for it, each defaulting to the
previous behavior: `section` headers on `NavItem`, a bindable `query`,
`filterItems` (off when the parent filters), `digitShortcuts`
(`'plain'`/`'alt'`/`'none'` — Go-to uses `'alt'` so plain digits stay typable in
place names, matched on `e.code` since Alt+digit yields a symbol on some
layouts), and `statusText`. `onSelect` now also receives the originating event
(for `Shift+Enter`), the highlight resets on input, and the highlighted row is
scrolled into view.

**Big zoom step** — holding Alt/Option (or Cmd/Ctrl) with `+`/`-` uses
`settings.zoomStepBig` (default `2.0`) instead of `settings.zoomStep`, for a
coarser jump. `ModalController.buildActionContext(shift, big)` computes the
effective step; `KEYMAP` is unchanged.

**Zoom buttons off by default** — new `settings.showZoomButtons` (default
`false`). `MapContainer.addZoomButtons` now gates on it _and_ the per-view
`viewSettings.showZoomButtons`, so the `+`/`-` buttons are hidden unless the user
opts in.

**Theme-aware controls + attribution** (`styles.css`) — the right-side Leaflet
control bars now take Obsidian's theme surface (`--background-*`/`--text-*`),
and the bottom-right attribution is shrunk/dimmed and theme-aware. The "Leaflet"
prefix flag is dropped via `attributionControl.setPrefix(false)` in `createMap`.

**Mobile degradation** — the whole feature assumes a keyboard, so on
`Platform.isMobile` the keyboard-only affordances are dropped while every
capability stays reachable by touch. The rules are pure predicates so they're
testable without a Leaflet map: `utils.shouldShowZoomButtons` (mobile is an
implicit opt-in, since `showZoomButtons` defaults off for keyboard zooming;
the per-view flag and the lock still win), `shouldShowModeBadge` and
`shouldFocusMapContainer` (both in `modalController.ts`). `KeyboardNavList`
additionally skips its autofocus (the on-screen keyboard would cover the rows),
hides the `1`-`9` row numbers, drops the highlight background, and pads rows to
a touch-sized target; `GoToModal`/`FiltersModal` swap their key-hint line for a
touch one. The `ModalController` itself is **not** disabled on mobile, so an
external keyboard on a tablet still works — it just isn't advertised.

**New files:** `src/components/KeyboardNavList.svelte`,
`FiltersModal.svelte`, `ViewModal.svelte`, `LayersModal.svelte`,
`PresetsModal.svelte`, `EditModal.svelte`, `GoToModal.svelte`,
`src/placeSearch.ts`. **Touched:** `modalController.ts`
(command bindings + big-zoom + the mobile predicates), `viewControls.ts` +
`ViewControlsPanel.svelte` (`toggleControlsVisibility`/`toggleMinimized`,
`SearchControl.show/hideClearButton`), `mapContainer.ts` (`open*Modal` methods,
`goToLayer`/`goToExternalPlace`, zoom-button gate, attribution prefix),
`main.ts` ("Go to place on map" command), `consts.ts`
(`MAX_PLACE_SUGGESTIONS`), `settings.ts` + `settingsTab.ts`
(`showZoomButtons`, `zoomStepBig`), `utils.ts` (`shouldShowZoomButtons`),
`docs/keyboard-navigation.md` ("On mobile").
**Tests:** `tests/modalController.test.ts` extended for the command bindings,
the effective zoom step and the badge/focus mobile predicates;
`tests/utils.test.ts` for `shouldShowZoomButtons`; `tests/placeSearch.test.ts`
for the Go-to helpers.

## 8. Removal: Links (marker-edge) feature

The upstream **Links** feature (drawing polyline edges between linked notes'
markers, with a "show links" toggle + edge color, and a hover "fade" highlight)
is removed on this fork — it freed the `L` key for the Layers command and isn't
used here.

- Dropped `MapState.showLinks`/`linkColor`, `MapControlsSections.linksDisplayed`,
  and the `ViewSettings.showLinks` per-view flag; the "Links" controls section;
  the Bases "Links" config group; and the `.mv-fade-*` CSS.
- Removed the edge model + builders in `src/fileMarker.ts` (`Edge`,
  `addEdgesToMarkers`, `addEdgesFromFile`, `_edges`/`edges`/`removeEdges`/
  `isLinkedTo`, `FileWithMarkers`) and the polyline/hover-highlight logic in
  `src/mapContainer.ts` (`buildPolylines`, `startHoverHighlight`,
  `endHoverHighlight`).
- **Kept** (NOT part of Links): the `linkedfrom:`/`linkedto:` query operators and
  `fileMarker.isLayerLinkedFrom` (shared with the query engine).
- Deleted `docs/links-view.md` + its screenshot.

## 9. Rebasing / maintenance notes

- The feature deliberately plugs into upstream's existing pipeline rather than
  forking it, so most upstream changes merge cleanly.
- **Highest conflict risk on a rebase:** `src/mapContainer.ts` (large, central,
  and heavily extended here), then `src/settings.ts`, `src/main.ts`, and
  `src/mapState.ts`.
- The boundary logic itself (`src/boundaryLayers.ts`) and the pure helpers in
  `src/utils.ts` are self-contained and unlikely to conflict.
- If upstream adds fields to `MapState`, re-check the (de)serialization and
  `areStatesEqual` wiring for `enabledBoundaryLayerIds`.
