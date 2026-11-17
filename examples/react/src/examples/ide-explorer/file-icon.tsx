import {
    type ItemOf,
    type TreeModel,
    useTreeState,
} from "@fragiola/tree-react";
import {
    Braces,
    type File,
    FileCode,
    FileCog,
    FileImage,
    FileKey,
    FileLock,
    FileText,
    FileType,
    Folder,
    FolderCheck,
    FolderCode,
    FolderGit2,
    FolderOpen,
    Package,
} from "lucide-react";
import {
    type FileKind,
    type FolderKind,
    fileKindOf,
    folderKindOf,
    type ProjectTypes,
} from "./project";
import * as styles from "./styles";

const FILE_ICONS: Record<FileKind, typeof File> = {
    code: FileCode,
    data: Braces,
    style: FileType,
    image: FileImage,
    config: FileCog,
    secret: FileKey,
    lock: FileLock,
    text: FileText,
};

const FOLDER_ICONS: Record<FolderKind, typeof File> = {
    plain: Folder,
    source: FolderCode,
    tests: FolderCheck,
    git: FolderGit2,
    managed: Package,
};

/** A file's icon follows what it holds; a plain folder opens with its item, a special one keeps its own. */
export function FileIcon({
    item,
    model,
}: {
    item: ItemOf<ProjectTypes>;
    /** the model, outside the tree (an editor's tab); inside it, the root's */
    model?: TreeModel<ProjectTypes> | undefined;
}) {
    const expanded = useTreeState<ProjectTypes, boolean>(
        (_state, current) => current.is("item-expanded", { itemId: item.id }),
        { model },
    );
    if (item.kind === "folder") {
        const kind = folderKindOf(item.label);
        const Icon =
            kind === "plain" && expanded ? FolderOpen : FOLDER_ICONS[kind];
        return <Icon aria-hidden className={styles.folderIcon[kind]} />;
    }
    const kind = fileKindOf(item.label);
    const Icon = FILE_ICONS[kind];
    return <Icon aria-hidden className={styles.fileIcon[kind]} />;
}
