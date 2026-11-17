import { describe, expect, it } from "vitest";
import { filesModel } from "../fixture";

describe("inline rename", () => {
    it("starts, commits the label and ends renaming", () => {
        const model = filesModel();
        model.run("item.start-rename", { itemId: "app" });
        expect(model.is("item-renaming", { itemId: "app" })).toBe(true);
        expect(
            model.run("item.rename", { itemId: "app", label: "main.ts" }),
        ).toEqual({ ok: true, value: { itemId: "app" } });
        expect(model.get("item-by", { id: "app" })?.label).toBe("main.ts");
        expect(model.state.renamingItemId).toBeNull();
    });

    it("cancels without changing the label; only the renaming item can cancel", () => {
        const model = filesModel();
        expect(
            model.check("item.cancel-rename", { itemId: "app" }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        model.run("item.start-rename", { itemId: "app" });
        model.run("item.cancel-rename", { itemId: "app" });
        expect(model.state.renamingItemId).toBeNull();
        expect(model.get("item-by", { id: "app" })?.label).toBe("app.ts");
    });

    it("starting another rename stops the first", () => {
        const model = filesModel();
        model.run("item.start-rename", { itemId: "app" });
        model.run("item.start-rename", { itemId: "readme" });
        expect(model.state.renamingItemId).toBe("readme");
    });

    it("refuses an item that is not renamable or disabled, and an empty label", () => {
        const model = filesModel({ settings: { renamable: false } });
        expect(
            model.check("item.start-rename", { itemId: "app" }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/itemId" },
        });
        model.run("item.set-flags", { itemId: "app", renamable: true });
        expect(model.can("item.start-rename", { itemId: "app" })).toBe(true);
        model.run("item.set-flags", { itemId: "app", disabled: true });
        expect(
            model.check("item.rename", { itemId: "app", label: "x" }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
        expect(
            model.check("item.rename", { itemId: "readme", label: "" }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/label" },
        });
    });

    it("an item that stops being renamable stops renaming", () => {
        const model = filesModel();
        model.run("item.start-rename", { itemId: "app" });
        model.run("item.set-flags", { itemId: "app", renamable: false });
        expect(model.state.renamingItemId).toBeNull();
    });
});
