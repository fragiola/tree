// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { FeatureModel } from "../../src/features/types";
import { typeAhead } from "../../src/type-ahead/type-ahead";
import { type Mounted, mount } from "../engine/dom";
import { filesModel } from "../fixture";

let mounted: Mounted | undefined;
afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
});

describe("the type-ahead feature", () => {
    it("moves focus to the next visible item whose label starts with the typed text", () => {
        mounted = mount(filesModel({}, { features: [typeAhead()] }));
        mounted.engine.run("focus", { itemId: "src" });
        expect(mounted.key("r")).toBe(true);
        expect(mounted.model.state.focusedItemId).toBe("readme");
        expect(mounted.model.get("type-ahead-match", { text: "ap" })?.id).toBe(
            "app",
        );
    });

    it("without it: a typed character is left alone, and its key is not there", () => {
        mounted = mount(filesModel({}, { features: [] }));
        mounted.engine.run("focus", { itemId: "src" });
        expect(mounted.key("r")).toBe(false);
        expect(mounted.model.state.focusedItemId).toBe("src");
        expect(
            (mounted.model as unknown as FeatureModel).get("type-ahead-match", {
                text: "r",
            }),
        ).toBeUndefined();
    });
});
