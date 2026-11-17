// Type-ahead (the APG tree's printable characters): the characters typed within `timeout` of each
// other make one search, and the search moves to the next visible item whose label starts with
// it (`model.get("type-ahead-match", …)`). Typing the same character again cycles through the
// items that start with it, as in React Complex Tree's search and the APG's recommendation.
import type { Scheduler } from "../dom/owner";

export class TypeAhead {
    private buffer = "";
    private cancelReset: (() => void) | undefined;

    constructor(
        private readonly scheduler: () => Scheduler,
        private readonly timeout: number,
    ) {}

    /** Adds a typed character; returns the text to search, and whether to cycle past the current item. */
    type(character: string): { text: string; cycle: boolean } {
        this.buffer += character;
        this.cancelReset?.();
        this.cancelReset = this.scheduler().setTimeout(
            () => this.reset(),
            this.timeout,
        );
        const first = this.buffer[0] ?? "";
        const repeated = [...this.buffer].every((char) => char === first);
        // "aaa" cycles through the items starting with "a"; "ab" refines the current search
        return repeated
            ? { text: first, cycle: true }
            : { text: this.buffer, cycle: false };
    }

    /** Whether a search is under way (a Space then extends it instead of selecting). */
    get active(): boolean {
        return this.buffer !== "";
    }

    reset(): void {
        this.buffer = "";
        this.cancelReset?.();
        this.cancelReset = undefined;
    }
}
