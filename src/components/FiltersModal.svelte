<script lang="ts">
    import { App, Platform } from 'obsidian';
    import { onMount, tick } from 'svelte';
    import { type PluginSettings } from '../settings';
    import { MapContainer } from '../mapContainer';
    import MapViewPlugin from '../main';
    import QueryTextField from './QueryTextField.svelte';

    // Small modal that edits this view's query/filter string live. Typing pushes
    // the query straight into the view via `highLevelSetViewState`, which
    // re-renders the map and re-syncs the controls panel. Enter/Escape both close
    // the modal — the filter has already been applied as you typed.

    let { app, plugin, settings, view, close } = $props<{
        app: App;
        plugin: MapViewPlugin;
        settings: PluginSettings;
        view: MapContainer;
        close: () => void;
    }>();

    let query = $state(view.getState().query ?? '');
    let queryError = $state(view.getState().queryError ?? false);

    let queryField = $state();

    onMount(async () => {
        await tick();
        queryField?.focus();
    });

    // Live-apply: push the query into the view whenever it changes, but only when
    // it actually differs, to avoid a feedback loop with state re-syncs.
    $effect(() => {
        if (query !== view.getState().query)
            view.highLevelSetViewState({ query });
    });

    function onKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            close();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
        }
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="mv-filters-modal" onkeydown={onKeydown}>
    <div class="mv-kbd-title">Filter</div>
    <QueryTextField
        bind:this={queryField}
        {plugin}
        {app}
        bind:query
        bind:queryError
    />
    <div class="mv-kbd-hint">
        {#if Platform.isMobile}
            Filters apply as you type
        {:else}
            Enter to close · Esc to cancel
        {/if}
    </div>
</div>

<style>
    .mv-filters-modal {
        min-width: 280px;
    }

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
