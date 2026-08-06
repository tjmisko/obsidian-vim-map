import { App, Plugin, Platform, apiVersion } from 'obsidian';

/**
 * A tiny logging facility for diagnosing problems on devices with no developer
 * console — Obsidian Mobile, above all.
 *
 * Two properties matter and drive the whole design:
 *
 * 1. **It must survive a plugin that cannot load.** Obsidian shows a bare
 *    "Failed to load plugin" banner and nothing else, so the log is flushed to
 *    a *note in the vault* ({@link DEBUG_LOG_NOTE_PATH}) rather than kept in
 *    memory or hidden in the plugin folder. A note is readable on a phone and
 *    syncs to a machine that does have a console.
 * 2. **It must be cheap enough to leave on.** Entries go to a capped in-memory
 *    ring; the vault is only touched on an explicit command or a load failure.
 *
 * Its limit is worth stating plainly: this can only record failures that happen
 * once the module has been evaluated and `onload()` has begun. If the bundle
 * itself fails to parse, or a top-level `require` throws, nothing here ever runs
 * and the note stays absent — which is itself a diagnosis.
 */

/** Where the flushed log lands. Vault-root, so it's reachable on a phone. */
export const DEBUG_LOG_NOTE_PATH = 'Map View Debug Log.md';

/** Past this, the oldest entries drop, so a long session can't grow unbounded. */
const MAX_ENTRIES = 500;

export type LogLevel = 'info' | 'warn' | 'error';

export type DebugLogEntry = {
    /** `Date.now()` when the entry was recorded. */
    at: number;
    level: LogLevel;
    message: string;
};

const entries: DebugLogEntry[] = [];

/**
 * Record one entry. Also mirrors to the console, which is what you actually
 * read on desktop; the buffer exists for the devices that have no console.
 */
export function logDebug(message: string, level: LogLevel = 'info') {
    entries.push({ at: Date.now(), level, message });
    if (entries.length > MAX_ENTRIES) entries.shift();
    const line = `Map View: ${message}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
}

/**
 * Record a thrown value together with its stack. Separate from
 * {@link logDebug} because the stack is the whole point of the log and must not
 * be lost to a `String(error)` that renders as "[object Object]".
 */
export function logDebugError(context: string, error: unknown) {
    logDebug(`${context}\n${describeThrown(error)}`, 'error');
}

/**
 * Render a thrown value usefully. Anything can be thrown, and the default
 * stringification of a plain object is `[object Object]` — which tells you
 * nothing on the one device where you can't inspect it.
 */
function describeThrown(error: unknown): string {
    if (error instanceof Error)
        return `${error.name}: ${error.message}\n${error.stack ?? '(no stack)'}`;
    if (error !== null && typeof error === 'object') {
        try {
            return JSON.stringify(error);
        } catch {
            // Circular, or a getter that throws.
            return `(unserializable ${Object.prototype.toString.call(error)})`;
        }
    }
    return String(error);
}

/** The entries recorded so far, oldest first. */
export function getDebugLogEntries(): readonly DebugLogEntry[] {
    return entries;
}

export function clearDebugLog() {
    entries.length = 0;
}

/**
 * Everything about the device that could plausibly explain a
 * works-here-but-not-there failure. Read this block first when triaging.
 *
 * `plugin` is optional so the log can still be rendered from a context that
 * doesn't have it (or from a half-constructed plugin during a load failure).
 */
export function describeEnvironment(app: App, plugin?: Plugin): string {
    return [
        `- Obsidian API version: ${apiVersion ?? 'unknown'}`,
        `- Plugin version: ${plugin?.manifest?.version ?? 'unknown'}`,
        `- Platform: mobile=${Platform.isMobile} desktop=${Platform.isDesktop} ios=${Platform.isIosApp} android=${Platform.isAndroidApp}`,
        // The Bases API is version-gated. Calling it on a build that lacks it is
        // exactly the shape of a mobile-only load failure, so record its presence.
        `- registerBasesView available: ${typeof (plugin as any)?.registerBasesView === 'function'}`,
        `- Vault: ${app?.vault?.getName?.() ?? 'unknown'}`,
    ].join('\n');
}

/** Render the whole log as a markdown document. */
export function formatDebugLog(app: App, plugin?: Plugin): string {
    const body =
        entries.length === 0
            ? '(no entries)'
            : entries
                  .map(
                      (entry) =>
                          `${new Date(entry.at).toISOString()} [${entry.level}] ${entry.message}`,
                  )
                  .join('\n');
    return [
        '# Map View debug log',
        '',
        `Written ${new Date().toISOString()}.`,
        '',
        '## Environment',
        '',
        describeEnvironment(app, plugin),
        '',
        '## Entries',
        '',
        '```',
        body,
        '```',
        '',
    ].join('\n');
}

/**
 * Flush the log to {@link DEBUG_LOG_NOTE_PATH}, overwriting any previous one.
 *
 * Best-effort by contract: this runs from a failure path, so it must never
 * throw and mask the original error. Returns whether the write succeeded.
 */
export async function writeDebugLogToVault(
    app: App,
    plugin?: Plugin,
): Promise<boolean> {
    try {
        await app.vault.adapter.write(
            DEBUG_LOG_NOTE_PATH,
            formatDebugLog(app, plugin),
        );
        return true;
    } catch (e) {
        console.error('Map View: could not write the debug log note', e);
        return false;
    }
}
