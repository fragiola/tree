// The rename editor is the app's own input, rendered while its item renames (`@if`) and wired by
// `[treeItemRename]`; `renameInput()` is the one shown.
import { Component, input } from "@angular/core";
import { describe, expect, it } from "vitest";
import { TreeItemRenameDirective } from "../rename/public-api";
import { TREE, veto } from "../src/public-api";
import {
    filesModel,
    fire,
    focus,
    itemElement,
    press,
    renameInput,
    render,
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
    it("renders no editor while no item renames", async () => {
        await renderFiles({ model: filesModel() });
        expect(document.querySelector("input")).toBeNull();
        expect(renameInput()).toBeNull();
    });

    it("starts with the label, focused and selected", async () => {
        const { input } = await start();
        expect(input).toHaveFocus();
        expect(input.value).toBe("app.ts");
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe("app.ts".length);
        // the app's own element: the directive adds no part attribute, and hides nothing
        expect(input).not.toHaveAttribute("data-tree-part");
        expect(itemElement("app.ts")).toHaveAttribute("data-renaming", "");
    });

    it("commits on Enter (item.rename) and gives focus back to the item", async () => {
        const { model, input } = await start();
        await type(input, "main.ts");
        await fire(input, "keydown", { key: "Enter" });
        expect(model.get("item-by", { id: "app" })?.label).toBe("main.ts");
        expect(renameInput()).toBeNull();
        expect(input.isConnected).toBe(false);
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
        const again = renameInput();
        expect(again).not.toBe(input);
        expect(again?.value).toBe("app.ts");
        expect(again).toHaveFocus();
    });
});

/** The editor's state through `exportAs`, and its `(renameError)`. */
@Component({
    selector: "test-editor",
    imports: [TREE, TreeItemRenameDirective],
    template: `
        <div [treeRoot]="model()" aria-label="Files">
            <ng-template treeItems let-item>
                <div [treeItem]="item" #node="treeItem">
                    <div treeItemContent>
                        <span>{{ item.label }}</span>
                        @if (node.state().renaming) {
                            <input
                                treeItemRename
                                #rename="treeItemRename"
                                aria-label="Name"
                                [attr.data-state]="rename.state().invalid ? 'invalid' : ''"
                                (renameError)="errors.push($event.code)"
                            />
                        }
                    </div>
                </div>
            </ng-template>
        </div>
    `,
})
class Editor {
    readonly model = input(filesModel());
    readonly errors: string[] = [];
}

describe("[treeItemRename]", () => {
    it("exposes the rename's state and reports a refused commit", async () => {
        const model = filesModel();
        const view = await render(Editor, { model });
        await focus(itemElement("readme.md"));
        await press("F2");
        const input = renameInput();
        if (!input) throw new Error("no rename input");
        expect(input).toHaveAttribute("data-state", "");
        await type(input, "");
        await fire(input, "keydown", { key: "Enter" });
        expect(input).toHaveAttribute("data-state", "invalid");
        expect(view.component.errors).toEqual(["invalid_payload"]);
        await type(input, "notes.md");
        expect(input).toHaveAttribute("data-state", "");
        await fire(input, "keydown", { key: "Enter" });
        expect(model.get("item-by", { id: "readme" })?.label).toBe("notes.md");
    });
});

/** Renaming by hand: the item's state and the engine's actions, no `[treeItemRename]`. */
@Component({
    selector: "test-manual",
    imports: [TREE],
    template: `
        <div [treeRoot]="model()" #tree="treeRoot" aria-label="Files">
            <ng-template treeItems let-item>
                <div [treeItem]="item" #node="treeItem">
                    <div treeItemContent>
                        <span>{{ item.label }}</span>
                        @if (node.state().renaming) {
                            <input
                                #field
                                aria-label="Name"
                                [value]="item.label"
                                (keydown.enter)="tree.engine.run('commit-rename', { itemId: item.id, label: field.value })"
                                (keydown.escape)="tree.engine.run('cancel-rename', { itemId: item.id })"
                            />
                        }
                    </div>
                </div>
            </ng-template>
        </div>
    `,
})
class Manual {
    readonly model = input(filesModel());
}

describe("renaming by hand", () => {
    async function renderManual(model = filesModel()) {
        await render(Manual, { model });
        await focus(itemElement("readme.md"));
        await press("F2");
        const input = renameInput();
        if (!input) throw new Error("no rename input");
        await focus(input);
        return { model, input };
    }

    it("commits with commit-rename, and focus goes back to the item", async () => {
        const { model, input } = await renderManual();
        input.value = "notes.md";
        await fire(input, "keydown", { key: "Enter" });
        expect(model.get("item-by", { id: "readme" })?.label).toBe("notes.md");
        expect(renameInput()).toBeNull();
        expect(itemElement("notes.md")).toHaveFocus();
    });

    it("cancels with cancel-rename", async () => {
        const { model, input } = await renderManual();
        await fire(input, "keydown", { key: "Escape" });
        expect(model.state.renamingItemId).toBeNull();
        expect(itemElement("readme.md")).toHaveFocus();
    });
});
