// The rows' sizes and offsets, in pixels: pure math, no DOM. Data Grid's axis
// (fragiola/data-grid, packages/core/src/axis/axis.ts) is the precedent: one size for every row
// answers in O(1) and allocates nothing, whatever the count. Sizes per row (a size function, or
// estimates refined by measured rows) are a Fenwick tree over one Float64Array: built in O(n), an
// offset and the row at an offset read in O(log n), and a measured row updates in O(log n) without
// rebuilding anything.

/** The sizes of the visible rows, in render order. */
export interface RowSizes {
    /** how many rows */
    readonly count: number;
    /** the sum of every row's size */
    readonly totalSize: number;
    /** where row `index` starts; `offsetOf(count)` is the total size. The index is clamped. */
    offsetOf(index: number): number;
    /** row `index`'s size (0 outside the rows) */
    sizeOf(index: number): number;
    /**
     * The row covering `offset`: the first whose end is past it. Clamped: an offset before the
     * start is row 0, one at or past the end the last row. -1 when there are no rows.
     */
    indexAt(offset: number): number;
}

/** A size in pixels: negative and non-finite sizes count as 0. */
export function cleanSize(size: number): number {
    return Number.isFinite(size) && size > 0 ? size : 0;
}

/** Every row the same size. */
export class FixedSizes implements RowSizes {
    readonly totalSize: number;

    constructor(
        readonly count: number,
        private readonly size: number,
    ) {
        this.totalSize = count * size;
    }

    offsetOf(index: number): number {
        return Math.min(Math.max(Math.floor(index), 0), this.count) * this.size;
    }

    sizeOf(index: number): number {
        return index >= 0 && index < this.count ? this.size : 0;
    }

    indexAt(offset: number): number {
        if (this.count === 0) return -1;
        if (this.size === 0) return 0;
        return Math.min(
            Math.max(Math.floor(offset / this.size), 0),
            this.count - 1,
        );
    }
}

/** A size per row, each one changeable (a measured row). */
export class VariableSizes implements RowSizes {
    readonly count: number;
    private readonly sizes: Float64Array;
    /** tree[i] (1-based): the sum of the sizes of rows (i - lowbit(i), i] */
    private readonly tree: Float64Array;
    /** the highest power of two not above the count (the first step of a search) */
    private readonly top: number;
    private total = 0;

    /** Rows of `sizes` (cleaned), taken over: the array is not copied. */
    constructor(sizes: Float64Array) {
        const count = sizes.length;
        this.count = count;
        this.sizes = sizes;
        const tree = new Float64Array(count + 1);
        for (let i = 1; i <= count; i++) {
            const size = cleanSize(sizes[i - 1] ?? 0);
            sizes[i - 1] = size;
            this.total += size;
            tree[i] = (tree[i] ?? 0) + size;
            const parent = i + (i & -i);
            if (parent <= count)
                tree[parent] = (tree[parent] ?? 0) + (tree[i] ?? 0);
        }
        this.tree = tree;
        let top = 1;
        while (top * 2 <= count) top *= 2;
        this.top = count === 0 ? 0 : top;
    }

    get totalSize(): number {
        return this.total;
    }

    offsetOf(index: number): number {
        let i = Math.min(Math.max(Math.floor(index), 0), this.count);
        if (i === this.count) return this.total;
        let sum = 0;
        for (; i > 0; i -= i & -i) sum += this.tree[i] ?? 0;
        return sum;
    }

    sizeOf(index: number): number {
        return index >= 0 && index < this.count
            ? (this.sizes[Math.floor(index)] ?? 0)
            : 0;
    }

    indexAt(offset: number): number {
        if (this.count === 0) return -1;
        // the most rows whose sizes add up to no more than the offset: the next one covers it
        let position = 0;
        let rest = offset;
        for (let step = this.top; step > 0; step >>= 1) {
            const next = position + step;
            const size = this.tree[next] ?? 0;
            if (next <= this.count && size <= rest) {
                position = next;
                rest -= size;
            }
        }
        return Math.min(position, this.count - 1);
    }

    /** Sets row `index`'s size; returns how much it grew (0 when unchanged or outside). */
    set(index: number, size: number): number {
        if (!(index >= 0 && index < this.count)) return 0;
        const row = Math.floor(index);
        const delta = cleanSize(size) - (this.sizes[row] ?? 0);
        if (delta === 0) return 0;
        this.sizes[row] = (this.sizes[row] ?? 0) + delta;
        this.total += delta;
        for (let i = row + 1; i <= this.count; i += i & -i) {
            this.tree[i] = (this.tree[i] ?? 0) + delta;
        }
        return delta;
    }
}
