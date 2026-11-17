import { Component } from "@angular/core";
import { TREE } from "@fragiola/tree-angular";
import { selection } from "@fragiola/tree-angular/selection";
import { LucideChevronRight } from "@lucide/angular";
import { fileSystem, formatSize } from "../_kit/data";
import { ItemIcon } from "./item-icon";
import * as styles from "./styles";

// The kit's file system: folders, and files whose `data` is `{ size }` (typed by `FileTypes`).
const json = fileSystem();

let nextId = 0;

@Component({
    selector: "example-file-explorer",
    imports: [TREE, LucideChevronRight, ItemIcon],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <!-- expandOnClick: a click on a folder's row also opens or closes it -->
            <div
                treeRoot
                [defaultTree]="json" [features]="features"
                expandOnClick
                aria-label="Project files"
                [class]="styles.root"
            >
                <ng-template [treeItems]="json" let-item>
                    <!-- the size is not part of the item's name (its row's text): it describes the item instead -->
                    <div
                        [treeItem]="item"
                        [attr.aria-describedby]="item.kind === 'file' ? sizeId(item.id) : null"
                        [class]="styles.item"
                    >
                        <div treeItemContent [class]="styles.row">
                            <span treeToggle [class]="styles.toggle">
                                <svg lucideChevronRight aria-hidden="true"></svg>
                            </span>
                            <example-file-explorer-item-icon />
                            <span [class]="styles.label">{{ item.label }}</span>
                            @if (item.kind === "file") {
                                <!-- \`item.kind\` narrows \`item.data\` to \`{ size: number }\` -->
                                <span [id]="sizeId(item.id)" aria-hidden="true" [class]="styles.size">
                                    {{ formatSize(item.data.size) }}
                                </span>
                            }
                        </div>
                        <div treeGroup></div>
                    </div>
                </ng-template>
            </div>
        </div>
    `,
})
export default class FileExplorer {
    /** the opt-in features of the root's model: the selection */
    protected readonly features = [selection()];
    protected readonly styles = styles;
    protected readonly json = json;
    protected readonly formatSize = formatSize;
    private readonly idPrefix = `file-explorer-${nextId++}`;

    protected sizeId(itemId: string): string {
        return `${this.idPrefix}-size-${itemId}`;
    }
}
