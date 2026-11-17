import { Component } from "@angular/core";
import { TREE, type TreeJson } from "@fragiola/tree-angular";
import { selection } from "@fragiola/tree-angular/selection";
import { LucideChevronRight, LucideFile, LucideFolder } from "@lucide/angular";
import * as styles from "./styles";

type Types = { items: { folder: undefined; file: undefined } };

// A tree in a right-to-left document. Nothing is configured: the engine reads the root's
// direction (`engine.get("direction")`), so Right and Left swap, and the styles use logical
// properties (`ps-*`, `start`/`end`), so the indentation and the chevrons mirror.
const json: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["documents", "photos", "notes"],
    items: {
        documents: {
            kind: "folder",
            label: "المستندات",
            childItemIds: ["reports", "contract"],
        },
        reports: {
            kind: "folder",
            label: "التقارير",
            childItemIds: ["annual", "quarter"],
        },
        annual: { kind: "file", label: "التقرير السنوي.pdf" },
        quarter: { kind: "file", label: "الربع الأول.xlsx" },
        contract: { kind: "file", label: "العقد.docx" },
        photos: { kind: "folder", label: "الصور", childItemIds: ["trip"] },
        trip: { kind: "file", label: "رحلة.jpg" },
        notes: { kind: "file", label: "ملاحظات.txt" },
    },
    expandedItemIds: ["documents", "reports"],
};

@Component({
    selector: "example-rtl",
    imports: [TREE, LucideChevronRight, LucideFile, LucideFolder],
    host: { class: "contents" },
    template: `
        <!-- the direction comes from the document: here a wrapper, in an app often <html dir="rtl"> -->
        <div dir="rtl" lang="ar" [class]="styles.frame">
            <p [class]="styles.hint">
                السهم الأيسر <kbd [class]="styles.kbd">←</kbd> يفتح المجلد،
                والسهم الأيمن <kbd [class]="styles.kbd">→</kbd> يغلقه.
            </p>
            <div treeRoot [defaultTree]="json" [features]="features" aria-label="الملفات" [class]="styles.root">
                <ng-template [treeItems]="json" let-item>
                    <div [treeItem]="item" [class]="styles.item">
                        <div treeItemContent [class]="styles.row">
                            <!-- the chevron points to the inline end: mirrored in rtl (styles.ts) -->
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
        </div>
    `,
})
export default class RightToLeft {
    /** the opt-in features of the root's model: the selection */
    protected readonly features = [selection()];
    protected readonly styles = styles;
    protected readonly json = json;
}
