import type { MapContainer } from './mapContainer';
import { mount, unmount } from 'svelte';
import ModeBadge from './components/ModeBadge.svelte';

/**
 * The three modal-interaction modes (design §2). `mode` is always *derived*
 * from the host's current focus/edit state, never authoritative — see
 * {@link ModalController.computeMode}.
 */
export type MapMode = 'normal' | 'edit' | 'insert';

/**
 * The verbs {@link decideEscapeAction} may return. The controller maps each to
 * a concrete side effect (blur / exit-edit / close-popup / do-nothing).
 */
export type EscapeAction = 'blur' | 'exitEdit' | 'closePopup' | 'none';

/**
 * The surface a keymap action is allowed to touch. Every method delegates to
 * the host {@link MapContainer}; the context is what makes the {@link KEYMAP}
 * table pure data (design §2.1).
 */
export interface ModalActionContext {
    /**
     * The effective zoom step for `+`/`-`. This is `settings.zoomStepBig` when
     * Alt/Meta was held for the keystroke (a bigger jump), otherwise
     * `settings.zoomStep`.
     */
    zoomStep: number;
    /** True when Shift was held for this keystroke (pan/zoom a larger step). */
    shift: boolean;
    /** Zoom by `delta` map levels (respects `zoomSnap`/`zoomDelta`). */
    zoomBy(delta: number): void;
    /** Pan by a unit vector (`dx`,`dy`) ∈ {-1,0,1}; `big` = Shift = larger step. */
    pan(dx: number, dy: number, big: boolean): void;
    /** Fit the map to the currently visible markers. */
    fit(): void;
    /** Toggle Edit (geoman drawing) mode. */
    toggleEdit(): void;
    /** Focus the query/filter box (enters Insert). */
    focusQuery(): void;
    /** Open the Filters modal (Shift+F). */
    openFilters(): void;
    /** Open the View-options modal (Shift+V). */
    openView(): void;
    /** Open the Layers fuzzy-toggle modal (Shift+L). */
    openLayers(): void;
    /** Open the Presets fuzzy modal (Shift+P). */
    openPresets(): void;
    /** Open the Edit-tools modal (Shift+E). */
    openEdit(): void;
    /** Open the Go-to place finder modal (Shift+G). */
    openGoTo(): void;
    /** Toggle the visibility of the top-left map controls panel (Shift+M). */
    toggleControls(): void;
}

export type ModalAction = (ctx: ModalActionContext) => void;

/** One entry in the declarative keymap table. */
export interface ModalKeyBinding {
    /** Which mode this binding is active in. */
    mode: MapMode;
    /** The `KeyboardEvent.key` value, e.g. '+', 'h', 'ArrowUp', 'f'. */
    key: string;
    /**
     * When set, the binding only matches this Shift state. When omitted the
     * binding matches regardless of Shift (the action reads `ctx.shift` for the
     * larger-step behavior), which keeps pan/zoom to a single entry per key.
     */
    shift?: boolean;
    /** What to run when the binding matches. */
    action: ModalAction;
}

/** Base pixel step for a single pan keystroke. Shift multiplies it. */
export const PAN_STEP_PX = 80;
/** Multiplier applied to the pan step when Shift is held. */
export const PAN_STEP_BIG_MULTIPLIER = 3;
/** Fallback zoom step when `settings.zoomStep` is unset (matches WU-1 default). */
export const DEFAULT_ZOOM_STEP = 0.5;
/**
 * Fallback big zoom step when `settings.zoomStepBig` is unset. Used by `+`/`-`
 * while Alt/Meta is held, for a coarser jump than the normal step.
 */
export const DEFAULT_ZOOM_STEP_BIG = 2.0;

/**
 * The entire modal binding set as data. Adding a binding is a one-line entry
 * here (design goal: "robust to implement more later"). Only Normal-mode
 * bindings exist, so keys are naturally inert in Edit/Insert. Escape is *not*
 * in the table — it runs through {@link decideEscapeAction}.
 */
