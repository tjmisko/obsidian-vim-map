<script lang="ts">
    import { App, Notice, Plugin } from 'obsidian';
    import {
        DEBUG_LOG_NOTE_PATH,
        clearDebugLog,
        formatDebugLog,
        writeDebugLogToVault,
    } from '../debugLog';

    // Reads the debug log on a device with no developer console. Everything here
    // is tap-operable: the log is selectable text, and the buttons cover the two
    // ways you'd get it off a phone — the clipboard, or a note you can sync.

    let { app, plugin, close } = $props<{
        app: App;
        plugin: Plugin;
        close: () => void;
    }>();

    // Snapshot on open: the log shouldn't shift under the reader, so this is a
    // plain const rather than $state.
    const text = formatDebugLog(app, plugin);

    async function copyToClipboard() {
        try {
            await navigator.clipboard.writeText(text);
            new Notice('Debug log copied to the clipboard');
        } catch (e) {
            // iOS denies clipboard writes outside a user gesture in some
            // contexts; the textarea is selectable as the fallback.
            new Notice('Could not copy — select the text manually instead');
        }
    }

    async function writeToNote() {
        const ok = await writeDebugLogToVault(app, plugin);
        new Notice(
            ok
                ? `Debug log written to "${DEBUG_LOG_NOTE_PATH}"`
                : 'Could not write the debug log note',
        );
        if (ok) close();
    }

    function clearAndClose() {
        clearDebugLog();
        new Notice('Debug log cleared');
        close();
    }
</script>

<div class="mv-debug-log">
    <div class="mv-debug-log-title">Map View debug log</div>
    <textarea class="mv-debug-log-text" readonly rows="18">{text}</textarea>
    <div class="modal-button-container">
        <button type="button" class="mod-cta" onclick={copyToClipboard}>
            Copy
        </button>
        <button type="button" onclick={writeToNote}> Write to note </button>
        <button type="button" onclick={clearAndClose}> Clear </button>
        <button type="button" onclick={close}> Close </button>
    </div>
</div>

<style>
    .mv-debug-log {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 280px;
    }

    .mv-debug-log-title {
        font-weight: 600;
    }

    .mv-debug-log-text {
        width: 100%;
        box-sizing: border-box;
        font-family: var(--font-monospace);
        font-size: var(--font-ui-smaller);
        /* The stacks are long; let them scroll rather than wrap into soup. */
        white-space: pre;
        overflow: auto;
        resize: vertical;
    }

    /* Buttons wrap rather than overflow a narrow phone modal. */
    .modal-button-container {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
</style>
