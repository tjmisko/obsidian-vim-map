# Keyboard Navigation

The Main Map View can be driven almost entirely from the keyboard. When the map
is focused (click it, or run the **"Focus map (Normal mode)"** command) it is in
**Normal mode**, and the following keys are available.

Enable this with the **"Modal map interaction (vim-like)"** setting (on by
default).

## Pan & zoom

| Key                                          | Action                               |
| -------------------------------------------- | ------------------------------------ |
| Arrow keys / `h` `j` `k` `l`                 | Pan (hold `Shift` for a larger step) |
| `+` / `=`                                    | Zoom in                              |
| `-`                                          | Zoom out                             |
| `Alt`/`Option` (or `Cmd`/`Ctrl`) + `+` / `-` | Zoom by the **big** step             |
| Mouse wheel                                  | Pan                                  |
| `Ctrl`/`Cmd` + wheel                         | Zoom                                 |

The normal and big zoom steps are configurable in settings (**Zoom step** and
**Big zoom step**).

## Commands

In Normal mode, the **capital** first letters (i.e. `Shift` + the letter) open
keyboard-navigable modals:

| Key       | Opens                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Shift+F` | **Filters** — edit the query/filter live                                                                                           |
| `Shift+V` | **View** — a numbered list of view options (map source, mode, marker labels, follow, fit, reset). Press the number to run/cycle it |
| `Shift+L` | **Layers** — a fuzzy list of layers; press `1`–`9` (or Enter) to toggle a layer. Stays open so you can flip several                |
| `Shift+P` | **Presets** — a fuzzy list of presets; press a number or Enter to apply one                                                        |
| `Shift+E` | **Edit** — on-map editing tools (drawing mode, target note, heading, tags)                                                         |
| `Shift+M` | **Menu** — show/hide the top-left controls panel                                                                                   |
| `Shift+G` | **Go to** — a fuzzy list of places to focus the map on (see below)                                                                 |

The lowercase keys keep their vim meanings and don't conflict:

| Key | Action                             |
| --- | ---------------------------------- |
| `f` | Fit the map to the visible markers |
| `e` | Toggle drawing (edit) mode         |
| `/` | Focus the query box                |

## In the fuzzy modals (Layers / Presets)

- **Type** to filter the list by name.
- **`1`–`9`** select/toggle the corresponding visible row (digits are always
  shortcuts, never filter text).
- **Arrow keys** move the highlight; **Enter** chooses the highlighted row.
- **Escape** closes the modal.

## Go to (`Shift+G`)

A place finder that focuses the map without touching your filter. It lists every
place **currently on the map** — note markers, boundary regions and GeoJSON/GPX
paths — nearest to the map center first, with the distance on each row. Because
it reads what's displayed, an active query filter narrows this list too.

Type at least four characters and OpenStreetMap results are appended in their own
section, for places you haven't written about yet. This uses the same geocoder as
the rest of Map View, so it needs the **OpenStreetMap user email** setting (or a
Google API key) to be filled in.

| Key           | Action                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| `Enter`       | Center and zoom to the place, highlighting it                           |
| `Shift+Enter` | Go to the place keeping the current zoom (pans only if it's off-screen) |
| `Alt`+`1`–`9` | Jump straight to the Nth visible row                                    |
| Arrow keys    | Move the highlight                                                      |
| `Escape`      | Close without moving                                                    |

Unlike the other fuzzy modals, plain digits type into the filter here — place
names contain them — which is why the row shortcut is `Alt`+digit.

Choosing a region or a path fits the map to its whole extent rather than
centering on a point. Choosing an OpenStreetMap result drops a temporary search
marker, which the trash button next to the map's magnifier clears.

The same list is available from the command palette as **"Go to place on map"**.

## Escape

`Escape` walks back through the interaction layers, in order: blur a focused
input → exit drawing mode → close an open popup → (finally) leave the map.

## On mobile

Everything above assumes a keyboard, so on a phone or tablet the map falls back
to touch without losing any capability. Nothing here needs to be configured —
Map View detects the platform.

- The **`+`/`-` zoom buttons are always shown**, whatever the **Show zoom
  buttons** setting says. That setting exists because the keyboard zooms, and a
  touch device has no `+` key — pinch would otherwise be the only way to zoom.
- The **mode badge is hidden**. Normal/Edit/Insert are keystroke-driven, so the
  indicator has nothing to report.
- The map is **never given focus programmatically**, so it can't fight the
  on-screen keyboard.
- In the fuzzy modals (Layers / Presets / View / Go to), the filter box **isn't
  focused on open** — the on-screen keyboard would cover the very rows you came
  to tap. Tap the box when you want to filter. Rows get touch-sized hit areas,
  and the `1`–`9` row numbers are hidden since nothing can type them.

Every keyboard command has a touch equivalent:

| Keyboard command                           | On mobile                                            |
| ------------------------------------------ | ---------------------------------------------------- |
| `Shift+F` / `V` / `L` / `P` / `E`          | The matching section of the top-left controls panel  |
| `Shift+M`                                  | The minimize/maximize button in the panel's corner   |
| `Shift+G`                                  | The **"Go to place on map"** command                 |
| `f` (fit), `/` (query), `e` (drawing mode) | The controls panel's View, Filters and Edit sections |

Commands are reachable from the command palette, and worth adding to the
[mobile toolbar](https://help.obsidian.md/mobile#Customize+mobile+toolbar) if
you use them often.

An external keyboard attached to a tablet still drives the map normally — the
modal bindings stay live, they just aren't advertised in the UI.
