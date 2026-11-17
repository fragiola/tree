import { Component, effect, signal, viewChild } from "@angular/core";
import {
    type AnnounceEvent,
    createTreeModel,
    type DropTarget,
    injectTreeState,
    TREE,
    type TreeJson,
    type TreeModel,
    TreeRootDirective,
} from "@fragiola/tree-angular";
import { typeAhead } from "@fragiola/tree-angular/type-ahead";
import {
    TreeVirtualItemsDirective,
    virtualization,
} from "@fragiola/tree-angular/virtualization";
import { LucideChevronRight, LucideFile, LucideFolder } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import * as styles from "./styles";

type Types = { items: { folder: undefined; file: undefined } };

const FOLDERS = 1000;
const FILES = 100;

/** 1 000 folders of 100 files each: 101 000 items, every folder expanded. */
function largeTree(): TreeJson<Types> {
    const items: TreeJson<Types>["items"] = {};
    const rootItemIds: string[] = [];
    for (let f = 1; f <= FOLDERS; f++) {
        const folderId = `folder-${f}`;
        const childItemIds: string[] = [];
        for (let i = 1; i <= FILES; i++) {
            const fileId = `${folderId}-file-${i}`;
            childItemIds.push(fileId);
            items[fileId] = { kind: "file", label: `file ${f}.${i}.ts` };
        }
        rootItemIds.push(folderId);
        items[folderId] = {
            kind: "folder",
            label: `module ${f}`,
            childItemIds,
        };
    }
    return { version: 1, rootItemIds, items, expandedItemIds: rootItemIds };
}

// The virtualization feature: the engine renders only the rows in view, plus 10 on each side. Each
// theme sizes the rows, so they are measured (estimated at 28px until then).
const features = [
    virtualization({ estimateRowSize: 28, overscan: 10 }),
    typeAhead(),
] as const;

/** The live region's text for each step of a drag (pointer or keyboard): the package writes none. */
function announcer(model: TreeModel<Types>) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the tree"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const where = (target: DropTarget) =>
        target.position === "inside"
            ? `into ${label(target.itemId)}`
            : `${target.position} ${label(target.itemId)}`;
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "drag-start":
                return event.target
                    ? `Picked up. Drop ${where(event.target)}.`
                    : "Picked up.";
            case "drag-over":
                return event.target
                    ? `Drop ${where(event.target)}.`
                    : undefined;
            case "drop":
                return `Moved ${where(event.target)}.`;
            case "drag-cancel":
                return "Cancelled.";
            default:
                return undefined;
        }
    };
}

@Component({
    selector: "example-large-tree",
    imports: [
        TREE,
        TreeVirtualItemsDirective,
        ClickableButton,
        LucideChevronRight,
        LucideFile,
        LucideFolder,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <button kitClickable variant="outline" size="sm" (click)="model.run('tree.expand-all', {})">
                    Expand all
                </button>
                <button kitClickable variant="outline" size="sm" (click)="model.run('tree.collapse-all', {})">
                    Collapse all
                </button>
                <span [class]="styles.count" data-testid="rendered">
                    {{ rendered().toLocaleString("en") }} of {{ visible().toLocaleString("en") }} rows in the DOM
                </span>
            </div>
            <div
                [treeRoot]="model"
                [indicatorInset]="styles.indicatorInset"
                #tree="treeRoot"
                [announce]="announce"
                aria-label="Large project"
                [class]="styles.root"
            >
                <!-- flat rows: each item carries its level, position and set size; no treeGroup -->
                <ng-template [treeVirtualItems]="model" let-item>
                    <div [treeItem]="item" [class]="styles.item">
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
                        </div>
                    </div>
                </ng-template>
                @if (tree.state().dragging) {
                    <div treeDropIndicator [class]="styles.dropIndicator"></div>
                }
                <div treeLiveRegion [class]="styles.liveRegion"></div>
            </div>
            <p [class]="styles.hint">
                End, Home, PageDown and type-ahead reach any row; drag a row, the tree scrolls near
                its edges.
            </p>
        </div>
    `,
})
export default class LargeTree {
    protected readonly styles = styles;
    // The model is the source of truth: create it once.
    protected readonly model = createTreeModel<Types, typeof features>(
        largeTree(),
        { features },
    );
    protected readonly announce = announcer(this.model);
    protected readonly visible = injectTreeState<Types, number>(
        (_state, model) => model.get("visible-items").length,
        { model: this.model },
    );
    /** how many rows the DOM holds: the engine's window */
    protected readonly rendered = signal(0);
    private readonly root =
        viewChild.required<TreeRootDirective<Types, typeof features>>(
            TreeRootDirective,
        );

    constructor() {
        // the window is read again on a scroll (the engine's listeners) and on a change of the
        // tree (the model's)
        effect((onCleanup) => {
            const { engine } = this.root();
            const read = () =>
                this.rendered.set(
                    engine.get("virtual-window")?.rows.length ?? 0,
                );
            read();
            const stopEngine = engine.subscribe(read);
            const stopModel = this.model.subscribe(read);
            onCleanup(() => {
                stopEngine();
                stopModel();
            });
        });
    }
}
