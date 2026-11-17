"use client";

import {
    createTreeModel,
    type ItemOf,
    Tree,
    useTreeState,
} from "@fragiola/tree-react";
import { selection } from "@fragiola/tree-react/selection";
import { ChevronRight, UserRound } from "lucide-react";
import { useId, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { type OrgTypes, orgChart } from "../_kit/data";
import * as styles from "./styles";

/** The opt-in features of the model: the selection. */
const features = [selection()] as const;

// The kit's organization chart has `settings.selectionMode: "multiple"`: a click selects one
// person, Ctrl/⌘ + click adds or removes one, Shift + click selects the range from the last one.

export default function MultiSelect() {
    // the app owns the model, so the summary outside the root can read it
    const [model] = useState(() =>
        createTreeModel<OrgTypes, typeof features>(orgChart(), { features }),
    );
    // the selected ids keep their identity until the selection changes: no extra render
    const selectedItemIds = useTreeState<
        OrgTypes,
        readonly string[],
        typeof features
    >((state) => state.selectedItemIds, { model });
    const names = selectedItemIds.map(
        (itemId) => model.get("item-by", { id: itemId })?.label ?? itemId,
    );

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <p
                    role="status"
                    data-testid="selection-count"
                    className={styles.count}
                >
                    {names.length === 0
                        ? "Nobody selected"
                        : `${names.length} selected`}
                </p>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    onClick={() => model.run("tree.select-all", {})}
                >
                    Select all
                </Clickable.Button>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    disabled={names.length === 0}
                    onClick={() => model.run("tree.clear-selection", {})}
                >
                    Clear selection
                </Clickable.Button>
            </div>
            <Tree.Root<OrgTypes>
                model={model}
                aria-label="Organization"
                className={styles.root}
            >
                <Tree.Items<OrgTypes>>
                    {(item) => <PersonItem item={item} />}
                </Tree.Items>
            </Tree.Root>
            <p data-testid="selection-names" className={styles.names}>
                {names.length === 0
                    ? "Ctrl/⌘ + click adds a person, Shift + click selects a range."
                    : names.join(", ")}
            </p>
        </div>
    );
}

function PersonItem({ item }: { item: ItemOf<OrgTypes> }) {
    // the role describes the person; the name alone is the item's accessible name
    const roleId = useId();
    return (
        <Tree.Item
            item={item}
            aria-describedby={roleId}
            className={styles.item}
        >
            <Tree.ItemContent className={styles.row}>
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                <UserRound aria-hidden className={styles.icon} />
                <span className={styles.label}>{item.label}</span>
                <span id={roleId} aria-hidden className={styles.role}>
                    {item.data.role}
                </span>
            </Tree.ItemContent>
            <Tree.Group<OrgTypes>>
                {(child) => <PersonItem item={child} />}
            </Tree.Group>
        </Tree.Item>
    );
}
