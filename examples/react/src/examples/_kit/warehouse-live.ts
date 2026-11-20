// Demo data for the warehouse control room: a seeded feed of stock movements (picks that take
// units out of a bin, receipts that refill it), ticking a few times a second while it plays. App
// content and app policy, not part of the tree: the feed only says what moved; the example applies
// each tick to its model as commands, and the tree's totals and flags follow.
//
// Seeded (mulberry32, as Data Grid's live market): the same seed gives the same movements. The
// feed pauses while the document is hidden, and an app starts it paused under reduced motion.

/** A seeded random source in [0, 1) (mulberry32): the same seed, the same numbers. */
export function randomSource(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let x = state;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

/** What the feed needs to know about a bin to move stock in or out of it. */
export interface BinStock {
    readonly id: string;
    readonly quantity: number;
    readonly capacity: number;
    readonly minimum: number;
}

/** One stock movement: a pick takes units out of a bin, a receipt puts them in. */
export interface Movement {
    /** increasing, from 1 */
    readonly id: number;
    readonly kind: "pick" | "receipt";
    readonly binId: string;
    /** the change in units: negative for a pick */
    readonly delta: number;
    /** the bin's quantity after it */
    readonly quantity: number;
    /** the simulated clock, in seconds since midnight */
    readonly time: number;
}

/** The simulated clock at the first movement: 08:00:00. */
export const START_TIME = 8 * 3600;

/**
 * The movements of one tick over `bins`: one to three of them, each on a different bin. Picks are
 * the common case (one to nine units, never more than the bin holds); a bin under its minimum is
 * often refilled, and any bin now and then, up to its capacity.
 */
export function movementsOf(
    bins: readonly BinStock[],
    random: () => number,
    next: { id: number; time: number },
): Movement[] {
    const movements: Movement[] = [];
    const count = 1 + Math.floor(random() * 3);
    const used = new Set<string>();
    for (let n = 0; n < count && bins.length > 0; n++) {
        const bin = bins[Math.floor(random() * bins.length)];
        if (!bin || used.has(bin.id)) continue;
        used.add(bin.id);
        const room = bin.capacity - bin.quantity;
        const refill =
            room > 0 &&
            (bin.quantity < bin.minimum ? random() < 0.35 : random() < 0.08);
        let delta: number;
        if (refill) {
            delta = Math.max(1, Math.round(room * (0.5 + random() * 0.5)));
        } else {
            delta = -Math.min(bin.quantity, 1 + Math.floor(random() * 9));
            if (delta === 0) continue;
        }
        next.time += 2 + Math.floor(random() * 9);
        movements.push({
            id: next.id++,
            kind: delta > 0 ? "receipt" : "pick",
            binId: bin.id,
            delta,
            quantity: bin.quantity + delta,
            time: next.time,
        });
    }
    return movements;
}

/** A clock time (seconds since midnight) as `HH:MM:SS`. */
export function formatTime(seconds: number): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    const day = seconds % 86400;
    return `${pad(Math.floor(day / 3600))}:${pad(Math.floor((day % 3600) / 60))}:${pad(day % 60)}`;
}

/** Whether the reader asked for less motion: a live feed then starts paused. */
export function prefersReducedMotion(): boolean {
    return (
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

/** A batch of movements: one tick's. */
export type MovementListener = (movements: readonly Movement[]) => void;

/**
 * The feed of stock movements: while it plays (and the document is visible), every `interval`
 * milliseconds it asks the app for the bins as they are now, makes one tick's movements and tells
 * its listeners. It never changes anything itself.
 */
export interface StockFeed {
    readonly playing: boolean;
    play(): void;
    pause(): void;
    /** one tick now, playing or not (what a test steps with) */
    step(): readonly Movement[];
    subscribe(listener: MovementListener): () => void;
    /** told when the feed starts or stops playing */
    onPlaying(listener: (playing: boolean) => void): () => void;
    /** stops the timer and the visibility listener for good */
    dispose(): void;
}

export function createStockFeed(options: {
    /** the bins as they are now, read on every tick */
    readonly bins: () => readonly BinStock[];
    readonly seed?: number;
    /** milliseconds between ticks */
    readonly interval?: number;
    /** whether it starts playing */
    readonly autoplay?: boolean;
}): StockFeed {
    const random = randomSource(options.seed ?? 7);
    const interval = options.interval ?? 900;
    const listeners = new Set<MovementListener>();
    const playingListeners = new Set<(playing: boolean) => void>();
    const next = { id: 1, time: START_TIME };
    let playing = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const hidden = () =>
        typeof document !== "undefined" &&
        document.visibilityState === "hidden";

    function step() {
        const movements = movementsOf(options.bins(), random, next);
        if (movements.length > 0)
            for (const listener of listeners) listener(movements);
        return movements;
    }
    // the timer runs only while playing and visible: a hidden tab costs nothing
    function sync() {
        const run = playing && !hidden();
        if (run && timer === undefined) timer = setInterval(step, interval);
        if (!run && timer !== undefined) {
            clearInterval(timer);
            timer = undefined;
        }
    }
    function setPlaying(value: boolean) {
        if (playing === value) return;
        playing = value;
        sync();
        for (const listener of playingListeners) listener(playing);
    }
    if (typeof document !== "undefined")
        document.addEventListener("visibilitychange", sync);
    if (options.autoplay ?? true) setPlaying(true);

    return {
        get playing() {
            return playing;
        },
        play: () => setPlaying(true),
        pause: () => setPlaying(false),
        step,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        onPlaying(listener) {
            playingListeners.add(listener);
            return () => playingListeners.delete(listener);
        },
        dispose() {
            playing = false;
            sync();
            if (typeof document !== "undefined")
                document.removeEventListener("visibilitychange", sync);
            listeners.clear();
            playingListeners.clear();
        },
    };
}
