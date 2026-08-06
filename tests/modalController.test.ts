import { describe, it, expect, vi } from 'vitest';

// The controller module statically imports the ModeBadge Svelte component (for
// the badge mount). vitest has no Svelte transform, so stub it — the pure
// helpers under test never touch it.
vi.mock('src/components/ModeBadge.svelte', () => ({ default: class {} }));

import {
    lookupBinding,
    decideEscapeAction,
    shouldShowModeBadge,
    shouldFocusMapContainer,
    KEYMAP,
    type ModalActionContext,
} from 'src/modalController';

/** A recording {@link ModalActionContext} so we can assert what an action did. */
function makeCtx(overrides: Partial<ModalActionContext> = {}) {
    const calls = {
        zoomBy: [] as number[],
        pan: [] as Array<[number, number, boolean]>,
        fit: 0,
        toggleEdit: 0,
        focusQuery: 0,
        openFilters: 0,
        openView: 0,
        openLayers: 0,
        openPresets: 0,
        openEdit: 0,
        openGoTo: 0,
        toggleControls: 0,
    };
    const ctx: ModalActionContext = {
        zoomStep: 0.5,
        shift: false,
        zoomBy: (delta) => calls.zoomBy.push(delta),
        pan: (dx, dy, big) => calls.pan.push([dx, dy, big]),
        fit: () => {
            calls.fit++;
        },
        toggleEdit: () => {
            calls.toggleEdit++;
        },
        focusQuery: () => {
            calls.focusQuery++;
        },
        openFilters: () => {
            calls.openFilters++;
        },
        openView: () => {
            calls.openView++;
        },
        openLayers: () => {
            calls.openLayers++;
        },
        openPresets: () => {
            calls.openPresets++;
        },
        openEdit: () => {
            calls.openEdit++;
        },
        openGoTo: () => {
            calls.openGoTo++;
        },
        toggleControls: () => {
            calls.toggleControls++;
        },
        ...overrides,
    };
    return { ctx, calls };
}

