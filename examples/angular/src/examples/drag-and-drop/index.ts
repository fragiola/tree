import { Component } from "@angular/core";
import {
    type AnnounceEvent,
    createTreeModel,
    type DropTarget,
    TREE,
    type TreeJson,
    type TreeModel,
} from "@fragiola/tree-angular";
import {
    LucideChevronRight,
    LucideFile,
    LucideFolder,
    LucideFolderLock,
    LucideGripVertical,
    LucideLock,
} from "@lucide/angular";
import * as styles from "./styles";

type Types = { items: { folder: undefined; file: undefined } };

// The permission flags are part of the document, and the commands enforce them: `movable: false`
// keeps an item in place, `droppable: false` keeps a folder closed to drops. A drag asks
// `model.can("item.move", …)` for every target, so a refused one never shows.
const json: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["src", "docs", "vendor", "license", "readme"],
    items: {
        src: {
            kind: "folder",
            label: "src",
            childItemIds: ["app", "main", "routes"],
        },
        app: { kind: "file", label: "app.tsx" },
        main: { kind: "file", label: "main.tsx" },
        routes: { kind: "folder", label: "routes", childItemIds: ["home"] },
        home: { kind: "file", label: "home.tsx" },
        docs: { kind: "folder", label: "docs", childItemIds: ["guide", "api"] },
        guide: { kind: "file", label: "guide.md" },
        api: { kind: "file", label: "api.md" },
        vendor: {
            kind: "folder",
            label: "vendor",
            droppable: false,
            childItemIds: ["polyfill"],
        },
        polyfill: { kind: "file", label: "polyfill.js", movable: false },
        license: { kind: "file", label: "LICENSE", movable: false },
        readme: { kind: "file", label: "README.md" },
    },
    expandedItemIds: ["src", "docs", "vendor"],
};

/** The live region's text for each step of a drag (pointer or keyboard): the package writes none. */
function announcer(model: TreeModel<Types>) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the tree"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const names = (itemIds: readonly string[]) =>
        itemIds.map((itemId) => label(itemId)).join(", ");
    const where = (target: DropTarget) =>
        target.position === "inside"
            ? `into ${label(target.itemId)}`
            : `${target.position} ${label(target.itemId)}`;
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "drag-start":
                // a keyboard drag's start comes with its first place, said in one message
                return event.target
                    ? `Picked up ${names(event.itemIds)}. Up and Down choose a place, Enter drops, Escape cancels. Drop ${where(event.target)}.`
                    : `Picked up ${names(event.itemIds)}.`;
            case "drag-over":
                return event.target
                    ? `Drop ${where(event.target)}.`
                    : "No place to drop here.";
            case "drop":
                return `Moved ${names(event.itemIds)} ${where(event.target)}.`;
            case "drag-cancel":
                return `Cancelled. ${names(event.itemIds)} stayed in place.`;
            default:
                return undefined;
        }
    };
}

let nextId = 0;

@Component({
    selector: "example-drag-and-drop",
    imports: [
        TREE,
        LucideChevronRight,
        LucideFile,
        LucideFolder,
        LucideFolderLock,
        LucideGripVertical,
        LucideLock,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div
                [treeRoot]="model" [indicatorInset]="styles.indicatorInset"
                #tree="treeRoot"
                [announce]="announce"
                aria-label="Project files"
                [class]="styles.root"
            >
                <ng-template [treeItems]="model" let-item>
                    <div
                        [treeItem]="item"
                        [attr.aria-describedby]="
                            item.movable === false || item.droppable === false ? lockedId : null
                        "
                        [class]="styles.item"
                    >
                        <div treeItemContent [class]="styles.row">
                            <svg lucideGripVertical aria-hidden="true" [class]="styles.grip"></svg>
                            <span treeToggle [class]="styles.toggle">
                                <svg lucideChevronRight aria-hidden="true"></svg>
                            </span>
                            @if (item.kind === "folder") {
                                @if (item.droppable === false) {
                                    <svg lucideFolderLock aria-hidden="true" [class]="styles.folderIcon"></svg>
                                } @else {
                                    <svg lucideFolder aria-hidden="true" [class]="styles.folderIcon"></svg>
                                }
                            } @else {
                                <svg lucideFile aria-hidden="true" [class]="styles.fileIcon"></svg>
                            }
                            <span [class]="styles.label">{{ item.label }}</span>
                            @if (item.movable === false) {
                                <svg lucideLock aria-hidden="true" [class]="styles.lock"></svg>
                            }
                        </div>
                        <div treeGroup></div>
                    </div>
                </ng-template>
                <!-- where the drop lands: a line before or after a row, or the box of a folder,
                     there while a drag is under way -->
                @if (tree.state().dragging) {
                    <div treeDropIndicator [class]="styles.dropIndicator"></div>
                }
                <div treeLiveRegion [class]="styles.liveRegion"></div>
            </div>
            <span [id]="lockedId" hidden>Locked</span>
            <p [class]="styles.hint">
                Drag a row to reorder it or move it into a folder.
                <svg lucideLock aria-hidden="true" [class]="styles.hintIcon"></svg> items stay in
                place; nothing can be dropped into vendor.
            </p>
        </div>
    `,
})
export default class DragAndDrop {
    protected readonly styles = styles;
    // The model is the source of truth: create it once.
    protected readonly model = createTreeModel<Types>(json);
    protected readonly announce = announcer(this.model);
    /** one description for every locked item, referenced by id (hidden, still read) */
    protected readonly lockedId = `drag-and-drop-locked-${nextId++}`;
}