export const KEYMAP: ModalKeyBinding[] = [
    // Zoom. `+` on most layouts arrives with Shift (Shift+`=`); `=` is the
    // unshifted alias. Both zoom in; `-` zooms out.
    { mode: 'normal', key: '+', action: (c) => c.zoomBy(+c.zoomStep) },
    { mode: 'normal', key: '=', action: (c) => c.zoomBy(+c.zoomStep) },
    { mode: 'normal', key: '-', action: (c) => c.zoomBy(-c.zoomStep) },
    // Pan — arrows and hjkl. A single entry per direction handles both plain
    // and Shift presses; the action reads `ctx.shift` for the larger step.
    { mode: 'normal', key: 'ArrowUp', action: (c) => c.pan(0, -1, c.shift) },
    { mode: 'normal', key: 'k', action: (c) => c.pan(0, -1, c.shift) },
    { mode: 'normal', key: 'ArrowDown', action: (c) => c.pan(0, 1, c.shift) },
    { mode: 'normal', key: 'j', action: (c) => c.pan(0, 1, c.shift) },
    { mode: 'normal', key: 'ArrowLeft', action: (c) => c.pan(-1, 0, c.shift) },
    { mode: 'normal', key: 'h', action: (c) => c.pan(-1, 0, c.shift) },
    { mode: 'normal', key: 'ArrowRight', action: (c) => c.pan(1, 0, c.shift) },
    { mode: 'normal', key: 'l', action: (c) => c.pan(1, 0, c.shift) },
    // Actions.
    { mode: 'normal', key: 'f', action: (c) => c.fit() },
    { mode: 'normal', key: 'e', action: (c) => c.toggleEdit() },
    { mode: 'normal', key: '/', action: (c) => c.focusQuery() },
    // Command namespace — the *uppercase* first letters, i.e. Shift+<letter>.
    // Registered shift-agnostic (no `shift` field): the key value 'F' already
    // distinguishes them from the lowercase 'f' pan/fit bindings, and matching
    // regardless of Shift keeps them working under Caps Lock too.
    { mode: 'normal', key: 'F', action: (c) => c.openFilters() },
    { mode: 'normal', key: 'V', action: (c) => c.openView() },
    { mode: 'normal', key: 'L', action: (c) => c.openLayers() },
    { mode: 'normal', key: 'P', action: (c) => c.openPresets() },
    { mode: 'normal', key: 'E', action: (c) => c.openEdit() },
    { mode: 'normal', key: 'M', action: (c) => c.toggleControls() },
    { mode: 'normal', key: 'G', action: (c) => c.openGoTo() },
];

/** Build the O(1) lookup key for a (mode, key, shift) triple. */
function bindingKey(mode: MapMode, key: string, shift: boolean): string {
    return `${mode}:${key}:${shift ? 1 : 0}`;
}

/**
 * Precomputed hash index over {@link KEYMAP}. A binding with an explicit
 * `shift` is registered once; a shift-agnostic binding is registered under both
 * Shift states so a single table entry covers both. Built once at module load —
 * pure, no DOM (safe to import in a non-browser test).
 */
const KEYMAP_INDEX: Map<string, ModalKeyBinding> = (() => {
    const index = new Map<string, ModalKeyBinding>();
    for (const binding of KEYMAP) {
        if (binding.shift === undefined) {
            index.set(bindingKey(binding.mode, binding.key, false), binding);
            index.set(bindingKey(binding.mode, binding.key, true), binding);
        } else {
            index.set(
                bindingKey(binding.mode, binding.key, binding.shift),
                binding,
            );
        }
    }
    return index;
})();

/**
 * Pure O(1) keymap lookup. Returns the matching binding or `undefined`.
 * Exported for unit testing without constructing a controller.
 */
export function lookupBinding(
    mode: MapMode,
    key: string,
    shift: boolean,
): ModalKeyBinding | undefined {
    return KEYMAP_INDEX.get(bindingKey(mode, key, shift));
}

/**
 * Pure Escape-priority decision (plan §6 steps 2→3→4→5). Step 1 (a pinned
 * boundary region) is intercepted upstream by the capture-phase boundary
 * handler and never reaches here. First match wins.
 */
export function decideEscapeAction(input: {
    activeElementIsEditableInView: boolean;
    editMode: boolean;
    popupOpen: boolean;
}): EscapeAction {
    if (input.activeElementIsEditableInView) return 'blur';
    if (input.editMode) return 'exitEdit';
    if (input.popupOpen) return 'closePopup';
    return 'none';
}

/**
 * True when `el` is an editable form control or contenteditable element — the
 * signal that the view is in Insert mode.
 */
