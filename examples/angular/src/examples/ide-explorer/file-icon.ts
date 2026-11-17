import { Component, computed, input } from "@angular/core";
import type { ItemOf } from "@fragiola/tree-angular";
import {
    LucideBraces,
    LucideFileCode,
    LucideFileCog,
    LucideFileImage,
    LucideFileKey,
    LucideFileLock,
    LucideFileText,
    LucideFileType,
    LucideFolder,
    LucideFolderCheck,
    LucideFolderCode,
    LucideFolderGit2,
    LucideFolderOpen,
    LucidePackage,
} from "@lucide/angular";
import { fileKindOf, folderKindOf, type ProjectTypes } from "./project";
import * as styles from "./styles";

/** A file's icon follows what it holds; a plain folder opens with its item, a special one keeps its own. */
@Component({
    selector: "example-ide-explorer-file-icon",
    imports: [
        LucideBraces,
        LucideFileCode,
        LucideFileCog,
        LucideFileImage,
        LucideFileKey,
        LucideFileLock,
        LucideFileText,
        LucideFileType,
        LucideFolder,
        LucideFolderCheck,
        LucideFolderCode,
        LucideFolderGit2,
        LucideFolderOpen,
        LucidePackage,
    ],
    host: { class: "contents" },
    template: `
        @switch (icon().name) {
            @case ("folder-open") { <svg lucideFolderOpen aria-hidden="true" [class]="icon().class"></svg> }
            @case ("folder") { <svg lucideFolder aria-hidden="true" [class]="icon().class"></svg> }
            @case ("source") { <svg lucideFolderCode aria-hidden="true" [class]="icon().class"></svg> }
            @case ("tests") { <svg lucideFolderCheck aria-hidden="true" [class]="icon().class"></svg> }
            @case ("git") { <svg lucideFolderGit2 aria-hidden="true" [class]="icon().class"></svg> }
            @case ("managed") { <svg lucidePackage aria-hidden="true" [class]="icon().class"></svg> }
            @case ("code") { <svg lucideFileCode aria-hidden="true" [class]="icon().class"></svg> }
            @case ("data") { <svg lucideBraces aria-hidden="true" [class]="icon().class"></svg> }
            @case ("style") { <svg lucideFileType aria-hidden="true" [class]="icon().class"></svg> }
            @case ("image") { <svg lucideFileImage aria-hidden="true" [class]="icon().class"></svg> }
            @case ("config") { <svg lucideFileCog aria-hidden="true" [class]="icon().class"></svg> }
            @case ("secret") { <svg lucideFileKey aria-hidden="true" [class]="icon().class"></svg> }
            @case ("lock") { <svg lucideFileLock aria-hidden="true" [class]="icon().class"></svg> }
            @default { <svg lucideFileText aria-hidden="true" [class]="icon().class"></svg> }
        }
    `,
})
export class FileIcon {
    readonly item = input.required<ItemOf<ProjectTypes>>();
    /** whether the item is expanded: a plain folder's icon opens with it */
    readonly expanded = input(false);

    protected readonly icon = computed(() => {
        const item = this.item();
        if (item.kind === "folder") {
            const kind = folderKindOf(item.label);
            return {
                name:
                    kind === "plain"
                        ? this.expanded()
                            ? "folder-open"
                            : "folder"
                        : kind,
                class: styles.folderIcon[kind],
            };
        }
        const kind = fileKindOf(item.label);
        return { name: kind, class: styles.fileIcon[kind] };
    });
}
