import { describe, expect, it } from "vitest";
import { FixedSizes, VariableSizes } from "../../src/virtual/sizes";

/** The row covering an offset, the slow way: the first whose end is past it (clamped). */
function naiveIndexAt(sizes: number[], offset: number): number {
    if (sizes.length === 0) return -1;
    let end = 0;
    for (const [i, size] of sizes.entries()) {
        end += size;
        if (end > offset) return i;
    }
    return sizes.length - 1;
}

describe("row sizes", () => {
    it("fixed: offsets, sizes and the row at an offset in O(1)", () => {
        const sizes = new FixedSizes(1000, 20);
        expect(sizes.totalSize).toBe(20_000);
        expect(sizes.offsetOf(3)).toBe(60);
        expect(sizes.offsetOf(5000)).toBe(20_000);
        expect(sizes.offsetOf(-1)).toBe(0);
        expect(sizes.sizeOf(999)).toBe(20);
        expect(sizes.sizeOf(1000)).toBe(0);
        expect(sizes.indexAt(0)).toBe(0);
        expect(sizes.indexAt(19.9)).toBe(0);
        expect(sizes.indexAt(20)).toBe(1);
        expect(sizes.indexAt(1e9)).toBe(999);
        expect(new FixedSizes(0, 20).indexAt(0)).toBe(-1);
    });

    it("variable: agrees with a plain sum, before and after rows change size", () => {
        const plain = Array.from({ length: 257 }, (_, i) => (i % 7) * 3 + 1);
        plain[10] = 0;
        const sizes = new VariableSizes(Float64Array.from(plain));
        const check = () => {
            let offset = 0;
            for (let i = 0; i <= plain.length; i++) {
                expect(sizes.offsetOf(i)).toBe(offset);
                offset += plain[i] ?? 0;
            }
            expect(sizes.totalSize).toBe(offset);
            for (let at = -5; at < offset + 5; at += 0.5) {
                expect(sizes.indexAt(at)).toBe(naiveIndexAt(plain, at));
            }
        };
        check();
        expect(sizes.set(3, 50)).toBe(50 - (plain[3] ?? 0));
        plain[3] = 50;
        expect(sizes.set(200, 0)).toBe(-(plain[200] ?? 0));
        plain[200] = 0;
        expect(sizes.set(9999, 5)).toBe(0);
        expect(sizes.set(4, plain[4] ?? 0)).toBe(0);
        check();
    });

    it("cleans negative and non-finite sizes to 0", () => {
        const sizes = new VariableSizes(
            Float64Array.from([10, -5, Number.NaN, 10]),
        );
        expect(sizes.totalSize).toBe(20);
        expect(sizes.sizeOf(1)).toBe(0);
        expect(sizes.indexAt(10)).toBe(3);
    });
});
