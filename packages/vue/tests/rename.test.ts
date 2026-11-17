import { type CommandError, veto } from "@fragiola/tree";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, type PropType, type VNodeChild } from "vue";
import { type ItemOf, useTree, useTreeItem } from "../src";
import { useTreeItemRename } from "../src/rename";
import {
    type FEATURES,
    type FileTypes,
    filesModel,
    fileTree,
    fire,
    focus,
    itemElement,
    press,
    render,
    settle,
    Tree,
    type,
} from "./tree";

const textbox = () =>
    document.querySelector<HTMLInputElement>('input[aria-label="Name"]');

async function start(model = filesModel()) {
    await render(() => fileTree({ model }));
    await focus(itemElement("app.ts"));
    await press("F2");
    const input = textbox();
    if (!input) throw new Error("no rename input");
    return { model, input };
}

const Editor = defineComponent({
    name: "RenameEditor",
    props: {
        item: { type: Object as PropType<ItemOf<FileTypes>>, required: true },
        onRenameError: {
            type: Function as PropType<(error: CommandError) => void>,
            required: true,
        },
    },
    setup(props) {
        const { state, props: inputProps } = useTreeItemRename(
            () => props.item,
            { onRenameError: (error) => props.onRenameError(error) },
        );
        return (): VNodeChild =>
            state.value.renaming
                ? h("input", {
                      ...inputProps.value,
                      "aria-label": "Name",
                      "data-state": state.value.invalid ? "invalid" : "",
                  })
                : null;
    },
});

/** Renaming by hand: the item's state and the engine's actions, no composable. */
const ManualEditor = defineComponent({
    name: "ManualEditor",
    props: {
        item: { type: Object as PropType<ItemOf<FileTypes>>, required: true },
    },
    setup(props) {
        const { engine } = useTree<FileTypes, typeof FEATURES>();
        const { state } = useTreeItem(() => props.item);
        return (): VNodeChild =>
            state.value.renaming
                ? h("input", {
                      "aria-label": "Name",
                      value: props.item.label,
                      onKeydown: (event: KeyboardEvent) => {
                          const input = event.currentTarget as HTMLInputElement;
                          if (event.key === "Enter")
                              engine.run("commit-rename", {
                                  itemId: props.item.id,
                                  label: input.value,
                              });
                          if (event.key === "Escape")
                              engine.run("cancel-rename", {
                                  itemId: props.item.id,
                              });
                      },
                  })
                : null;
    },
});

describe("inline rename", () => {
    it("starts with the label, focused and selected", async () => {
        const { input } = await start();
        expect(input).toHaveFocus();
        expect(input.value).toBe("app.ts");
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe("app.ts".length);
        // the app's own element: the composable adds no part attribute
        expect(input).not.toHaveAttribute("data-tree-part");
        expect(itemElement("app.ts")).toHaveAttribute("data-renaming", "");
    });

    it("commits on Enter (item.rename) and gives focus back to the item", async () => {
        const { model, input } = await start();
        await type(input, "main.ts");
        await fire(input, "keydown", { key: "Enter" });
        expect(model.get("item-by", { id: "app" })?.label).toBe("main.ts");
        expect(textbox()).toBeNull();
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
        await render(() => [
            h("button", { type: "button" }, "Outside"),
            fileTree({ model }),
        ]);
        await focus(itemElement("app.ts"));
        await press("F2");
        const input = textbox();
        if (!input) throw new Error("no rename input");
        await type(input, "moved.ts");
        const outside = document.querySelector("button");
        if (!outside) throw new Error("no button");
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
        const onRenameError = vi.fn();
        await render(() =>
            h(Tree.Root, { model, "aria-label": "Files" }, () =>
                h(Tree.Items, null, {
                    default: ({ item }: { item: ItemOf<FileTypes> }) => [
                        h(Tree.Item, { item }, () =>
                            h(Tree.ItemContent, null, () => [
                                item.label,
                                h(Editor, { item, onRenameError }),
                            ]),
                        ),
                    ],
                }),
            ),
        );
        const readme = [
            ...document.querySelectorAll<HTMLElement>('[role="treeitem"]'),
        ].find((element) => element.textContent === "readme.md");
        if (!readme) throw new Error("no readme");
        await focus(readme);
        await press("F2");
        const input = textbox();
        if (!input) throw new Error("no rename input");
        await type(input, "app.js");
        await fire(input, "keydown", { key: "Enter" });
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(input).toHaveAttribute("data-invalid", "");
        expect(input).toHaveAttribute("data-state", "invalid");
        expect(onRenameError).toHaveBeenCalledWith(
            expect.objectContaining({ code: "vetoed" }),
        );
        expect(model.get("item-by", { id: "readme" })?.label).toBe("readme.md");
        await type(input, "app2.ts");
        expect(input).not.toHaveAttribute("aria-invalid");
        expect(input).not.toHaveAttribute("data-invalid");
        // leaving it with a refused label cancels
        await type(input, "nope");
        await fire(input, "blur");
        expect(model.state.renamingItemId).toBeNull();
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
        await render(() => fileTree({ model }));
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
        const input = textbox();
        expect(input?.value).toBe("new.ts");
        expect(input).toHaveFocus();
    });
});

describe("renaming by hand", () => {
    async function renderManual(model = filesModel()) {
        await render(() =>
            h(Tree.Root, { model, "aria-label": "Files" }, () =>
                h(Tree.Items, null, {
                    default: ({ item }: { item: ItemOf<FileTypes> }) => [
                        h(Tree.Item, { item }, () =>
                            h(Tree.ItemContent, null, () => [
                                item.label,
                                h(ManualEditor, { item }),
                            ]),
                        ),
                    ],
                }),
            ),
        );
        const readme = [
            ...document.querySelectorAll<HTMLElement>('[role="treeitem"]'),
        ].find((element) => element.textContent === "readme.md");
        if (!readme) throw new Error("no readme");
        await focus(readme);
        await press("F2");
        const input = textbox();
        if (!input) throw new Error("no rename input");
        await focus(input);
        return { model, input };
    }

    const treeItem = (label: string) =>
        [...document.querySelectorAll<HTMLElement>('[role="treeitem"]')].find(
            (element) => element.textContent === label,
        );

    it("commits with commit-rename, and focus goes back to the item", async () => {
        const { model, input } = await renderManual();
        await type(input, "notes.md");
        await fire(input, "keydown", { key: "Enter" });
        expect(model.get("item-by", { id: "readme" })?.label).toBe("notes.md");
        expect(textbox()).toBeNull();
        expect(treeItem("notes.md")).toHaveFocus();
    });

    it("cancels with cancel-rename", async () => {
        const { model, input } = await renderManual();
        await fire(input, "keydown", { key: "Escape" });
        expect(model.state.renamingItemId).toBeNull();
        expect(treeItem("readme.md")).toHaveFocus();
    });
});
