import { describe, it, expect, beforeEach } from 'vitest';
import {
    clearDebugLog,
    formatDebugLog,
    getDebugLogEntries,
    logDebug,
    logDebugError,
} from 'src/debugLog';
import { App } from 'obsidian';

/** The log mirrors to the console; that's noise here but harmless. */
const app = new App();

describe('logDebug', () => {
    beforeEach(() => clearDebugLog());

    it('should record a message with its level', () => {
        logDebug('hello');
        logDebug('careful', 'warn');
        const entries = getDebugLogEntries();
        expect(entries).toHaveLength(2);
        expect(entries[0].message).toBe('hello');
        expect(entries[0].level).toBe('info');
        expect(entries[1].level).toBe('warn');
    });

    it('should drop the oldest entries once the cap is reached', () => {
        // The cap is 500; overshoot it and check the window slid forward.
        for (let i = 0; i < 520; i++) logDebug(`entry ${i}`);
        const entries = getDebugLogEntries();
        expect(entries).toHaveLength(500);
        expect(entries[0].message).toBe('entry 20');
        expect(entries[entries.length - 1].message).toBe('entry 519');
    });
});

describe('logDebugError', () => {
    beforeEach(() => clearDebugLog());

    it('should record the error name, message and stack', () => {
        const error = new Error('boom');
        logDebugError('onload: FAILED', error);
        const entry = getDebugLogEntries()[0];
        expect(entry.level).toBe('error');
        expect(entry.message).toContain('onload: FAILED');
        expect(entry.message).toContain('Error: boom');
        expect(entry.message).toContain(error.stack!);
    });

    it('should serialize a thrown object rather than logging [object Object]', () => {
        logDebugError('context', { code: 42, reason: 'nope' });
        const message = getDebugLogEntries()[0].message;
        expect(message).toContain('context');
        expect(message).toContain('"code":42');
        expect(message).toContain('"reason":"nope"');
        expect(message).not.toContain('[object Object]');
    });

    it('should describe a circular thrown object instead of throwing itself', () => {
        const circular: any = { self: null };
        circular.self = circular;
        expect(() => logDebugError('context', circular)).not.toThrow();
        expect(getDebugLogEntries()[0].message).toContain('unserializable');
    });

    it('should record a thrown string as-is', () => {
        logDebugError('context', 'plain failure');
        expect(getDebugLogEntries()[0].message).toContain('plain failure');
    });

    it('should note a missing stack rather than printing undefined', () => {
        const error = new Error('no stack here');
        error.stack = undefined;
        logDebugError('context', error);
        expect(getDebugLogEntries()[0].message).toContain('(no stack)');
    });
});

describe('formatDebugLog', () => {
    beforeEach(() => clearDebugLog());

    it('should include the environment section and the entries', () => {
        logDebug('phase: settings');
        const text = formatDebugLog(app);
        expect(text).toContain('## Environment');
        expect(text).toContain('## Entries');
        expect(text).toContain('phase: settings');
    });

    it('should render an empty log without entries as no entries', () => {
        expect(formatDebugLog(app)).toContain('(no entries)');
    });
});
