import { describe, expect, it } from "vitest";
import { type CommandEvent, veto } from "../src/public-api";
import { ROW } from "./setup";
import {
    content,
    type FileTypes,
    filesModel,
    fire,
    focus,
    itemElement,
    press,
    renderFiles,
} from "./tree";

/** The y of a fraction of a row's height (the rows are stacked in render order). */
function rowY(label: string, fraction = 0.5): number {
    const rows = [...document.querySelectorAll('[data-tree-part="content"]')];
    const index = rows.indexOf(content(label));
    if (index < 0) throw new Error(`${label} is not rendered`);
    return index * ROW + fraction * ROW;
}

const move = (y: number) =>
    fire(document, "pointermove", {
        clientX: 40,
        clientY: y,
        pointerId: 1,
        isPrimary: true,
    });

async function pressRow(label: string) {
    await fire(content(label), "pointerdown", {
        clientX: 40,
        clientY: rowY(label),
        pointerId: 1,
        isPrimary: true,
        button: 0,
    });
    await move(rowY(label) + 10);
}

const tree = () => document.querySelector('[role="tree"]');
const indicator = () =>
    document.querySelector('[data-tree-part="drop-indicator"]');

async function setup(model = filesModel()) {
    const events: CommandEvent<FileTypes>[] = [];
    model.subscribe((event) => events.push(event));
    await renderFiles({
        model,
        announce: (event) => (event.type === "drop" ? "Moved" : undefined),
    });
    return { model, events };
}

// Angular: the drop indicator is the app's element, there with no drop target and hidden
// (`display: none`) where React and Vue render none
describe("drag and drop", () => {
    it("drags an item with the pointer, shows the target and the indicator, and drops: one item.move", async () => {
        const { model, events } = await setup();
        expect(indicator()).toHaveStyle({ display: "none" });
        await pressRow("readme.md");
        expect(itemElement("readme.md")).toHaveAttribute("data-dragging", "");
        expect(tree()).toHaveAttribute("data-dragging", "");
        // the top of app.ts: before it
        await move(rowY("app.ts", 0.1));
        expect(content("app.ts")).toHaveAttribute("data-drop-target", "");
        expect(content("app.ts")).toHaveAttribute(
            "data-drop-position",
            "before",
        );
        expect(indicator()).toHaveAttribute("data-drop-position", "before");
        expect(indicator()).toHaveAttribute("data-depth", "1");
        expect(indicator()).toHaveAttribute("aria-hidden", "true");
        expect(indicator()).toHaveStyle({ position: "absolute" });
        expect(indicator()).not.toHaveStyle({ display: "none" });
        events.length = 0;
        await fire(document, "pointerup", {
            clientX: 40,
            clientY: rowY("app.ts", 0.1),
            pointerId: 1,
        });
        expect(events.map((event) => event.command)).toEqual(["item.move"]);
        expect(model.get("child-items-by", { itemId: "src" })[0]?.id).toBe(
            "readme",
        );
        expect(indicator()).toHaveStyle({ display: "none" });
        expect(indicator()).not.toHaveAttribute("data-drop-position");
        expect(indicator()).not.toHaveStyle({ position: "absolute" });
        expect(document.querySelector('[role="status"]')).toHaveTextContent(
            "Moved",
        );
        expect(itemElement("readme.md")).toHaveAttribute("aria-level", "2");
    });

    it("hides a target the model refuses (a locked folder)", async () => {
        const model = filesModel();
        model.use((ctx, next) =>
            ctx.command === "item.move" &&
            (ctx.payload as { to: { parentItemId: string | null } }).to
                .parentItemId === "src"
                ? veto("src is locked")
                : next(),
        );
        await setup(model);
        await pressRow("readme.md");
        await move(rowY("app.ts", 0.5));
        expect(indicator()).toHaveStyle({ display: "none" });
        expect(document.querySelector("[data-drop-target]")).toBeNull();
    });

    it("cancels a drag with Escape", async () => {
        const { model, events } = await setup();
        await pressRow("readme.md");
        const root = tree();
        if (!root) throw new Error("no tree");
        await fire(root, "keydown", { key: "Escape" });
        await fire(document, "pointerup", {
            clientX: 40,
            clientY: 0,
            pointerId: 1,
        });
        expect(events.filter((event) => event.command === "item.move")).toEqual(
            [],
        );
        expect(model.state.rootItemIds).toEqual(["src", "readme"]);
        expect(itemElement("readme.md")).not.toHaveAttribute("data-dragging");
    });

    it("drags with the keyboard: start, step through the targets, drop with Enter", async () => {
        const { model } = await setup();
        await focus(itemElement("readme.md"));
        await press("d", { ctrlKey: true, shiftKey: true });
        expect(tree()).toHaveAttribute("data-keyboard-dragging", "");
        await press("ArrowUp");
        expect(document.querySelector("[data-drop-target]")).not.toBeNull();
        await press("Enter");
        expect(model.state.rootItemIds).not.toEqual(["src", "readme"]);
        expect(tree()).not.toHaveAttribute("data-keyboard-dragging");
    });

    it("keeps DOM focus on the dropped item, rendered again in its new group", async () => {
        const { model } = await setup();
        await focus(itemElement("readme.md"));
        await press("d", { ctrlKey: true, shiftKey: true });
        await press("ArrowUp");
        await press("Enter");
        const readme = itemElement("readme.md");
        expect(model.get("item-parent-by", { itemId: "readme" })).toBeDefined();
        expect(readme).toHaveFocus();
    });

    it("starts a drop line past its level by indicatorInset", async () => {
        await renderFiles({ model: filesModel(), indicatorInset: 28 });
        await pressRow("readme.md");
        // the top of app.ts (level 2): a line before it
        await move(rowY("app.ts", 0.1));
        expect(indicator()).toHaveAttribute("data-drop-position", "before");
        expect((indicator() as HTMLElement).style.insetInlineStart).toBe(
            `${16 + 28}px`,
        );
    });
});
