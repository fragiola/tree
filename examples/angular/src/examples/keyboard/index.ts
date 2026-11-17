import { Component } from "@angular/core";
import {
    type AnnounceEvent,
    createTreeModel,
    type DropTarget,
    TREE,
    type TreeModel,
} from "@fragiola/tree-angular";
import {
    dragAndDrop,
    TreeDropIndicatorDirective,
} from "@fragiola/tree-angular/drag-and-drop";
import { rename, TreeItemRenameDirective } from "@fragiola/tree-angular/rename";
import { selection } from "@fragiola/tree-angular/selection";
import { typeAhead } from "@fragiola/tree-angular/type-ahead";

import { LucideChevronRight, LucideFile, LucideFolder } from "@lucide/angular";
import { type FileTypes, fileSystem } from "../_kit/data";
import * as styles from "./styles";

/** The opt-in features of the model: the selection, the rename (F2), the type-ahead and the drags. */
const features = [
    selection(),
    rename(),
    typeAhead(),
    dragAndDrop({ indicatorInset: styles.indicatorInset }),
] as const;

// Every key is the engine's (the WAI-ARIA APG tree view, `DEFAULT_KEY_MAP`): the example only
// lists them. `[keyMap]` on the root would change any of them.
// `join`: "+" for a chord, "/" for two keys doing the two halves of one line.
const KEYS: readonly {
    keys: readonly string[];
    join?: "+" | "/";
    does: string;
}[] = [
    { keys: ["↓", "↑"], join: "/", does: "Next, previous item" },
    { keys: ["→"], does: "Expand, or go to the first child" },
    { keys: ["←"], does: "Collapse, or go to the parent" },
    { keys: ["Home", "End"], join: "/", does: "First, last item" },
    { keys: ["a–z"], does: "Jump to a label (type-ahead)" },
    { keys: ["*"], does: "Expand the siblings" },
    { keys: ["Enter"], does: "Select" },
    { keys: ["Space"], does: "Toggle the selection" },
    { keys: ["Shift", "↓"], does: "Extend the selection" },
    { keys: ["Ctrl", "A"], does: "Select all" },
    { keys: ["F2"], does: "Rename" },
    {
        keys: ["Ctrl", "Shift", "D"],
        does: "Drag: then ↑ ↓, Enter drops, Esc cancels",
    },
];

/** What the live region says at each step of a keyboard (or pointer) drag. */
function announcer(model: TreeModel<FileTypes>) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the tree"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const names = (itemIds: readonly string[]) => itemIds.map(label).join(", ");
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
    selector: "example-keyboard",
    imports: [
        TREE,
        TreeDropIndicatorDirective,
        TreeItemRenameDirective,
        LucideChevronRight,
        LucideFile,
        LucideFolder,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.treeColumn">
                <div
                    [treeRoot]="model"
                    [announce]="announce"
                    aria-label="Project files"
                    [class]="styles.root"
                >
                    <ng-template [treeItems]="model" let-item>
                        <div [treeItem]="item" #node="treeItem" [class]="styles.item">
                            <div treeItemContent [class]="styles.row">
                                <span treeToggle [class]="styles.toggle">
                                    <svg lucideChevronRight aria-hidden="true"></svg>
                                </span>
                                @if (item.kind === "folder") {
                                    <svg lucideFolder aria-hidden="true" [class]="styles.folderIcon"></svg>
                                } @else {
                                    <svg lucideFile aria-hidden="true" [class]="styles.fileIcon"></svg>
                                }
                                <span [class]="styles.label">{{ item.label }}</span>
                                @if (node.state().renaming) {
                                    <input treeItemRename [attr.aria-label]="'Rename ' + item.label" [class]="styles.input" />
                                }
                            </div>
                            <div treeGroup></div>
                        </div>
                    </ng-template>
                    <div treeDropIndicator [class]="styles.dropIndicator"></div>
                    <!-- visible here, to show what a screen reader hears during a drag -->
                    <div treeLiveRegion [class]="styles.liveRegion"></div>
                </div>
            </div>
            <section [attr.aria-labelledby]="legendId" [class]="styles.legend">
                <h2 [id]="legendId" [class]="styles.legendTitle">Keys</h2>
                <dl [class]="styles.keyList">
                    @for (line of keys; track line.does) {
                        <div [class]="styles.keyRow">
                            <dt [class]="styles.keys">
                                @for (key of line.keys; track key; let first = $first) {@if (!first) {<span aria-hidden="true" [class]="styles.plus">{{ line.join ?? "+" }}</span>}<kbd [class]="styles.kbd">{{ key }}</kbd>}
                            </dt>
                            <dd [class]="styles.does">{{ line.does }}</dd>
                        </div>
                    }
                </dl>
            </section>
        </div>
    `,
})
export default class Keyboard {
    protected readonly styles = styles;
    protected readonly keys = KEYS;
    // The model is the source of truth: create it once.
    protected readonly model = createTreeModel<FileTypes, typeof features>(
        {
            ...fileSystem(),
            settings: { selectionMode: "multiple" },
        },
        { features },
    );
    protected readonly announce = announcer(this.model);
    protected readonly legendId = `keyboard-legend-${nextId++}`;
}
