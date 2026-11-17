import { Component, computed } from "@angular/core";
import { injectTreeItem } from "@fragiola/tree-angular";
import {
    LucideFile,
    LucideFileCode,
    LucideFileImage,
    LucideFileJson,
    LucideFileText,
    LucideFolder,
    LucideFolderOpen,
} from "@lucide/angular";
import type { FileTypes } from "../_kit/data";
import * as styles from "./styles";

/** A file's icon by its extension. */
const FILE_ICONS: Record<string, "code" | "json" | "text" | "image"> = {
    ts: "code",
    tsx: "code",
    json: "json",
    md: "text",
    txt: "text",
    svg: "image",
};

/** A folder opens with its item; a file's icon follows its extension. */
@Component({
    selector: "example-file-explorer-item-icon",
    imports: [
        LucideFile,
        LucideFileCode,
        LucideFileImage,
        LucideFileJson,
        LucideFileText,
        LucideFolder,
        LucideFolderOpen,
    ],
    host: { class: "contents" },
    template: `
        @switch (icon()) {
            @case ("folder-open") {
                <svg lucideFolderOpen aria-hidden="true" [class]="styles.folderIcon"></svg>
            }
            @case ("folder") {
                <svg lucideFolder aria-hidden="true" [class]="styles.folderIcon"></svg>
            }
            @case ("code") {
                <svg lucideFileCode aria-hidden="true" [class]="styles.fileIcon"></svg>
            }
            @case ("json") {
                <svg lucideFileJson aria-hidden="true" [class]="styles.fileIcon"></svg>
            }
            @case ("text") {
                <svg lucideFileText aria-hidden="true" [class]="styles.fileIcon"></svg>
            }
            @case ("image") {
                <svg lucideFileImage aria-hidden="true" [class]="styles.fileIcon"></svg>
            }
            @default {
                <svg lucideFile aria-hidden="true" [class]="styles.fileIcon"></svg>
            }
        }
    `,
})
export class ItemIcon {
    protected readonly styles = styles;
    // the enclosing [treeItem]'s item and state
    private readonly treeItem = injectTreeItem<FileTypes>();

    protected readonly icon = computed(() => {
        const item = this.treeItem.item();
        if (item.kind === "folder") {
            return this.treeItem.state().expanded ? "folder-open" : "folder";
        }
        return FILE_ICONS[item.label.split(".").pop() ?? ""] ?? "file";
    });
}