describe('lookupBinding', () => {
    it('should zoom in when + is pressed in normal mode', () => {
        const binding = lookupBinding('normal', '+', true);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx();
        binding!.action(ctx);
        expect(calls.zoomBy).toEqual([0.5]);
    });

    it('should zoom in when = is pressed in normal mode', () => {
        const binding = lookupBinding('normal', '=', false);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx();
        binding!.action(ctx);
        expect(calls.zoomBy).toEqual([0.5]);
    });

    it('should zoom out when - is pressed in normal mode', () => {
        const binding = lookupBinding('normal', '-', false);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx();
        binding!.action(ctx);
        expect(calls.zoomBy).toEqual([-0.5]);
    });

    it('should pan left for h and ArrowLeft in normal mode', () => {
        for (const key of ['h', 'ArrowLeft']) {
            const binding = lookupBinding('normal', key, false);
            expect(binding, key).toBeDefined();
            const { ctx, calls } = makeCtx();
            binding!.action(ctx);
            expect(calls.pan).toEqual([[-1, 0, false]]);
        }
    });

    it('should pan down for j and ArrowDown in normal mode', () => {
        for (const key of ['j', 'ArrowDown']) {
            const binding = lookupBinding('normal', key, false);
            expect(binding, key).toBeDefined();
            const { ctx, calls } = makeCtx();
            binding!.action(ctx);
            expect(calls.pan).toEqual([[0, 1, false]]);
        }
    });

    it('should pan up for k and ArrowUp in normal mode', () => {
        for (const key of ['k', 'ArrowUp']) {
            const binding = lookupBinding('normal', key, false);
            expect(binding, key).toBeDefined();
            const { ctx, calls } = makeCtx();
            binding!.action(ctx);
            expect(calls.pan).toEqual([[0, -1, false]]);
        }
    });

    it('should pan right for l and ArrowRight in normal mode', () => {
        for (const key of ['l', 'ArrowRight']) {
            const binding = lookupBinding('normal', key, false);
            expect(binding, key).toBeDefined();
            const { ctx, calls } = makeCtx();
            binding!.action(ctx);
            expect(calls.pan).toEqual([[1, 0, false]]);
        }
    });

    it('should pass a larger step (big=true) when Shift is held', () => {
        const binding = lookupBinding('normal', 'ArrowUp', true);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx({ shift: true });
        binding!.action(ctx);
        expect(calls.pan).toEqual([[0, -1, true]]);
    });

    it('should map f to fit in normal mode', () => {
        const binding = lookupBinding('normal', 'f', false);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx();
        binding!.action(ctx);
        expect(calls.fit).toBe(1);
    });

    it('should map e to toggle edit in normal mode', () => {
        const binding = lookupBinding('normal', 'e', false);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx();
        binding!.action(ctx);
        expect(calls.toggleEdit).toBe(1);
    });

    it('should map / to focus query in normal mode', () => {
        const binding = lookupBinding('normal', '/', false);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx();
        binding!.action(ctx);
        expect(calls.focusQuery).toBe(1);
    });

    it('should return undefined for an unbound key', () => {
        expect(lookupBinding('normal', 'z', false)).toBeUndefined();
        expect(lookupBinding('normal', 'Escape', false)).toBeUndefined();
    });

    it('should return undefined for a normal-only key when in insert mode', () => {
        expect(lookupBinding('insert', 'h', false)).toBeUndefined();
        expect(lookupBinding('insert', 'f', false)).toBeUndefined();
        expect(lookupBinding('insert', '+', true)).toBeUndefined();
    });

    it('should return undefined for a normal-only key when in edit mode', () => {
        expect(lookupBinding('edit', 'k', false)).toBeUndefined();
        expect(lookupBinding('edit', '/', false)).toBeUndefined();
    });

    it('should only contain normal-mode bindings', () => {
        expect(KEYMAP.length).toBeGreaterThan(0);
        expect(KEYMAP.every((b) => b.mode === 'normal')).toBe(true);
    });
});

describe('command bindings (uppercase / Shift+letter)', () => {
    // Each command key maps to its opener. They are registered shift-agnostic:
    // the key value 'F' already distinguishes them from lowercase, and matching
    // regardless of Shift keeps them working under Caps Lock.
    const cases: Array<[string, keyof ReturnType<typeof makeCtx>['calls']]> = [
        ['F', 'openFilters'],
        ['V', 'openView'],
        ['L', 'openLayers'],
        ['P', 'openPresets'],
        ['E', 'openEdit'],
        ['M', 'toggleControls'],
        ['G', 'openGoTo'],
    ];

    for (const [key, expectedCall] of cases) {
        it(`should map ${key} to ${expectedCall} regardless of Shift`, () => {
            for (const shift of [true, false]) {
                const binding = lookupBinding('normal', key, shift);
                expect(binding, `${key} shift=${shift}`).toBeDefined();
                const { ctx, calls } = makeCtx();
                binding!.action(ctx);
                expect(calls[expectedCall]).toBe(1);
            }
        });
    }

    it('should keep lowercase letters bound to their original actions', () => {
        // The command namespace uses uppercase, so lowercase f/e/l are unchanged.
        expect(lookupBinding('normal', 'f', false)!.action).not.toBe(
            lookupBinding('normal', 'F', false)!.action,
        );
        const fit = makeCtx();
        lookupBinding('normal', 'f', false)!.action(fit.ctx);
        expect(fit.calls.fit).toBe(1);
        expect(fit.calls.openFilters).toBe(0);

        const panRight = makeCtx();
        lookupBinding('normal', 'l', false)!.action(panRight.ctx);
        expect(panRight.calls.pan).toEqual([[1, 0, false]]);
        expect(panRight.calls.openLayers).toBe(0);
    });

    it('should be inert in insert and edit modes', () => {
        for (const key of ['F', 'V', 'L', 'P', 'E', 'M', 'G']) {
            expect(lookupBinding('insert', key, true)).toBeUndefined();
            expect(lookupBinding('edit', key, true)).toBeUndefined();
        }
    });

    it('should leave lowercase g unbound so vim-style g-prefixes stay free', () => {
        expect(lookupBinding('normal', 'g', false)).toBeUndefined();
    });
});

