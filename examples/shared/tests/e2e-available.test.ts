import { describe, expect, it } from "vitest";
import {
    COMPLETE_FRAMEWORKS,
    embedBase,
    frameworkOf,
    skipOrFail,
    skipReason,
} from "../e2e/available.ts";

// The shared e2e suite runs against every framework's embed; a spec that opens an example the
// framework does not have is skipped with this reason, unless the framework ships every example
// (e2e/helpers.ts).
describe("the e2e suite's framework", () => {
    it("comes from EXAMPLES_FRAMEWORK, and a missing or unknown one throws", () => {
        expect(frameworkOf("vue")).toBe("vue");
        expect(() => frameworkOf(undefined)).toThrow(/EXAMPLES_FRAMEWORK/);
        expect(() => frameworkOf("svelte")).toThrow(/react, vue, angular/);
    });

    it("mounts each framework's embed under its own base", () => {
        expect(embedBase("react")).toBe("/tree/embed/react/");
        expect(embedBase("angular")).toBe("/tree/embed/angular/");
    });
});

describe("a spec's examples", () => {
    const available = ["hello-tree", "rtl"];

    it("run when the framework has every one", () => {
        expect(skipReason("vue", available, ["hello-tree"])).toBeUndefined();
        expect(skipReason("vue", available, [])).toBeUndefined();
    });

    it("skip, naming the missing ones, when it lacks some", () => {
        expect(
            skipReason("vue", available, ["rtl", "maximize", "borders"]),
        ).toBe("vue has no maximize, borders example");
    });
});

describe("a complete framework", () => {
    const available = ["hello-tree"];

    it("is React and Vue, until the Angular Epic ports the examples", () => {
        expect(COMPLETE_FRAMEWORKS).toEqual(["react", "vue"]);
    });

    it("fails a spec whose example it lacks, instead of skipping it", () => {
        expect(() => skipOrFail("react", available, ["rtl"])).toThrow(
            /react has no rtl example, but every react example is required/,
        );
        expect(skipOrFail("react", available, ["hello-tree"])).toBeUndefined();
    });

    it("skips for a framework that ships a subset", () => {
        expect(skipOrFail("angular", available, ["rtl"])).toBe(
            "angular has no rtl example",
        );
    });
});
