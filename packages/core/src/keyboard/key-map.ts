// The tree's keys: the WAI-ARIA APG Tree View keyboard model
// (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/), with React Complex Tree's choices where
// the APG leaves one open (hotkeys/defaultKeyboardBindings.ts: F2 renames, Ctrl+Shift+D starts a
// keyboard drag). An app overrides any binding through the engine's `keyMap` option; adapters
// never hard-code a key.

/** What a key does on the tree. */
export type KeyAction =
    /** the next visible item */
    | "focus-next"
    /** the previous visible item */
    | "focus-previous"
    /** the first visible item */
    | "focus-first"
    /** the last visible item */
    | "focus-last"
    /** expand a collapsed parent, else focus its first child (Right in ltr) */
    | "expand-or-focus-child"
    /** collapse an expanded parent, else focus the parent (Left in ltr) */
    | "collapse-or-focus-parent"
    /** expand the focused item's siblings (`*`) */
    | "expand-siblings"
    /** select the focused item (Enter) */
    | "select"
    /** select (or toggle the selection of) the focused item, or toggle its checkbox when checkboxes are on (Space) */
    | "toggle"
    /** toggle the focused item's selection without moving (Ctrl+Space) */
    | "toggle-selection"
    /** move to the next item and extend the selection to it (Shift+Down) */
    | "extend-next"
    /** move to the previous item and extend the selection to it (Shift+Up) */
    | "extend-previous"
    /** extend the selection from the anchor to the focused item (Shift+Space) */
    | "extend-to-focused"
    /** extend the selection to the first visible item (Ctrl+Shift+Home) */
    | "extend-to-first"
    /** extend the selection to the last visible item (Ctrl+Shift+End) */
    | "extend-to-last"
    /** select every visible item (Ctrl+A) */
    | "select-all"
    /** start renaming the focused item (F2) */
    | "rename"
    /** start a keyboard drag of the selection, or the focused item (Ctrl+Shift+D) */
    | "start-drag";

/**
 * Each action's keys. A key is a `KeyboardEvent.key` value with its modifiers
 * (`"Shift+ArrowDown"`, `"Control+a"`, `"Meta+a"`; `" "` is Space); letters ignore case, and a
 * printable symbol (`"*"`) ignores Shift.
 */
export type KeyMap = { readonly [A in KeyAction]: readonly string[] };

export const DEFAULT_KEY_MAP: KeyMap = Object.freeze({
    "focus-next": ["ArrowDown"],
    "focus-previous": ["ArrowUp"],
    "focus-first": ["Home"],
    "focus-last": ["End"],
    "expand-or-focus-child": ["ArrowRight"],
    "collapse-or-focus-parent": ["ArrowLeft"],
    "expand-siblings": ["*"],
    select: ["Enter"],
    toggle: [" "],
    "toggle-selection": ["Control+ ", "Meta+ "],
    "extend-next": ["Shift+ArrowDown"],
    "extend-previous": ["Shift+ArrowUp"],
    "extend-to-focused": ["Shift+ "],
    "extend-to-first": ["Control+Shift+Home", "Meta+Shift+Home"],
    "extend-to-last": ["Control+Shift+End", "Meta+Shift+End"],
    "select-all": ["Control+a", "Meta+a"],
    rename: ["F2"],
    "start-drag": ["Control+Shift+d", "Meta+Shift+d"],
});

/** What a key handler reads of a keyboard event. */
export interface KeyEventLike {
    readonly key: string;
    readonly shiftKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly altKey: boolean;
}

const MODIFIERS = ["Control", "Meta", "Alt", "Shift"] as const;

interface ParsedKey {
    readonly key: string;
    readonly control: boolean;
    readonly meta: boolean;
    readonly alt: boolean;
    readonly shift: boolean;
}

/** `"Control+Shift+d"` as its key and modifiers (`"+"` alone is the plus key). */
export function parseKey(spec: string): ParsedKey {
    const plus = spec === "+" || spec.endsWith("++");
    const head = plus ? spec.slice(0, -1) : spec;
    const parts = head.split("+");
    const key = plus ? "+" : (parts.at(-1) ?? "");
    const modifiers = new Set(
        (plus ? parts : parts.slice(0, -1)).filter((part) => part !== ""),
    );
    for (const modifier of modifiers) {
        if (!(MODIFIERS as readonly string[]).includes(modifier)) {
            throw new Error(`unknown modifier "${modifier}" in key "${spec}"`);
        }
    }
    return {
        key,
        control: modifiers.has("Control"),
        meta: modifiers.has("Meta"),
        alt: modifiers.has("Alt"),
        shift: modifiers.has("Shift"),
    };
}

/** A printable symbol that is not a letter: typing it may need Shift (`*`). */
function isSymbol(key: string): boolean {
    return (
        key.length === 1 &&
        key !== " " &&
        key.toLowerCase() === key.toUpperCase()
    );
}

/** Whether an event is the key `spec` names, with exactly its modifiers. */
export function matchesKey(event: KeyEventLike, spec: string): boolean {
    const parsed = parseKey(spec);
    const sameKey =
        parsed.key.length === 1
            ? event.key.toLowerCase() === parsed.key.toLowerCase()
            : event.key === parsed.key;
    if (!sameKey) return false;
    const shiftMatters = !isSymbol(parsed.key);
    return (
        event.ctrlKey === parsed.control &&
        event.metaKey === parsed.meta &&
        event.altKey === parsed.alt &&
        (!shiftMatters || event.shiftKey === parsed.shift)
    );
}

/** The action of a key event under `keyMap`, if any. */
export function actionOf(
    keyMap: KeyMap,
    event: KeyEventLike,
): KeyAction | undefined {
    for (const [action, keys] of Object.entries(keyMap) as [
        KeyAction,
        readonly string[],
    ][]) {
        if (keys.some((spec) => matchesKey(event, spec))) return action;
    }
    return undefined;
}

/** The default key map with an app's overrides (an action given `[]` has no key). */
export function resolveKeyMap(overrides: Partial<KeyMap> | undefined): KeyMap {
    return { ...DEFAULT_KEY_MAP, ...overrides };
}

/** Right and Left swap in a right-to-left tree. */
export function directional(key: string, direction: "ltr" | "rtl"): string {
    if (direction !== "rtl") return key;
    if (key === "ArrowRight") return "ArrowLeft";
    if (key === "ArrowLeft") return "ArrowRight";
    return key;
}

/** A key that types a character for type-ahead: one printable character, no Control, Meta or Alt. */
export function isTypeAheadKey(event: KeyEventLike): boolean {
    return (
        event.key.length === 1 &&
        event.key !== " " &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
    );
}