describe('big zoom step (Alt/Meta effective step)', () => {
    // The controller feeds the *effective* step into ctx.zoomStep (the bigger
    // settings.zoomStepBig when Alt/Meta is held). The +/- actions just consume
    // it, so a larger ctx.zoomStep produces a larger zoom delta.
    it('should zoom by the effective step for + and -', () => {
        const plus = makeCtx({ zoomStep: 2.0 });
        lookupBinding('normal', '+', true)!.action(plus.ctx);
        expect(plus.calls.zoomBy).toEqual([2.0]);

        const minus = makeCtx({ zoomStep: 2.0 });
        lookupBinding('normal', '-', false)!.action(minus.ctx);
        expect(minus.calls.zoomBy).toEqual([-2.0]);
    });
});

describe('decideEscapeAction', () => {
    it('should blur when a view input is focused', () => {
        expect(
            decideEscapeAction({
                activeElementIsEditableInView: true,
                editMode: false,
                popupOpen: false,
            }),
        ).toBe('blur');
    });

    it('should exit edit when in edit mode and no input focused', () => {
        expect(
            decideEscapeAction({
                activeElementIsEditableInView: false,
                editMode: true,
                popupOpen: false,
            }),
        ).toBe('exitEdit');
    });

    it('should close the popup when one is open and nothing higher applies', () => {
        expect(
            decideEscapeAction({
                activeElementIsEditableInView: false,
                editMode: false,
                popupOpen: true,
            }),
        ).toBe('closePopup');
    });

    it('should do nothing when already in normal mode', () => {
        expect(
            decideEscapeAction({
                activeElementIsEditableInView: false,
                editMode: false,
                popupOpen: false,
            }),
        ).toBe('none');
    });

    it('should prioritize blur over exiting edit', () => {
        expect(
            decideEscapeAction({
                activeElementIsEditableInView: true,
                editMode: true,
                popupOpen: true,
            }),
        ).toBe('blur');
    });

    it('should prioritize exiting edit over closing a popup', () => {
        expect(
            decideEscapeAction({
                activeElementIsEditableInView: false,
                editMode: true,
                popupOpen: true,
            }),
        ).toBe('exitEdit');
    });
});

describe('shouldShowModeBadge', () => {
    it('should show the badge on desktop when the feature is on', () => {
        expect(
            shouldShowModeBadge({ featureEnabled: true, mobile: false }),
        ).toBe(true);
    });

    it('should hide the badge when the feature is off', () => {
        expect(
            shouldShowModeBadge({ featureEnabled: false, mobile: false }),
        ).toBe(false);
    });

    it('should hide the badge on mobile even when the feature is on', () => {
        // The modes it names are only reachable by keystroke.
        expect(
            shouldShowModeBadge({ featureEnabled: true, mobile: true }),
        ).toBe(false);
    });
});

describe('shouldFocusMapContainer', () => {
    it('should focus the map on desktop in normal mode', () => {
        expect(shouldFocusMapContainer({ mode: 'normal', mobile: false })).toBe(
            true,
        );
    });

    it('should focus the map on desktop in edit mode', () => {
        expect(shouldFocusMapContainer({ mode: 'edit', mobile: false })).toBe(
            true,
        );
    });

    it('should not steal focus from an input in insert mode', () => {
        expect(shouldFocusMapContainer({ mode: 'insert', mobile: false })).toBe(
            false,
        );
    });

    it('should never focus the map on mobile', () => {
        // Nothing would catch the keystrokes, and it fights the on-screen keyboard.
        for (const mode of ['normal', 'edit', 'insert'] as const)
            expect(shouldFocusMapContainer({ mode, mobile: true }), mode).toBe(
                false,
            );
    });
});
