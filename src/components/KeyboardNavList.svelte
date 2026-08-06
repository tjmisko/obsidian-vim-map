<script lang="ts">
    import { onMount, tick } from 'svelte';
    import { fuzzyMatch } from '../placeSearch';

    // A reusable keyboard-navigable, fuzzy-filtered list for the map's modal
    // keyboard commands (Layers, Presets, Go to, ...). It renders a filter input
    // over a numbered list of rows. Arrows move the highlight; Enter chooses the
    // highlighted row; Escape closes. When `stayOpen` is false the list closes
    // after a choice (selection); when true it stays open (toggling).
    //
    // Digit shortcuts are configurable (`digitShortcuts`): 'plain' means 1-9
    // jump to the Nth visible row and never enter the filter text, 'alt' moves
    // that to Alt+1-9 so plain digits stay typable (place names contain them),
    // and 'none' disables them.

    export type NavItem = {
        /** Stable identity (used for the {#each} key). */
        id: string;
        /** Primary text, also what the fuzzy filter matches against. */
        label: string;
        /** Optional secondary text shown right-aligned. */
        sublabel?: string;
        /** When `showActiveState`, renders an on/off indicator from this. */
        active?: boolean;
        /**
         * Optional group header. A non-selectable header row is rendered above
         * the first visible item of each run of rows sharing a section.
         */
        section?: string;
    };

    export type DigitShortcuts = 'plain' | 'alt' | 'none';

    let {
        items,
        placeholder = 'Type to filter…',
        stayOpen = false,
        showActiveState = false,
        emptyText = 'No matches',
        digitShortcuts = 'plain' as DigitShortcuts,
        filterItems = true,
        statusText = '',
        query = $bindable(''),
        onSelect,
        close,
    } = $props<{
        items: NavItem[];
        placeholder?: string;
        stayOpen?: boolean;
        showActiveState?: boolean;
        emptyText?: string;
        /** Where the 1-9 row shortcuts live. Defaults to plain digits. */
        digitShortcuts?: DigitShortcuts;
        /** Set false when the parent already filtered `items` itself. */
        filterItems?: boolean;
        /** Muted line under the rows (e.g. an async search's progress). */
        statusText?: string;
        /** The filter text; bindable so a parent can react to what's typed. */
        query?: string;
        onSelect: (
            item: NavItem,
            index: number,
            event?: KeyboardEvent | MouseEvent,
        ) => void;
        close: () => void;
    }>();

    let highlight = $state(0);
    let inputEl: HTMLInputElement = $state();
    let rowsEl: HTMLElement = $state();

    const filtered = $derived(
        !filterItems || query.trim().length === 0
            ? items
            : items.filter((it) =>
                  fuzzyMatch(
                      query.trim().toLowerCase(),
                      it.label.toLowerCase(),
                  ),
              ),
    );

    // The header text to render above row `i`, or null when it continues the
    // previous row's section.
    function sectionHeaderAt(index: number): string | null {
        const section = filtered[index]?.section;
        if (!section) return null;
        if (index > 0 && filtered[index - 1]?.section === section) return null;
        return section;
    }

    // Keep the highlight index in range as the filtered list shrinks/grows.
    $effect(() => {
        if (highlight > filtered.length - 1)
            highlight = Math.max(0, filtered.length - 1);
    });

    // The rows area scrolls (max-height), so keep the highlighted row visible
    // when the keyboard moves it past either edge.
    $effect(() => {
        highlight;
        const row = rowsEl?.querySelector('.mv-kbd-row.is-highlight');
        (row as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
    });

    onMount(async () => {
        await tick();
        inputEl?.focus();
    });

    function choose(index: number, event?: KeyboardEvent | MouseEvent) {
        const item = filtered[index];
        if (!item) return;
        onSelect(item, index, event);
        if (!stayOpen) close();
    }

    /**
     * The 1-9 row this keystroke targets, or null. Matched on `e.code` rather
     * than `e.key` because Alt+digit produces a symbol (not a digit) on macOS
     * and several European layouts.
     */
    function digitShortcutIndex(e: KeyboardEvent): number | null {
        if (digitShortcuts === 'none') return null;
        if (digitShortcuts === 'alt' && !e.altKey) return null;
        if (digitShortcuts === 'plain' && e.altKey) return null;
        const match = /^Digit([1-9])$/.exec(e.code);
        if (match) return parseInt(match[1], 10) - 1;
        // Fall back to `key` for layouts/environments without a usable `code`.
        if (digitShortcuts === 'plain' && /^[1-9]$/.test(e.key))
            return parseInt(e.key, 10) - 1;
        return null;
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            choose(highlight, e);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlight = Math.min(highlight + 1, filtered.length - 1);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlight = Math.max(highlight - 1, 0);
            return;
        }
        const digitIndex = digitShortcutIndex(e);
        if (digitIndex !== null) {
            e.preventDefault();
            if (digitIndex < filtered.length) {
                highlight = digitIndex;
                choose(digitIndex, e);
            }
            return;
        }
    }
