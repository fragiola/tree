// The IDE's app logic, framework-free: the project's rules as middleware, and the open editors.
// The tree's state stays in the model; the editors are app state that follows it.
import { type TreeModel, veto } from "@fragiola/tree-angular";
import { asyncChildren } from "@fragiola/tree-angular/async-children";
import { dragAndDrop } from "@fragiola/tree-angular/drag-and-drop";
import { rename } from "@fragiola/tree-angular/rename";
import { selection } from "@fragiola/tree-angular/selection";
import { typeAhead } from "@fragiola/tree-angular/type-ahead";
import { ancestorIds, isManaged, type ProjectTypes } from "./project";
import { indicatorInset } from "./styles";

/**
 * The opt-in features of the model: the selection (several files at once), the rename (F2), the
 * lazy node_modules, type-to-find and the drags (a drop line starts at the icon).
 */
export const features = [
    selection(),
    rename(),
    asyncChildren(),
    typeAhead(),
    dragAndDrop({ indicatorInset }),
] as const;

/** The project's model, with its features. */
export type ProjectModel = TreeModel<ProjectTypes, typeof features>;

/**
 * The project's rules, as one middleware: every rename, move and removal (from a key, a drag, a
 * button or a script) passes here first. A refused move never shows as a drop target, since a drag
 * asks `model.can("item.move", …)` for each one.
 */
export function projectRules(model: ProjectModel) {
    const labelTaken = (
        parentItemId: string | null,
        label: string,
        exceptItemId: string,
    ) =>
        (parentItemId === null
            ? model.get("root-items")
            : model.get("child-items-by", { itemId: parentItemId })
        ).some(
            (sibling) =>
                sibling.id !== exceptItemId &&
                sibling.label.toLowerCase() === label.toLowerCase(),
        );
    return model.use((ctx, next) => {
        if (ctx.command === "item.rename") {
            const label = ctx.payload.label.trim();
            if (label === "") return veto("A name cannot be empty.");
            if (label.includes("/")) return veto("A name cannot contain “/”.");
            const parentItemId =
                ctx.get("item-parent-by", { itemId: ctx.payload.itemId })?.id ??
                null;
            if (labelTaken(parentItemId, label, ctx.payload.itemId))
                return veto(`“${label}” already exists here.`);
            // a rewrite: the trimmed label is what gets saved
            ctx.payload = { ...ctx.payload, label };
        }
        if (ctx.command === "item.move") {
            const { parentItemId } = ctx.payload.to;
            // the labels arriving from other folders: taken there, or twice among the moved items
            const arriving = new Set<string>();
            for (const itemId of ctx.payload.itemIds) {
                const label = ctx.get("item-by", { id: itemId })?.label ?? "";
                const from = ctx.get("item-parent-by", { itemId })?.id ?? null;
                if (from === parentItemId) continue;
                if (
                    labelTaken(parentItemId, label, itemId) ||
                    arriving.has(label.toLowerCase())
                )
                    return veto(`“${label}” already exists there.`);
                arriving.add(label.toLowerCase());
            }
        }
        if (
            ctx.command === "item.remove" &&
            ctx.payload.itemIds.some((itemId) => isManaged(model, itemId))
        )
            return veto("node_modules belongs to the package manager.");
        return next();
    });
}

/** The open editors: the files open as tabs, and the one shown. */
export interface Editors {
    readonly openFileIds: readonly string[];
    readonly activeFileId: string | null;
}

/**
 * The open editors over the model: selecting one file in the tree opens it (or shows its tab), and
 * a file removed from the tree closes. Activating a tab selects its file and reveals it in the tree
 * (its folders expanded), through commands.
 */
export function createEditors(model: ProjectModel) {
    let editors: Editors = {
        openFileIds: ["app"],
        activeFileId: "app",
    };
    const listeners = new Set<() => void>();
    const set = (next: Editors) => {
        editors = next;
        for (const listener of listeners) listener();
    };

    let lastSelected = model.state.selectedItemIds;
    const isFile = (itemId: string) =>
        model.get("item-by", { id: itemId })?.kind === "file";

    const sync = () => {
        // a removed file closes its editor
        const openFileIds = editors.openFileIds.filter(isFile);
        let { activeFileId } = editors;
        if (activeFileId !== null && !isFile(activeFileId))
            activeFileId = openFileIds.at(-1) ?? null;
        // a new selection of one file: it is the file shown (an unchanged selection opens
        // nothing, so a closed tab stays closed)
        const selected = model.state.selectedItemIds;
        const changed = selected !== lastSelected;
        lastSelected = selected;
        const only = selected.length === 1 ? selected[0] : undefined;
        if (
            changed &&
            only !== undefined &&
            isFile(only) &&
            only !== activeFileId
        ) {
            activeFileId = only;
            if (!openFileIds.includes(only)) openFileIds.push(only);
        }
        if (
            activeFileId !== editors.activeFileId ||
            openFileIds.join("/") !== editors.openFileIds.join("/")
        )
            set({ openFileIds, activeFileId });
    };
    // the editors follow the model while someone reads them: a view that unmounts and mounts
    // again (React's StrictMode) subscribes again
    let unsubscribe: (() => void) | undefined;

    return {
        get: () => editors,
        subscribe(listener: () => void) {
            if (listeners.size === 0) {
                unsubscribe = model.subscribe(sync);
                sync();
            }
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0) unsubscribe?.();
            };
        },
        /** Shows a file's tab, selects the file and expands the folders around it. */
        activate(fileId: string) {
            reveal(model, fileId);
            set({ ...editors, activeFileId: fileId });
        },
        close(fileId: string) {
            const openFileIds = editors.openFileIds.filter(
                (id) => id !== fileId,
            );
            const index = editors.openFileIds.indexOf(fileId);
            const wasShown = editors.activeFileId === fileId;
            const activeFileId = wasShown
                ? (openFileIds[Math.min(index, openFileIds.length - 1)] ?? null)
                : editors.activeFileId;
            set({ openFileIds, activeFileId });
            // closing the file shown shows the next one, selected in the tree; closing another
            // leaves the tree as it is
            if (wasShown && activeFileId !== null) reveal(model, activeFileId);
        },
    };
}

export type EditorsStore = ReturnType<typeof createEditors>;

/**
 * Selects an item, makes it the tree's tab stop and expands the folders around it, in one step.
 * Scrolling it into view and moving DOM focus are the engine's (`scroll-to`, `focus`).
 */
export function reveal(model: ProjectModel, itemId: string) {
    const collapsed = ancestorIds(model, itemId).filter(
        (id) => !model.is("item-expanded", { itemId: id }),
    );
    return model.run("batch", {
        commands: [
            ...collapsed.map((id) => ({
                command: "item.expand" as const,
                payload: { itemId: id },
            })),
            { command: "item.select", payload: { itemId } },
            { command: "item.focus", payload: { itemId } },
        ],
    });
}
