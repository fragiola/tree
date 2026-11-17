import { Component } from "@angular/core";
import {
    type AnnounceEvent,
    createTreeModel,
    TREE,
    type TreeJson,
} from "@fragiola/tree-angular";
import {
    type SelectionFeature,
    selection,
} from "@fragiola/tree-angular/selection";
import {
    LucideChevronRight,
    LucideFile,
    LucideFolder,
    LucideLoaderCircle,
} from "@lucide/angular";
import { type FileTypes, formatSize } from "../_kit/data";
import { createFakeLoader } from "../_kit/loader";
import { RetryButton } from "./retry-button";
import * as styles from "./styles";

// Only the root folders are in the document: `childrenStatus: "unloaded"` says their children come
// from the app's `loadChildren`, called the first time each one is expanded.
const json: TreeJson<FileTypes> = {
    version: 1,
    rootItemIds: ["photos", "documents", "archive"],
    items: {
        photos: { kind: "folder", label: "Photos", childrenStatus: "unloaded" },
        documents: {
            kind: "folder",
            label: "Documents",
            childrenStatus: "unloaded",
        },
        archive: {
            kind: "folder",
            label: "Archive",
            childrenStatus: "unloaded",
        },
    },
};

let nextId = 0;

@Component({
    selector: "example-async-loading",
    imports: [
        TREE,
        LucideChevronRight,
        LucideFile,
        LucideFolder,
        LucideLoaderCircle,
        RetryButton,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <p [class]="styles.hint">
                Open a folder: its contents come from the server. The first load
                of Documents fails.
            </p>
            <div
                [treeRoot]="model"
                [loadChildren]="loadChildren"
                [announce]="announce"
                expandOnClick
                aria-label="Cloud drive"
                [class]="styles.root"
            >
                <ng-template [treeItems]="model" let-item>
                    <!-- the size describes a file; the label alone is its accessible name -->
                    <div
                        [treeItem]="item"
                        #node="treeItem"
                        [attr.aria-describedby]="item.kind === 'file' ? sizeId(item.id) : null"
                        [class]="styles.item"
                    >
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
                            @if (item.kind === "file") {
                                <span [id]="sizeId(item.id)" aria-hidden="true" [class]="styles.size">
                                    {{ formatSize(item.data.size) }}
                                </span>
                            }
                            <!-- the item says \`aria-busy\` while loading; the spinner is for the eyes -->
                            @if (node.state().loading) {
                                <svg lucideLoaderCircle aria-hidden="true" [class]="styles.spinner"></svg>
                            }
                            @if (node.state().loadError) {
                                <example-async-loading-retry-button />
                            }
                        </div>
                        <div treeGroup></div>
                    </div>
                </ng-template>
                <div treeLiveRegion [class]="styles.liveRegion"></div>
            </div>
        </div>
    `,
})
export default class AsyncLoading {
    protected readonly styles = styles;
    protected readonly formatSize = formatSize;
    protected readonly model = createTreeModel<
        FileTypes,
        readonly [SelectionFeature]
    >(json, { features: [selection()] });
    // an app's loader fetches from its back-end; this fake answers after 500 ms, and fails the
    // first load of "documents"
    protected readonly loadChildren = createFakeLoader({
        latency: 500,
        failOnce: ["documents"],
    });
    // the live region's text: the package writes none. Here, only a failed load is announced
    protected readonly announce = (event: AnnounceEvent) => {
        if (event.type !== "load-error") return undefined;
        const label = this.model.get("item-by", { id: event.itemId })?.label;
        return `Could not load ${label}. Use Retry to try again.`;
    };
    private readonly idPrefix = `async-loading-${nextId++}`;

    protected sizeId(itemId: string): string {
        return `${this.idPrefix}-size-${itemId}`;
    }
}
