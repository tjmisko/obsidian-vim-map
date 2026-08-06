import { describe, it, expect } from 'vitest';
import * as leaflet from 'leaflet';

import {
    collectVaultPlaces,
    osmResultsToPlaceItems,
    filterPlaces,
    fuzzyMatch,
    mergePlaceResults,
    formatDistance,
    labelOfLayer,
    anchorOfLayer,
    VAULT_SECTION,
    OSM_SECTION,
    type PlaceItem,
} from 'src/placeSearch';
import { type BoundaryLayer } from 'src/settings';

// Tag queries do not use the App (see boundaryLayers.test.ts), so `null` is
// enough for the boundary classification these tests exercise.
const app = null as any;

const CENTER = leaflet.latLng(40.75, -73.98);

/** A minimal FileMarker-like layer. */
function marker(overrides: Record<string, any> = {}): any {
    return {
        layerType: 'fileMarker',
        id: 'marker-1',
        tags: [],
        extraName: null,
        location: CENTER,
        file: { name: 'note.md', path: 'note.md', basename: 'note' },
        getBounds: () => [CENTER],
        ...overrides,
    };
}

/**
 * A minimal GeoJsonLayer-like layer. `getBounds()` returns a single-element
 * array holding a LatLngBounds, exactly as GeoJsonLayer does.
 */
function region(overrides: Record<string, any> = {}): any {
    const bounds = leaflet.latLngBounds(
        leaflet.latLng(40.7, -74.0),
        leaflet.latLng(40.8, -73.9),
    );
    return {
        layerType: 'geojson',
        id: 'region-1',
        tags: [],
        extraName: null,
        file: { name: 'area.md', path: 'area.md', basename: 'area' },
        getBounds: () => [bounds],
        ...overrides,
    };
}

const boundaryLayers: BoundaryLayer[] = [
    {
        id: 'boundary-state',
        name: 'States',
        query: 'tag:#boundary/state',
        level: 0,
        enabledByDefault: false,
        style: {},
    },
];

describe('collectVaultPlaces', () => {
    it('should list markers, boundary regions and paths when all three are on the map', () => {
        const places = collectVaultPlaces(
            [
                marker({ id: 'm' }),
                region({ id: 'r', tags: ['#boundary/state'] }),
                region({ id: 'p' }),
            ],
            CENTER,
            boundaryLayers,
            app,
        );
        expect(places.map((place) => place.kind).sort()).toEqual([
            'marker',
            'path',
            'region',
        ]);
        expect(places.every((place) => place.section === VAULT_SECTION)).toBe(
            true,
        );
    });

    it('should label a place with its extra name and note name when extraName is set', () => {
        const places = collectVaultPlaces(
            [marker({ extraName: 'The Diner' })],
            CENTER,
            [],
            app,
        );
        expect(places[0].label).toBe('The Diner (note)');
    });

    it('should label a place with just the note name when extraName is absent', () => {
        const places = collectVaultPlaces([marker()], CENTER, [], app);
        expect(places[0].label).toBe('note');
    });

    it('should skip a layer when it has no bounds', () => {
        const places = collectVaultPlaces(
            [region({ id: 'empty', getBounds: () => [] }), marker()],
            CENTER,
            [],
            app,
        );
        expect(places).toHaveLength(1);
        expect(places[0].kind).toBe('marker');
    });

    it('should order places by ascending distance from the map center', () => {
        const near = marker({
            id: 'near',
            location: leaflet.latLng(40.76, -73.98),
            file: { name: 'near.md', path: 'near.md', basename: 'near' },
        });
        const far = marker({
            id: 'far',
            location: leaflet.latLng(41.5, -73.98),
            file: { name: 'far.md', path: 'far.md', basename: 'far' },
        });
        const places = collectVaultPlaces([far, near], CENTER, [], app);
        expect(places.map((place) => place.label)).toEqual(['near', 'far']);
    });

    it('should leave places unordered and undistanced when there is no map center', () => {
        const places = collectVaultPlaces(
            [
                marker({
                    id: 'b',
                    file: { name: 'b.md', path: 'b.md', basename: 'b' },
                }),
                marker({
                    id: 'a',
                    file: { name: 'a.md', path: 'a.md', basename: 'a' },
                }),
            ],
            null,
            [],
            app,
        );
        expect(places.map((place) => place.label)).toEqual(['b', 'a']);
        expect(places[0].sublabel).toBeUndefined();
    });
});

