import * as leaflet from 'leaflet';
import type { App } from 'obsidian';

import type { BaseGeoLayer } from 'src/baseGeoLayer';
import type { BoundaryLayer } from 'src/settings';
import type { GeoSearchResult } from 'src/geosearch';
import { getBoundaryLayerForLayer } from 'src/boundaryLayers';

/**
 * Pure helpers behind the "Go to" modal (`Shift+G`). Everything here is free of
 * DOM and of a live Leaflet map, so it can be unit-tested directly — the same
 * split `modalController.ts` uses for its keymap helpers.
 *
 * `leaflet` is imported for `LatLng`/`LatLngBounds` math only (no map, no DOM).
 */

/** What a listed place actually is, which decides how focusing it behaves. */
export type PlaceKind = 'marker' | 'region' | 'path' | 'osm';

/** Section headers. These are the literal strings shown above each group. */
export const VAULT_SECTION = 'Places in your notes';
export const OSM_SECTION = 'OpenStreetMap';

/**
 * One row of the Go-to list. Structurally a `NavItem` (see
 * `components/KeyboardNavList.svelte`) plus the payload needed to focus it, so
 * the same object flows from here into the list and back out of `onSelect`.
 */
export interface PlaceItem {
    /** Stable identity for the `{#each}` key. */
    id: string;
    /** Primary text, and what the fuzzy filter matches against. */
    label: string;
    /** Right-aligned secondary text — the distance from the map center. */
    sublabel?: string;
    /** Header this row sits under: {@link VAULT_SECTION} or {@link OSM_SECTION}. */
    section: string;
    kind: PlaceKind;
    /** Set for vault places; the layer to focus. */
    layer?: BaseGeoLayer;
    /** Set for OpenStreetMap results; the geocoded location to focus. */
    osmResult?: GeoSearchResult;
    /** Distance from the map center, used for ordering. */
    distanceMeters?: number;
}

/**
 * The bounds of a layer, or `null` when it has none.
 *
 * `BaseGeoLayer.getBounds()` is declared as `LatLng[]`, but `GeoJsonLayer`
 * returns a single-element array holding a `LatLngBounds` (geojsonLayer.ts).
 * Leaflet's `latLngBounds()` extends over either kind, so both shapes work —
 * hence the cast.
 */
export function boundsOfLayer(
    layer: BaseGeoLayer,
): leaflet.LatLngBounds | null {
    const raw = layer.getBounds?.();
    if (!raw || raw.length === 0) return null;
    const bounds = leaflet.latLngBounds(raw as any);
    return bounds?.isValid() ? bounds : null;
}

/**
 * The point a layer is "at": a marker's own location, or the center of any
 * other layer's bounds. Returns `null` for a layer we can't place, which is the
 * signal to leave it out of the list entirely.
 */
export function anchorOfLayer(layer: BaseGeoLayer): leaflet.LatLng | null {
    if (layer.layerType === 'fileMarker') {
        const location = (layer as any).location as leaflet.LatLng;
        return location ?? null;
    }
    return boundsOfLayer(layer)?.getCenter() ?? null;
}

/**
 * The display name of a vault place. Mirrors the existing search dialog: an
 * inline geolocation's link name is shown with its note name in parentheses, so
 * several places in one note stay distinguishable.
 */
export function labelOfLayer(layer: BaseGeoLayer): string {
    const basename = layer.file?.basename ?? '';
    const extraName = layer.extraName;
    if (extraName && extraName !== basename)
        return basename ? `${extraName} (${basename})` : extraName;
    return basename;
}

/**
 * Whether a geojson layer is a boundary region or a plain path. Only called for
 * non-marker layers — `getBoundaryLayerForLayer` compiles the boundary queries,
 * the same per-layer cost `MapContainer.newLeafletGeoJson` already pays while
 * rendering.
 */
function kindOfLayer(
    layer: BaseGeoLayer,
    boundaryLayers: BoundaryLayer[],
    app: App,
): PlaceKind {
    if (layer.layerType === 'fileMarker') return 'marker';
    return getBoundaryLayerForLayer(layer, boundaryLayers, app)
        ? 'region'
        : 'path';
}

