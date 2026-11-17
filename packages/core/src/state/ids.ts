// From Dockable (fragiola/dockable, packages/core/src/state/ids.ts), same author and licence.

/**
 * Generates the id of an item created without one (`item.add`, `item.set-children`). The model
 * skips an id already in use and asks again.
 */
export type CreateId = (kind: "item") => string;

/** How many times a custom generator is asked before the default takes over. */
const ATTEMPTS = 100;

/**
 * The ids of one model. The default generator is deterministic and needs no `crypto`:
 * `` `item-${n}` ``.
 */
export class IdSource {
    private counter = 0;
    private readonly custom: CreateId | undefined;

    constructor(createId?: CreateId) {
        this.custom = createId;
    }

    /** A copy with the same counter: a dry run draws ids from it, leaving this one as it was. */
    clone(): IdSource {
        const copy = new IdSource(this.custom);
        copy.counter = this.counter;
        return copy;
    }

    /** A fresh id, for which `isUsed` is false. */
    next(isUsed: (id: string) => boolean): string {
        if (this.custom) {
            for (let i = 0; i < ATTEMPTS; i++) {
                const id = this.custom("item");
                if (typeof id === "string" && id !== "" && !isUsed(id)) {
                    return id;
                }
            }
        }
        for (;;) {
            this.counter += 1;
            const id = `item-${this.counter}`;
            if (!isUsed(id)) {
                return id;
            }
        }
    }
}