describe('anchorOfLayer', () => {
    it('should use the center of the bounds when the layer is a region', () => {
        const anchor = anchorOfLayer(region());
        expect(anchor!.lat).toBeCloseTo(40.75, 5);
        expect(anchor!.lng).toBeCloseTo(-73.95, 5);
    });

    it('should use the location itself when the layer is a marker', () => {
        expect(anchorOfLayer(marker())).toBe(CENTER);
    });
});

describe('labelOfLayer', () => {
    it('should ignore an empty extra name', () => {
        expect(labelOfLayer(marker({ extraName: '' }))).toBe('note');
    });
});

describe('formatDistance', () => {
    it('should format a sub-kilometre distance in metres', () => {
        expect(formatDistance(820)).toBe('820 m');
        expect(formatDistance(0)).toBe('0 m');
    });

    it('should format a distance under ten kilometres with one decimal', () => {
        expect(formatDistance(8130)).toBe('8.1 km');
    });

    it('should format a long distance in whole kilometres', () => {
        expect(formatDistance(123400)).toBe('123 km');
    });

    it('should return nothing for a non-finite distance', () => {
        expect(formatDistance(NaN)).toBe('');
    });
});

describe('fuzzyMatch / filterPlaces', () => {
    const places: PlaceItem[] = [
        {
            id: '1',
            label: 'Bryant Park',
            section: VAULT_SECTION,
            kind: 'marker',
        },
        {
            id: '2',
            label: 'Prospect Park',
            section: VAULT_SECTION,
            kind: 'marker',
        },
    ];

    it('should match a name as a case-insensitive subsequence', () => {
        expect(fuzzyMatch('brpk', 'bryant park')).toBe(true);
        expect(fuzzyMatch('xyz', 'bryant park')).toBe(false);
    });

    it('should filter places case-insensitively', () => {
        expect(filterPlaces(places, 'BRYANT').map((p) => p.label)).toEqual([
            'Bryant Park',
        ]);
    });

    it('should return every place when the filter is empty', () => {
        expect(filterPlaces(places, '   ')).toHaveLength(2);
    });
});

describe('osmResultsToPlaceItems', () => {
    it('should put geocoder results in the OpenStreetMap section with a distance', () => {
        const items = osmResultsToPlaceItems(
            [
                {
                    name: 'Central Park, New York',
                    location: leaflet.latLng(40.78, -73.97),
                    resultType: 'searchResult',
                },
            ],
            CENTER,
        );
        expect(items[0].section).toBe(OSM_SECTION);
        expect(items[0].kind).toBe('osm');
        expect(items[0].sublabel).toBeTruthy();
        expect(items[0].osmResult!.name).toBe('Central Park, New York');
    });

    it('should return nothing when there are no results', () => {
        expect(osmResultsToPlaceItems([], CENTER)).toEqual([]);
    });
});

describe('mergePlaceResults', () => {
    const vault = (count: number): PlaceItem[] =>
        Array.from({ length: count }, (_, i) => ({
            id: `v${i}`,
            label: `place ${i}`,
            section: VAULT_SECTION,
            kind: 'marker' as const,
        }));
    const osm: PlaceItem[] = [
        { id: 'o1', label: 'somewhere', section: OSM_SECTION, kind: 'osm' },
    ];

    it('should place vault results before OpenStreetMap results', () => {
        const merged = mergePlaceResults(vault(2), osm, 50);
        expect(merged.map((place) => place.section)).toEqual([
            VAULT_SECTION,
            VAULT_SECTION,
            OSM_SECTION,
        ]);
    });

    it('should cap the vault results at the given maximum', () => {
        const merged = mergePlaceResults(vault(10), osm, 3);
        expect(merged).toHaveLength(4);
        expect(
            merged.filter((place) => place.section === VAULT_SECTION),
        ).toHaveLength(3);
    });
});
