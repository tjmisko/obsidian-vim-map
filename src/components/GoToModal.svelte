<script lang="ts">
    import { App, Platform } from 'obsidian';
    import { onDestroy } from 'svelte';
    import { debounce } from 'ts-debounce';

    import { type PluginSettings } from '../settings';
    import { MapContainer } from '../mapContainer';
    import MapViewPlugin from '../main';
    import KeyboardNavList from './KeyboardNavList.svelte';
    import * as consts from '../consts';
    import { GeoSearcher, searchDelayMs } from '../geosearch';
    import {
        collectVaultPlaces,
        filterPlaces,
        mergePlaceResults,
        osmResultsToPlaceItems,
        type PlaceItem,
    } from '../placeSearch';

    // The "Go to" modal (Shift+G). Lists every place currently on the map —
    // markers, boundary regions and GeoJSON/GPX paths — nearest first, and
    // appends OpenStreetMap geocoder results below them once enough has been
    // typed. Choosing a row focuses the map on it; Shift+Enter keeps the
    // current zoom. All the list math lives in `src/placeSearch.ts`.

    let { app, plugin, settings, view, close } = $props<{
        app: App;
        plugin: MapViewPlugin;
        settings: PluginSettings;
        view: MapContainer;
        close: () => void;
    }>();

    /** Below this many characters we don't hit the geocoder at all. */
    const MIN_OSM_QUERY_LENGTH = 4;

    const center = view.getState().mapCenter ?? null;

    // Snapshot the vault places once — the layers on the map can't change while
    // a modal is open, and `getMarkers().layers` is a single-use iterator.
    const vaultPlaces: PlaceItem[] = collectVaultPlaces(
        view.getMarkers().layers,
        center,
        settings.boundaryLayers ?? [],
        app,
    );

    let query = $state('');
    let osmPlaces: PlaceItem[] = $state([]);
    let statusText = $state('');

    // We filter here rather than letting the list do it, so the geocoder's
    // results (already matched server-side) aren't filtered a second time.
    const items = $derived(
        mergePlaceResults(
            filterPlaces(vaultPlaces, query),
            osmPlaces,
            consts.MAX_PLACE_SUGGESTIONS,
        ),
    );

    let searcher: GeoSearcher | null = null;
    /** Monotonic request id, so a slow response can't overwrite a newer one. */
    let latestRequest = 0;
    let destroyed = false;

    async function searchOpenStreetMap(text: string) {
        const requestId = ++latestRequest;
        // Constructed lazily: GeoSearcher's constructor shows a Notice when the
        // OSM email is unset, and that shouldn't fire just from opening this.
        if (!searcher) searcher = new GeoSearcher(app, settings);
        statusText = 'Searching OpenStreetMap…';
        try {
            const results = await searcher.search(
                text,
                view.display.map?.getBounds() ?? null,
            );
            if (destroyed || requestId !== latestRequest) return;
            osmPlaces = osmResultsToPlaceItems(results, center);
            statusText =
                osmPlaces.length === 0 ? 'No OpenStreetMap results' : '';
        } catch (e) {
            if (destroyed || requestId !== latestRequest) return;
            // GeoSearcher throws when no provider is configured (e.g. the OSM
            // email is unset) — report it in the list instead of blowing up.
            console.log('Map View: OpenStreetMap search failed:', e);
            osmPlaces = [];
            statusText = 'OpenStreetMap search unavailable';
        }
    }

    // `searchDelayMs` already floors OSM at 1s to respect Nominatim's limits.
    const debouncedSearch = debounce(
        searchOpenStreetMap,
        searchDelayMs(settings),
    );

    $effect(() => {
        const text = query.trim();
        if (text.length < MIN_OSM_QUERY_LENGTH) {
            // Invalidate anything in flight so a late response can't repopulate
            // the list after the user cleared the box.
            latestRequest++;
            osmPlaces = [];
            statusText = '';
            return;
        }
        debouncedSearch(text);
    });

    onDestroy(() => {
        destroyed = true;
    });

    function onSelect(
        item: PlaceItem,
        _index: number,
        event?: KeyboardEvent | MouseEvent,
    ) {
        const keepZoom = !!event?.shiftKey;
        if (item.kind === 'osm')
            view.goToExternalPlace(item.osmResult, keepZoom);
        else view.goToLayer(item.layer, keepZoom);
        // KeyboardNavList closes the modal for us (stayOpen is false); hand
        // focus back to the map afterwards so we land in Normal mode.
        setTimeout(() => view.focusForModal(), 0);
    }
</script>

<div class="mv-kbd-title">Go to</div>
<KeyboardNavList
    {items}
    bind:query
    placeholder="Go to place…"
    filterItems={false}
    digitShortcuts="alt"
    emptyText="No places found"
    {statusText}
    {onSelect}
    {close}
/>
<div class="mv-kbd-hint">
    {#if Platform.isMobile}
        Tap a place to go there
    {:else}
        Enter to go · Shift+Enter keeps zoom · Alt+1-9 to jump · Esc to cancel
    {/if}
</div>

<style>
    .mv-kbd-title {
        font-weight: 600;
        margin-bottom: 8px;
    }

    .mv-kbd-hint {
        color: var(--text-muted);
        font-size: var(--font-ui-smaller);
        margin-top: 6px;
    }
</style>
