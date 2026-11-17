// Angular: every item's rename input is the app's element, there and hidden (`display: none`)
// while its item is not renaming, where React and Vue render none; `renameInput()` is the one
// shown.
import { describe, expect, it } from "vitest";
import { veto } from "../src/public-api";
import {
    filesModel,
    fire,
    focus,
    itemElement,
    press,
    renameInput,
    renderFiles,
    settle,
    type,
} from "./tree";

async function start(model = filesModel()) {
    const view = await renderFiles({ model });
    await focus(itemElement("app.ts"));
    await press("F2");
    const input = renameInput();
    if (!input) throw new Error("no rename input");
    return { model, input, view };
}

describe("inline rename", () => {
    it("hides every rename input while its item is not renaming", async () => {
        await renderFiles({ model: filesModel() });
        const inputs = document.querySelectorAll<HTMLInputElement>(
            'input[data-tree-part="rename-input"]',
        );
        expect(inputs).toHaveLength(5);
        for (const input of inputs) {
            expect(input).toHaveStyle({ display: "none" });
            expect(input).toHaveAttribute("type", "text");
        }
        expect(renameInput()).toBeNull();
    });

    it("starts with the label, focused and selected", async () => {
        const { input } = await start();
        expect(input).toHaveFocus();
        expect(input.value).toBe("app.ts");
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe("app.ts".length);
        expect(input).toHaveAttribute("data-tree-part", "rename-input");
        expect(input).not.toHaveStyle({ display: "none" });
        expect(itemElement("app.ts")).toHaveAttribute("data-renaming", "");
    });

    it("commits on Enter (item.rename) and gives focus back to the item", async () => {
        const { model, input } = await start();
        await type(input, "main.ts");
        await fire(input, "keydown", { key: "Enter" });
        expect(model.get("item-by", { id: "app" })?.label).toBe("main.ts");
        expect(renameInput()).toBeNull();
        expect(input).toHaveStyle({ display: "none" });
        expect(itemElement("main.ts")).toHaveFocus();
    });

    it("runs item.rename once on Enter", async () => {
        const model = filesModel();
        const commands: string[] = [];
        model.subscribe((event) => commands.push(event.command));
        const { input } = await start(model);
        commands.length = 0;
        await type(input, "main.ts");
        await fire(input, "keydown", { key: "Enter" });
        expect(commands).toEqual(["item.rename"]);
    });

    it("leaves focus where it went when a blur commits", async () => {
        const model = filesModel();
        const outside = document.createElement("button");
        outside.type = "button";
        outside.textContent = "Outside";
        document.body.append(outside);
        await renderFiles({ model });
        await focus(itemElement("app.ts"));
        await press("F2");
        const input = renameInput();
        if (!input) throw new Error("no rename input");
        await type(input, "moved.ts");
        await focus(outside);
        expect(model.get("item-by", { id: "app" })?.label).toBe("moved.ts");
        expect(outside).toHaveFocus();
    });

    it("gives focus back to the item when the app ends the rename", async () => {
        const { model } = await start();
        model.run("item.cancel-rename", { itemId: "app" });
        await settle();
        expect(itemElement("app.ts")).toHaveFocus();
    });

    it("cancels on Escape", async () => {
        const { model, input } = await start();
        await type(input, "x");
        await fire(input, "keydown", { key: "Escape" });
        expect(model.get("item-by", { id: "app" })?.label).toBe("app.ts");
        expect(model.state.renamingItemId).toBeNull();
        expect(itemElement("app.ts")).toHaveFocus();
    });

    it("commits on blur", async () => {
        const { model, input } = await start();
        await type(input, "blurred.ts");
        await fire(input, "blur");
        expect(model.get("item-by", { id: "app" })?.label).toBe("blurred.ts");
    });

    it("stays open and invalid when a middleware refuses the label", async () => {
        const model = filesModel();
        model.use((ctx, next) =>
            ctx.command === "item.rename" &&
            !(ctx.payload as { label: string }).label.endsWith(".ts")
                ? veto("a file ends in .ts")
                : next(),
        );
        const view = await renderFiles({ model });
        await focus(itemElement("readme.md"));
        await press("F2");
        const input = renameInput();
        if (!input) throw new Error("no rename input");
        await type(input, "app.js");
        await fire(input, "keydown", { key: "Enter" });
        expect(renameInput()).toBe(input);
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(input).toHaveAttribute("data-invalid", "");
        expect(view.component.renameErrors).toEqual(["vetoed"]);
        expect(model.get("item-by", { id: "readme" })?.label).toBe("readme.md");
        await type(input, "app2.ts");
        expect(input).not.toHaveAttribute("aria-invalid");
        // leaving it with a refused label cancels
        await type(input, "nope");
        await fire(input, "blur");
        expect(model.state.renamingItemId).toBeNull();
    });

    it("refuses an empty label the same way", async () => {
        const { model, input, view } = await start();
        await type(input, "");
        await fire(input, "keydown", { key: "Enter" });
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(view.component.renameErrors).toHaveLength(1);
        expect(model.state.renamingItemId).toBe("app");
    });

    it("does not start a drag or a selection from a press in the input", async () => {
        const { model, input } = await start();
        await fire(input, "pointerdown", { clientX: 5, clientY: 25 });
        await fire(input, "click");
        expect(model.state.selectedItemIds).toEqual([]);
        expect(model.state.renamingItemId).toBe("app");
    });

    it("takes focus when its item is added and renamed at once", async () => {
        const model = filesModel();
        await renderFiles({ model });
        model.run("item.add", {
            item: {
                id: "new",
                kind: "file",
                label: "new.ts",
                data: { size: 0 },
            },
            to: { parentItemId: null, index: 1 },
        });
        model.run("item.start-rename", { itemId: "new" });
        await settle();
        const input = renameInput();
        expect(input?.value).toBe("new.ts");
        expect(input).toHaveFocus();
    });

    it("starts again with the label on a second rename", async () => {
        const { model, input } = await start();
        await type(input, "half");
        await fire(input, "keydown", { key: "Escape" });
        model.run("item.start-rename", { itemId: "app" });
        await settle();
        expect(renameInput()).toBe(input);
        expect(input.value).toBe("app.ts");
        expect(input).toHaveFocus();
    });
});
