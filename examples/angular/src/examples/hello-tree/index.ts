import { Component } from "@angular/core";
import { TREE, type TreeJson } from "@fragiola/tree-angular";
import { selection } from "@fragiola/tree-angular/selection";
import { LucideChevronRight } from "@lucide/angular";
import * as styles from "./styles";

// What the tree holds: each kind of item and the type of its data.
type Types = { items: { folder: undefined; file: undefined } };

// A tree is JSON: the root items, then every item by its id. A parent lists its children.
const json: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["docs", "notes"],
    items: {
        docs: {
            kind: "folder",
            label: "Documents",
            childItemIds: ["plan", "budget"],
        },
        plan: { kind: "file", label: "Plan.md" },
        budget: { kind: "file", label: "Budget.csv" },
        notes: { kind: "folder", label: "Notes", childItemIds: ["ideas"] },
        ideas: { kind: "file", label: "Ideas.md" },
    },
    expandedItemIds: ["docs"],
};

@Component({
    selector: "example-hello-tree",
    imports: [TREE, LucideChevronRight],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <!-- the root keeps its own model from defaultTree; the name is yours -->
            <div treeRoot [defaultTree]="json" [features]="features" aria-label="Documents" [class]="styles.root">
                <!-- You own the recursion: an item renders its row, then its group, which renders
                     the children with this same template. -->
                <ng-template [treeItems]="json" let-item>
                    <div [treeItem]="item" [class]="styles.item">
                        <div treeItemContent [class]="styles.row">
                            <span treeToggle [class]="styles.toggle">
                                <svg lucideChevronRight aria-hidden="true"></svg>
                            </span>
                            <span [class]="styles.label">{{ item.label }}</span>
                        </div>
                        <div treeGroup></div>
                    </div>
                </ng-template>
            </div>
        </div>
    `,
})
export default class HelloTree {
    /** the opt-in features of the root's model: the selection */
    protected readonly features = [selection()];
    protected readonly styles = styles;
    protected readonly json = json;
}