/** Human-readable distance: metres below a kilometre, kilometres above it. */
export function formatDistance(meters: number): string {
    if (!Number.isFinite(meters) || meters < 0) return '';
    if (meters < 1000) return `${Math.round(meters)} m`;
    const km = meters / 1000;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
}

/**
 * Build the vault half of the list from the layers currently on the map,
 * nearest to `center` first.
 *
 * Sourcing from the *displayed* layers (rather than the plugin-wide cache) is
 * deliberate: it keeps the list in step with the active query filter, and it
 * guarantees `getBounds()` has a rendered Leaflet layer to measure, which is
 * how regions and paths get their bounds at all.
 */
export function collectVaultPlaces(
    layers: Iterable<BaseGeoLayer>,
    center: leaflet.LatLng | null,
    boundaryLayers: BoundaryLayer[],
    app: App,
): PlaceItem[] {
    const places: PlaceItem[] = [];
    let index = 0;
    for (const layer of layers) {
        const anchor = anchorOfLayer(layer);
        index++;
        if (!anchor) continue;
        const distanceMeters = center ? anchor.distanceTo(center) : undefined;
        places.push({
            id: `vault:${layer.id ?? index}`,
            label: labelOfLayer(layer),
            sublabel:
                distanceMeters !== undefined
                    ? formatDistance(distanceMeters)
                    : undefined,
            section: VAULT_SECTION,
            kind: kindOfLayer(layer, boundaryLayers, app),
            layer,
            distanceMeters,
        });
    }
    return sortByDistance(places);
}

/** Convert geocoder results into list rows, keeping the provider's order. */
export function osmResultsToPlaceItems(
    results: GeoSearchResult[],
    center: leaflet.LatLng | null,
): PlaceItem[] {
    return (results ?? []).map((result, index) => {
        const distanceMeters =
            center && result.location
                ? result.location.distanceTo(center)
                : undefined;
        return {
            id: `osm:${index}:${result.name}`,
            label: result.name,
            sublabel:
                distanceMeters !== undefined
                    ? formatDistance(distanceMeters)
                    : undefined,
            section: OSM_SECTION,
            kind: 'osm' as const,
            osmResult: result,
            distanceMeters,
        };
    });
}

/**
 * Sort nearest-first. Places without a distance keep their relative order and
 * sink to the end. `Array.prototype.sort` is stable in every engine we target.
 */
export function sortByDistance(places: PlaceItem[]): PlaceItem[] {
    return [...places].sort((a, b) => {
        const d1 = a.distanceMeters;
        const d2 = b.distanceMeters;
        if (d1 === undefined && d2 === undefined) return 0;
        if (d1 === undefined) return 1;
        if (d2 === undefined) return -1;
        return d1 - d2;
    });
}

/**
 * Case-insensitive subsequence ("fuzzy") match — the lightweight approach used
 * by the other keyboard modals. `KeyboardNavList` imports this so there is one
 * implementation.
 */
export function fuzzyMatch(needle: string, haystack: string): boolean {
    if (needle.length === 0) return true;
    let i = 0;
    for (const ch of haystack) {
        if (ch === needle[i]) i++;
        if (i === needle.length) return true;
    }
    return false;
}

/** Filter places by the typed text. An empty query keeps everything. */
export function filterPlaces(places: PlaceItem[], query: string): PlaceItem[] {
    const needle = (query ?? '').trim().toLowerCase();
    if (needle.length === 0) return places;
    return places.filter((place) =>
        fuzzyMatch(needle, place.label.toLowerCase()),
    );
}

/**
 * Assemble the final list: vault places first (capped), then the geocoder's.
 * Vault results always lead so a place you've already written about wins over a
 * same-named place on the internet.
 */
export function mergePlaceResults(
    vault: PlaceItem[],
    osm: PlaceItem[],
    maxVault: number,
): PlaceItem[] {
    return [...vault.slice(0, maxVault), ...(osm ?? [])];
}
