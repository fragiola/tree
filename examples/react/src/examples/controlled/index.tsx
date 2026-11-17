"use client";

import { type ItemOf, Tree } from "@fragiola/tree-react";
import { selection } from "@fragiola/tree-react/selection";
import { ChevronRight, File, Folder } from "lucide-react";
import { useId, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Switch } from "#/components/ui/switch";
import { type FileTypes, fileSystem } from "../_kit/data";
import * as styles from "./styles";

/** The opt-in features of the model: the selection. */
const features = [selection()] as const;

const json = fileSystem();
/** Every folder: what "Expand all" opens. */
const FOLDER_IDS = Object.entries(json.items).flatMap(([id, item]) =>
    item.kind === "folder" ? [id] : [],
);
const labelOf = (itemId: string) => json.items[itemId]?.label ?? itemId;

export default function Controlled() {
    // The app's own state. The tree shows it, and reports every change it would make (a click, a
    // key) through the callbacks: the app decides what the state becomes.
    const [expandedItemIds, setExpandedItemIds] = useState<string[]>(["src"]);
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
    const [keepSrcOpen, setKeepSrcOpen] = useState(false);
    const switchId = useId();

    const changeExpanded = (itemIds: string[]) =>
        // a change the app refuses is reverted: here, "src" can be kept open
        setExpandedItemIds(
            keepSrcOpen && !itemIds.includes("src")
                ? ["src", ...itemIds]
                : itemIds,
        );

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedItemIds(FOLDER_IDS)}
                >
                    Expand all
                </Clickable.Button>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    onClick={() => changeExpanded([])}
                >
                    Collapse all
                </Clickable.Button>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedItemIds(["readme"])}
                >
                    Select README.md
                </Clickable.Button>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    disabled={selectedItemIds.length === 0}
                    onClick={() => setSelectedItemIds([])}
                >
                    Clear selection
                </Clickable.Button>
                <span className={styles.switchField}>
                    <Switch.Root
                        aria-labelledby={switchId}
                        checked={keepSrcOpen}
                        onCheckedChange={(checked) => {
                            setKeepSrcOpen(checked);
                            if (checked && !expandedItemIds.includes("src")) {
                                setExpandedItemIds(["src", ...expandedItemIds]);
                            }
                        }}
                    >
                        <Switch.Thumb />
                    </Switch.Root>
                    <span id={switchId}>Keep src open</span>
                </span>
            </div>
            <div className={styles.body}>
                <Tree.Root<FileTypes, typeof features>
                    defaultTree={json}
                    features={features}
                    expandedItemIds={expandedItemIds}
                    onExpandedItemIdsChange={changeExpanded}
                    selectedItemIds={selectedItemIds}
                    onSelectedItemIdsChange={setSelectedItemIds}
                    aria-label="Project files"
                    className={styles.root}
                >
                    <Tree.Items<FileTypes>>
                        {(item) => <FileItem item={item} />}
                    </Tree.Items>
                </Tree.Root>
                <section aria-label="App state" className={styles.state}>
                    <h2 className={styles.stateTitle}>expandedItemIds</h2>
                    <output
                        data-testid="expanded-state"
                        className={styles.stateValue}
                    >
                        {JSON.stringify(expandedItemIds)}
                    </output>
                    <h2 className={styles.stateTitle}>selectedItemIds</h2>
                    <output
                        data-testid="selected-state"
                        className={styles.stateValue}
                    >
                        {JSON.stringify(selectedItemIds)}
                    </output>
                    <p className={styles.stateNote}>
                        {selectedItemIds.length === 0
                            ? "Nothing selected."
                            : `Selected: ${selectedItemIds.map(labelOf).join(", ")}`}
                    </p>
                </section>
            </div>
        </div>
    );
}

function FileItem({ item }: { item: ItemOf<FileTypes> }) {
    return (
        <Tree.Item item={item} className={styles.item}>
            <Tree.ItemContent className={styles.row}>
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                {item.kind === "folder" ? (
                    <Folder aria-hidden className={styles.folderIcon} />
                ) : (
                    <File aria-hidden className={styles.fileIcon} />
                )}
                <span className={styles.label}>{item.label}</span>
            </Tree.ItemContent>
            <Tree.Group<FileTypes>>
                {(child) => <FileItem item={child} />}
            </Tree.Group>
        </Tree.Item>
    );
}