</script>

<div class="mv-kbd-list">
    <input
        class="mv-kbd-filter"
        type="text"
        bind:this={inputEl}
        bind:value={query}
        {placeholder}
        onkeydown={onKeydown}
        oninput={() => (highlight = 0)}
        spellcheck="false"
        autocomplete="off"
    />
    <div class="mv-kbd-rows" bind:this={rowsEl}>
        {#if filtered.length === 0}
            <div class="mv-kbd-empty">{emptyText}</div>
        {/if}
        {#each filtered as item, i (item.id)}
            {@const header = sectionHeaderAt(i)}
            {#if header}
                <div class="mv-kbd-section">{header}</div>
            {/if}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div
                class="mv-kbd-row"
                class:is-highlight={i === highlight}
                class:is-active={showActiveState && item.active}
                onclick={(e) => choose(i, e)}
                onmousemove={() => (highlight = i)}
            >
                <span class="mv-kbd-row-num">{i < 9 ? i + 1 : ''}</span>
                {#if showActiveState}
                    <span class="mv-kbd-row-check"
                        >{item.active ? '✓' : ''}</span
                    >
                {/if}
                <span class="mv-kbd-row-label">{item.label}</span>
                {#if item.sublabel}
                    <span class="mv-kbd-row-sub">{item.sublabel}</span>
                {/if}
            </div>
        {/each}
    </div>
    {#if statusText}
        <div class="mv-kbd-status">{statusText}</div>
    {/if}
</div>

<style>
    .mv-kbd-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 280px;
    }

    .mv-kbd-filter {
        width: 100%;
        box-sizing: border-box;
    }

    .mv-kbd-rows {
        display: flex;
        flex-direction: column;
        max-height: 50vh;
        overflow-y: auto;
    }

    .mv-kbd-empty {
        color: var(--text-muted);
        padding: 8px 6px;
        font-size: var(--font-ui-small);
    }

    .mv-kbd-status {
        color: var(--text-muted);
        font-size: var(--font-ui-smaller);
    }

    .mv-kbd-section {
        color: var(--text-faint);
        font-size: var(--font-ui-smaller);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 8px 8px 3px;
    }

    /* No leading gap for the first section header in the list. */
    .mv-kbd-section:first-child {
        padding-top: 2px;
    }

    .mv-kbd-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 8px;
        border-radius: 6px;
        cursor: pointer;
        user-select: none;
    }

    .mv-kbd-row.is-highlight {
        background-color: var(--background-modifier-hover);
    }

    .mv-kbd-row.is-active .mv-kbd-row-label {
        font-weight: 600;
        color: var(--text-normal);
    }

    .mv-kbd-row-num {
        flex: 0 0 auto;
        width: 1.4em;
        text-align: center;
        font-size: var(--font-ui-smaller);
        color: var(--text-faint);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        line-height: 1.4;
    }

    .mv-kbd-row-check {
        flex: 0 0 auto;
        width: 1em;
        text-align: center;
        color: var(--interactive-accent);
    }

    .mv-kbd-row-label {
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .mv-kbd-row-sub {
        flex: 0 0 auto;
        color: var(--text-muted);
        font-size: var(--font-ui-smaller);
    }
</style>
