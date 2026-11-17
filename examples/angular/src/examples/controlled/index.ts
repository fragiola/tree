import { Component, signal } from "@angular/core";
import { TREE } from "@fragiola/tree-angular";
import { LucideChevronRight, LucideFile, LucideFolder } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { SWITCH } from "#/components/ui/switch";
import { fileSystem } from "../_kit/data";
import * as styles from "./styles";

const json = fileSystem();
/** Every folder: what "Expand all" opens. */
const FOLDER_IDS = Object.entries(json.items).flatMap(([id, item]) =>
    item.kind === "folder" ? [id] : [],
);
const labelOf = (itemId: string) => json.items[itemId]?.label ?? itemId;

let nextId = 0;

@Component({
    selector: "example-controlled",
    imports: [
        TREE,
        ClickableButton,
        SWITCH,
        LucideChevronRight,
        LucideFile,
        LucideFolder,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <button kitClickable variant="outline" size="sm" (click)="expandedItemIds.set(folderIds)">
                    Expand all
                </button>
                <button kitClickable variant="outline" size="sm" (click)="changeExpanded([])">
                    Collapse all
                </button>
                <button kitClickable variant="outline" size="sm" (click)="selectedItemIds.set(['readme'])">
                    Select README.md
                </button>
                <button
                    kitClickable
                    variant="outline"
                    size="sm"
                    [disabled]="selectedItemIds().length === 0"
                    (click)="selectedItemIds.set([])"
                >
                    Clear selection
                </button>
                <span [class]="styles.switchField">
                    <button
                        kitSwitch
                        [attr.aria-labelledby]="switchId"
                        [checked]="keepSrcOpen()"
                        (checkedChange)="changeKeepSrcOpen($event)"
                    >
                        <span kitSwitchThumb></span>
                    </button>
                    <span [id]="switchId">Keep src open</span>
                </span>
            </div>
            <div [class]="styles.body">
                <!-- [(selectedItemIds)] binds the selection both ways; the expansion goes through
                     the app's own rule -->
                <div
                    treeRoot
                    [defaultTree]="json"
                    [expandedItemIds]="expandedItemIds()"
                    (expandedItemIdsChange)="changeExpanded($event)"
                    [(selectedItemIds)]="selectedItemIds"
                    aria-label="Project files"
                    [class]="styles.root"
                >
                    <ng-template [treeItems]="json" let-item>
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
                            <div treeGroup></div>
                        </div>
                    </ng-template>
                </div>
                <section aria-label="App state" [class]="styles.state">
                    <h2 [class]="styles.stateTitle">expandedItemIds</h2>
                    <output data-testid="expanded-state" [class]="styles.stateValue">{{
                        stringify(expandedItemIds())
                    }}</output>
                    <h2 [class]="styles.stateTitle">selectedItemIds</h2>
                    <output data-testid="selected-state" [class]="styles.stateValue">{{
                        stringify(selectedItemIds())
                    }}</output>
                    <p [class]="styles.stateNote">
                        @if (selectedItemIds().length === 0) {
                            Nothing selected.
                        } @else {
                            Selected: {{ selectedLabels() }}
                        }
                    </p>
                </section>
            </div>
        </div>
    `,
})
export default class Controlled {
    protected readonly styles = styles;
    protected readonly json = json;
    protected readonly folderIds = FOLDER_IDS;
    protected readonly stringify = JSON.stringify;
    protected readonly switchId = `controlled-switch-${nextId++}`;

    // The app's own state. The tree shows it, and reports every change it would make (a click, a
    // key) through its `…Change` outputs: the app decides what the state becomes.
    protected readonly expandedItemIds = signal<string[]>(["src"]);
    protected readonly selectedItemIds = signal<string[]>([]);
    protected readonly keepSrcOpen = signal(false);

    protected selectedLabels(): string {
        return this.selectedItemIds().map(labelOf).join(", ");
    }

    protected changeExpanded(itemIds: string[]): void {
        // a change the app refuses is reverted: here, "src" can be kept open
        this.expandedItemIds.set(
            this.keepSrcOpen() && !itemIds.includes("src")
                ? ["src", ...itemIds]
                : itemIds,
        );
    }

    protected changeKeepSrcOpen(checked: boolean): void {
        this.keepSrcOpen.set(checked);
        if (checked && !this.expandedItemIds().includes("src")) {
            this.expandedItemIds.set(["src", ...this.expandedItemIds()]);
        }
    }
}