function isEditableElement(el: Element | null): boolean {
    if (!el) return false;
    const tag = (el as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if ((el as HTMLElement).isContentEditable) return true;
    return false;
}

/**
 * Owns all modal state and behavior for ONE {@link MapContainer}. Multiple
 * main-view panes each construct their own controller, so no mode state is
 * shared or static (design §7).
 *
 * All DOM/Leaflet access lives inside the class (never at module top level), so
 * importing this module for the pure helpers has no browser requirement.
 */
export class ModalController {
    private host: MapContainer;
    /** Master enable flag, toggled by the lock coupling via {@link setEnabled}. */
    private enabled = true;
    private viewDiv: HTMLElement;
    private mapContainerEl: HTMLElement | null = null;

    private badgeWrapper: HTMLElement | null = null;
    private badgeInstance: Record<string, any> | null = null;
    private badgeMode: MapMode | null = null;

    private destroyed = false;

    // Stable listener references so add/removeEventListener pair up correctly.
    private readonly onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    private readonly onWheel = (e: WheelEvent) => this.handleWheel(e);
    private readonly onFocusChange = () => this.refreshBadge();

    constructor(host: MapContainer) {
        this.host = host;
        this.viewDiv = host.display.viewDiv;

        // keydown on the view root, bubble phase (the boundary Escape handler
        // runs at document capture ahead of this — plan §6 step 1).
        this.viewDiv.addEventListener('keydown', this.onKeyDown);
        // Track focus changes so the badge reflects Insert mode live.
        this.viewDiv.addEventListener('focusin', this.onFocusChange);
        this.viewDiv.addEventListener('focusout', this.onFocusChange);

        // wheel on the map container (not the view root) so it doesn't fight the
        // controls. Non-passive so we can preventDefault the browser scroll.
        this.mapContainerEl = host.display.map.getContainer();
        this.mapContainerEl.addEventListener('wheel', this.onWheel, {
            passive: false,
        });

        this.createBadge();
    }

    /** True when `settings.modalMapInteraction` is on. */
    private isFeatureEnabled(): boolean {
        return !!this.host.settings?.modalMapInteraction;
    }

    /**
     * True when keyboard/wheel handling should run: feature on, controller
     * enabled (unlocked), and the map not locked.
     */
    private isActive(): boolean {
        return (
            this.enabled && this.isFeatureEnabled() && !this.host.state?.lock
        );
    }

    /**
     * Derive the current mode from live state. Insert wins (a view input has
     * focus), then Edit (`state.editMode`), else Normal.
     */
    computeMode(): MapMode {
        const active =
            typeof document !== 'undefined' ? document.activeElement : null;
        if (isEditableElement(active) && this.viewDiv.contains(active))
            return 'insert';
        if (this.host.state?.editMode) return 'edit';
        return 'normal';
    }

    private zoomStep(): number {
        return this.host.settings?.zoomStep ?? DEFAULT_ZOOM_STEP;
    }

    private zoomStepBig(): number {
        return this.host.settings?.zoomStepBig ?? DEFAULT_ZOOM_STEP_BIG;
    }

    /**
     * Build the {@link ModalActionContext} for a keystroke. `big` (Alt/Meta
     * held) selects the coarser {@link zoomStepBig} for `+`/`-`.
     */
    private buildActionContext(
        shift: boolean,
        big: boolean = false,
    ): ModalActionContext {
        const map = this.host.display.map;
        const zoomStep = big ? this.zoomStepBig() : this.zoomStep();
        return {
            zoomStep,
            shift,
            zoomBy: (delta) => map.setZoom(map.getZoom() + delta),
            pan: (dx, dy, panBig) => {
                const step =
                    PAN_STEP_PX * (panBig ? PAN_STEP_BIG_MULTIPLIER : 1);
                map.panBy([dx * step, dy * step]);
            },
            fit: () => {
                this.host.autoFitMapToMarkers();
            },
            toggleEdit: () => {
                this.host.highLevelSetViewState({
                    editMode: !this.host.state?.editMode,
                });
            },
            focusQuery: () => {
                this.host.display.controls?.focusQueryBox?.();
            },
            // The modal openers live on MapContainer (added alongside the modal
            // components); cast through `any` so this module doesn't hard-depend
            // on them at compile time (mirrors the closePopup idiom below).
            openFilters: () => {
                (this.host as any).openFiltersModal?.();
            },
            openView: () => {
                (this.host as any).openViewModal?.();
            },
            openLayers: () => {
                (this.host as any).openLayersModal?.();
            },
            openPresets: () => {
                (this.host as any).openPresetsModal?.();
            },
            openEdit: () => {
                (this.host as any).openEditModal?.();
            },
            openGoTo: () => {
                (this.host as any).openGoToModal?.();
            },
            toggleControls: () => {
                this.host.display.controls?.toggleControlsVisibility?.();
            },
        };
    }

    private handleKeyDown(e: KeyboardEvent) {
        if (!this.isActive()) return;
        if (e.key === 'Escape') {
            this.handleEscape(e);
            this.refreshBadge();
            return;
        }
        const binding = lookupBinding(this.computeMode(), e.key, e.shiftKey);
        if (binding) {
            e.preventDefault();
            binding.action(
                this.buildActionContext(e.shiftKey, e.altKey || e.metaKey),
            );
        }
        this.refreshBadge();
    }

    private handleEscape(e: KeyboardEvent) {
        const active =
            typeof document !== 'undefined' ? document.activeElement : null;
        const editableInView =
            isEditableElement(active) && this.viewDiv.contains(active);
        const popupOpen = !!this.host.display.popupDiv?.hasClass?.('visible');
        const action = decideEscapeAction({
            activeElementIsEditableInView: editableInView,
            editMode: !!this.host.state?.editMode,
            popupOpen,
        });
        switch (action) {
            case 'blur':
                (active as HTMLElement)?.blur?.();
                break;
            case 'exitEdit':
                this.host.highLevelSetViewState({ editMode: false });
                break;
            case 'closePopup':
                this.closePopup();
                break;
            case 'none':
                return;
        }
        // We consumed the Escape — stop the browser default (e.g. leaving
        // fullscreen) now that a modal step handled it.
        e.preventDefault();
    }

    /** Close the custom hover/pin popup (full cleanup) and any native popup. */
    private closePopup() {
        // closeMarkerPopup is private on MapContainer; call it dynamically so we
        // get its full teardown (unmount + boundary-selection clear) without a
        // compile-time private-access error.
        (this.host as any).closeMarkerPopup?.(true);
        this.host.display.map?.closePopup?.();
    }

    private handleWheel(e: WheelEvent) {
        if (!this.isActive()) return;
        const map = this.host.display.map;
        if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + wheel → zoom by the configured step in scroll direction.
            const direction = e.deltaY < 0 ? 1 : -1;
            map.setZoom(map.getZoom() + direction * this.zoomStep());
            e.preventDefault();
            return;
        }
        // Plain wheel → pan. deltaMode 1 = lines (tilt wheels); scale to pixels,
        // matching the existing horizontal-wheel handler idiom in mapContainer.
        const scale = e.deltaMode === 1 ? 16 : 1;
        map.panBy([e.deltaX * scale, e.deltaY * scale], { animate: false });
        e.preventDefault();
    }

    // --- Badge -------------------------------------------------------------

    private createBadge() {
        // Own absolutely-positioned wrapper appended to the view root; the
        // ModeBadge span is not self-positioned (WU-3 contract).
        const wrapper = this.viewDiv.createDiv('mv-mode-badge-wrapper');
        wrapper.style.position = 'absolute';
        wrapper.style.left = '8px';
        wrapper.style.bottom = '8px';
        wrapper.style.zIndex = '1000';
        wrapper.style.pointerEvents = 'none';
        this.badgeWrapper = wrapper;
        this.refreshBadge();
    }

    /**
     * Mount the badge for `mode`, remounting only when the mode actually
     * changed. Svelte 5 `mount()` props aren't reactive from a plain `.ts`
     * module, so a remount is the clean way to update; mode changes are rare
     * (transitions only), so this is cheap.
     */
    private renderBadge(mode: MapMode) {
        if (mode === this.badgeMode && this.badgeInstance) return;
        if (this.badgeInstance) {
            unmount(this.badgeInstance);
            this.badgeInstance = null;
        }
        if (!this.badgeWrapper) return;
        this.badgeInstance = mount(ModeBadge, {
            target: this.badgeWrapper,
            props: { mode },
        });
        this.badgeMode = mode;
    }

    private updateBadgeVisibility() {
        if (!this.badgeWrapper) return;
        this.badgeWrapper.style.display = this.isFeatureEnabled() ? '' : 'none';
    }

    /** Recompute the mode and update the badge (visibility + label). */
    refreshBadge() {
        if (!this.badgeWrapper) return;
        this.updateBadgeVisibility();
        if (!this.isFeatureEnabled()) return;
        this.renderBadge(this.computeMode());
    }

    // --- Public control surface -------------------------------------------

    /**
     * Focus the map container so keystrokes land on it — but never steal focus
     * from an input (Insert mode). WU-5 sets `tabindex` on this element.
     */
    focus() {
        if (this.computeMode() === 'insert') return;
        const target = this.host.display.map?.getContainer?.();
        target?.focus?.();
    }

    /** Toggle the master enable flag (driven by the lock coupling in WU-5). */
    setEnabled(enabled: boolean) {
        this.enabled = enabled;
        this.refreshBadge();
    }

    /** Remove all listeners, unmount the badge, drop the wrapper. Idempotent. */
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.viewDiv.removeEventListener('keydown', this.onKeyDown);
        this.viewDiv.removeEventListener('focusin', this.onFocusChange);
        this.viewDiv.removeEventListener('focusout', this.onFocusChange);
        this.mapContainerEl?.removeEventListener('wheel', this.onWheel);
        if (this.badgeInstance) {
            unmount(this.badgeInstance);
            this.badgeInstance = null;
        }
        this.badgeWrapper?.remove();
        this.badgeWrapper = null;
    }
}
