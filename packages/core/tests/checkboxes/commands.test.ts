import { describe, expect, it } from "vitest";
import { filesModel } from "../fixture";

const sorted = (ids: readonly string[]) => [...ids].sort();

describe("tri-state checkboxes, cascade mode", () => {
    it("checking a parent checks its loaded descendants", () => {
        const model = filesModel();
        model.run("item.check", { itemId: "src", checked: true });
        expect(sorted(model.state.checkedItemIds)).toEqual(
            sorted(["src", "app", "lib", "utils", "a", "b"]),
        );
        expect(model.get("check-state-by", { itemId: "utils" })).toBe(
            "checked",
        );
        model.run("item.check", { itemId: "src", checked: false });
        expect(model.state.checkedItemIds).toEqual([]);
    });

    it("some children checked make the parent mixed; all of them make it checked", () => {
        const model = filesModel();
        model.run("item.check", { itemId: "a", checked: true });
        expect(model.get("check-state-by", { itemId: "utils" })).toBe("mixed");
        expect(model.get("check-state-by", { itemId: "src" })).toBe("mixed");
        expect(model.is("item-checked", { itemId: "utils" })).toBe(false);
        model.run("item.check", { itemId: "b", checked: true });
        expect(model.get("check-state-by", { itemId: "utils" })).toBe(
            "checked",
        );
        expect(model.get("check-state-by", { itemId: "src" })).toBe("mixed");
        expect(model.get("check-state-by", { itemId: "readme" })).toBe(
            "unchecked",
        );
    });

    it("toggling a mixed parent checks it; toggling a checked one unchecks it", () => {
        const model = filesModel();
        model.run("item.check", { itemId: "a", checked: true });
        expect(model.run("item.toggle-check", { itemId: "utils" })).toEqual({
            ok: true,
            value: { itemId: "utils", checked: true },
        });
        expect(sorted(model.state.checkedItemIds)).toEqual(["a", "b", "utils"]);
        model.run("item.toggle-check", { itemId: "utils" });
        expect(model.state.checkedItemIds).toEqual([]);
    });

    it("an unloaded parent keeps its own state, and its children inherit it when they load", () => {
        const model = filesModel();
        model.run("item.check", { itemId: "lib", checked: true });
        expect(model.get("check-state-by", { itemId: "lib" })).toBe("checked");
        model.run("item.set-children", {
            itemId: "lib",
            items: [
                { id: "x", kind: "file", label: "x.ts", data: { size: 1 } },
                { id: "y", kind: "file", label: "y.ts", data: { size: 1 } },
            ],
        });
        expect(model.is("item-checked", { itemId: "x" })).toBe(true);
        expect(model.is("item-checked", { itemId: "y" })).toBe(true);
        expect(model.get("check-state-by", { itemId: "lib" })).toBe("checked");
    });

    it("children loaded under an unchecked parent stay unchecked, and checking one makes it mixed", () => {
        const model = filesModel();
        model.run("item.set-children", {
            itemId: "lib",
            items: [
                { id: "x", kind: "file", label: "x.ts", data: { size: 1 } },
                { id: "y", kind: "file", label: "y.ts", data: { size: 1 } },
            ],
        });
        expect(model.state.checkedItemIds).toEqual([]);
        model.run("item.check", { itemId: "x", checked: true });
        expect(model.get("check-state-by", { itemId: "lib" })).toBe("mixed");
    });

    it("a structural change recomputes the parents", () => {
        const model = filesModel();
        model.run("item.check", { itemId: "a", checked: true });
        model.run("item.remove", { itemIds: ["b"] });
        expect(model.get("check-state-by", { itemId: "utils" })).toBe(
            "checked",
        );
        model.run("item.add", {
            item: { id: "c", kind: "file", label: "c.ts", data: { size: 1 } },
            to: { parentItemId: "utils" },
        });
        // a new child inherits a checked parent
        expect(model.get("check-state-by", { itemId: "utils" })).toBe(
            "checked",
        );
        model.run("item.move", {
            itemIds: ["readme"],
            to: { parentItemId: "utils", index: 0 },
        });
        expect(model.get("check-state-by", { itemId: "utils" })).toBe("mixed");
    });

    it("refuses a disabled item", () => {
        const model = filesModel();
        model.run("item.set-flags", { itemId: "a", disabled: true });
        expect(
            model.check("item.check", { itemId: "a", checked: true }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
    });

    it("a parent's check leaves a disabled descendant, and what is under it, as it is", () => {
        const model = filesModel({ checkedItemIds: ["a"] });
        model.run("item.set-flags", { itemId: "a", disabled: true });
        model.run("item.check", { itemId: "src", checked: false });
        expect(model.state.checkedItemIds).toEqual(["a"]);
        expect(model.get("check-state-by", { itemId: "utils" })).toBe("mixed");
        model.run("item.set-flags", { itemId: "utils", disabled: true });
        model.run("item.check", { itemId: "src", checked: true });
        expect(sorted(model.state.checkedItemIds)).toEqual(
            sorted(["a", "app", "lib"]),
        );
        expect(model.get("check-state-by", { itemId: "src" })).toBe("mixed");
    });

    it("toggling a parent a disabled child keeps mixed still checks and unchecks the others", () => {
        const model = filesModel();
        model.run("item.set-flags", { itemId: "a", disabled: true });
        expect(model.run("item.toggle-check", { itemId: "utils" })).toEqual({
            ok: true,
            value: { itemId: "utils", checked: true },
        });
        expect(model.state.checkedItemIds).toEqual(["b"]);
        expect(model.get("check-state-by", { itemId: "utils" })).toBe("mixed");
        expect(model.run("item.toggle-check", { itemId: "utils" })).toEqual({
            ok: true,
            value: { itemId: "utils", checked: false },
        });
        expect(model.state.checkedItemIds).toEqual([]);

        const granted = filesModel({ checkedItemIds: ["a"] });
        granted.run("item.set-flags", { itemId: "a", disabled: true });
        granted.run("item.toggle-check", { itemId: "utils" });
        expect(sorted(granted.state.checkedItemIds)).toEqual(
            sorted(["a", "b", "utils"]),
        );
        granted.run("item.toggle-check", { itemId: "utils" });
        expect(granted.state.checkedItemIds).toEqual(["a"]);
    });
});

describe("tri-state checkboxes, independent mode", () => {
    it("checks only the item, and never reports mixed", () => {
        const model = filesModel({ settings: { checkMode: "independent" } });
        model.run("item.check", { itemId: "utils", checked: true });
        expect(model.state.checkedItemIds).toEqual(["utils"]);
        model.run("item.check", { itemId: "a", checked: true });
        model.run("item.check", { itemId: "utils", checked: false });
        expect(model.get("check-state-by", { itemId: "utils" })).toBe(
            "unchecked",
        );
    });

    it("becomes consistent when switched to cascade", () => {
        const model = filesModel({ settings: { checkMode: "independent" } });
        model.run("item.check", { itemId: "a", checked: true });
        model.run("item.check", { itemId: "b", checked: true });
        model.run("tree.configure", { settings: { checkMode: "cascade" } });
        expect(model.is("item-checked", { itemId: "utils" })).toBe(true);
    });
});
