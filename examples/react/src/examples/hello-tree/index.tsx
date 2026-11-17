"use client";

import { type ItemOf, Tree, type TreeJson } from "@fragiola/tree-react";
import { selection } from "@fragiola/tree-react/selection";
import { ChevronRight } from "lucide-react";
import * as styles from "./styles";

/** The opt-in features of the root's model: the selection. */
const features = [selection()];

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

export default function HelloTree() {
    return (
        <div className={styles.frame}>
            {/* the root keeps its own model from `defaultTree`; the name is yours */}
            <Tree.Root<Types>
                defaultTree={json}
                features={features}
                aria-label="Documents"
                className={styles.root}
            >
                <Tree.Items<Types>>{(item) => <Item item={item} />}</Tree.Items>
            </Tree.Root>
        </div>
    );
}

// You own the recursion: an item renders its row, then its group, which renders the children
// with this same component.
function Item({ item }: { item: ItemOf<Types> }) {
    return (
        <Tree.Item item={item} className={styles.item}>
            <Tree.ItemContent className={styles.row}>
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                <span className={styles.label}>{item.label}</span>
            </Tree.ItemContent>
            <Tree.Group<Types>>{(child) => <Item item={child} />}</Tree.Group>
        </Tree.Item>
    );
}
