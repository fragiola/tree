"use client";

import {
    type AnnounceEvent,
    createTreeModel,
    type DropTarget,
    type ItemOf,
    Tree,
    type TreeJson,
    type TreeModel,
} from "@fragiola/tree-react";
import { DropIndicator, dragAndDrop } from "@fragiola/tree-react/drag-and-drop";
import { dragGroup } from "@fragiola/tree-react/drag-group";
import { selection } from "@fragiola/tree-react/selection";
import { ChevronRight, Folder, GripVertical, Leaf } from "lucide-react";
import { useId, useState } from "react";
import { Switch } from "#/components/ui/switch";
import * as styles from "./styles";

/**
 * The opt-in features of the models: the selection, the drags, and the "lists" drag group (the
 * trees of the document whose models have it share their drags).
 */
const features = [
    selection(),
    dragAndDrop({ indicatorInset: styles.indicatorInset }),
    dragGroup({ name: "lists" }),
] as const;

type Types = { items: { group: undefined; produce: undefined } };

// Two trees in one drag group (`dragGroup`): items drag between them with the pointer, or with the
// keyboard (Ctrl+Shift+D, then Down past the last place of one list reaches the other). Over two
// models a drop is a transfer: the target model adds the dragged subtrees (`item.add`), the source
// model removes them (`item.remove`), each through its own middleware. Over one shared model it is
// one `item.move`.
const available: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["fruit", "vegetables", "herbs"],
    items: {
        fruit: {
            kind: "group",
            label: "Fruit",
            childItemIds: ["apple", "banana", "cherry"],
        },
        apple: { kind: "produce", label: "Apple" },
        banana: { kind: "produce", label: "Banana" },
        cherry: { kind: "produce", label: "Cherry" },
        vegetables: {
            kind: "group",
            label: "Vegetables",
            childItemIds: ["carrot", "leek"],
        },
        carrot: { kind: "produce", label: "Carrot" },
        leek: { kind: "produce", label: "Leek" },
        herbs: {
            kind: "group",
            label: "Herbs",
            childItemIds: ["basil", "mint"],
        },
        basil: { kind: "produce", label: "Basil" },
        mint: { kind: "produce", label: "Mint" },
    },
    expandedItemIds: ["fruit", "vegetables", "herbs"],
};

const selected: TreeJson<Types> = { version: 1, rootItemIds: [], items: {} };

/** The live region's text for each step of a drag, naming the list a target is in. */
function announcer(model: TreeModel<Types>, list: string) {
    return (event: AnnounceEvent): string | undefined => {
        // a target in the other list comes with its tree: its model and its root (its name)
        const other = "targetTree" in event ? event.targetTree : undefined;
        const into = other?.model ?? model;
        const listName = other?.root.getAttribute("aria-label") ?? list;
        // the labels are read from either model's items
        const label = (
            itemId: string | null,
            from: TreeModel<Types> | TreeModel = into,
        ) =>
            itemId === null
                ? listName
                : (from.state.items[itemId]?.label ?? itemId);
        const names = (
            itemIds: readonly string[],
            from: TreeModel<Types> | TreeModel = model,
        ) => itemIds.map((itemId) => label(itemId, from)).join(", ");
        const where = (target: DropTarget) =>
            target.itemId === null
                ? `into ${listName}`
                : target.position === "inside"
                  ? `into ${label(target.itemId)} in ${listName}`
                  : `${target.position} ${label(target.itemId)} in ${listName}`;
        switch (event.type) {
            case "drag-start":
                return event.target
                    ? `Picked up ${names(event.itemIds)}. Up and Down choose a place, in either list; Enter drops, Escape cancels. Drop ${where(event.target)}.`
                    : `Picked up ${names(event.itemIds)}.`;
            case "drag-over":
                return event.target
                    ? `Drop ${where(event.target)}.`
                    : "No place to drop here.";
            case "drop":
                // the moved items are the target's now (their ids are kept)
                return `Moved ${names(event.itemIds, into)} ${where(event.target)}.`;
            case "drag-cancel":
                return `Cancelled. ${names(event.itemIds)} stayed in place.`;
            default:
                return undefined;
        }
    };
}

export default function TwoTrees() {
    // separate models (a transfer between them), or one model both trees show (a move)
    const [models] = useState(() => ({
        available: createTreeModel<Types, typeof features>(available, {
            features,
        }),
        selected: createTreeModel<Types, typeof features>(selected, {
            features,
        }),
        shared: createTreeModel<Types, typeof features>(available, {
            features,
        }),
    }));
    const [shared, setShared] = useState(false);
    const switchId = useId();
    const left = shared ? models.shared : models.available;
    const right = shared ? models.shared : models.selected;
    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span className={styles.switchField}>
                    <Switch.Root
                        aria-labelledby={switchId}
                        checked={shared}
                        onCheckedChange={setShared}
                    >
                        <Switch.Thumb />
                    </Switch.Root>
                    <span id={switchId}>One shared model</span>
                </span>
            </div>
            <div className={styles.lists}>
                <List
                    key={`available-${shared}`}
                    model={left}
                    name="Available"
                />
                <List
                    key={`selected-${shared}`}
                    model={right}
                    name="Selected"
                />
            </div>
            <p className={styles.hint}>
                Drag items from one list to the other, or press Ctrl+Shift+D on
                one and Down past the last place of its list.
            </p>
        </div>
    );
}

/** One list: a tree of the "lists" drag group (its model's). */
function List({ model, name }: { model: TreeModel<Types>; name: string }) {
    const [announce] = useState(() => announcer(model, name));
    return (
        <Tree.Root<Types>
            model={model}
            announce={announce}
            aria-label={name}
            className={styles.root}
        >
            <Tree.Items<Types>>{(item) => <Item item={item} />}</Tree.Items>
            <DropIndicator className={styles.dropIndicator} />
            <Tree.LiveRegion className={styles.liveRegion} />
        </Tree.Root>
    );
}

function Item({ item }: { item: ItemOf<Types> }) {
    return (
        <Tree.Item item={item} className={styles.item}>
            <Tree.ItemContent className={styles.row}>
                <GripVertical aria-hidden className={styles.grip} />
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                {item.kind === "group" ? (
                    <Folder aria-hidden className={styles.groupIcon} />
                ) : (
                    <Leaf aria-hidden className={styles.produceIcon} />
                )}
                <span className={styles.label}>{item.label}</span>
            </Tree.ItemContent>
            <Tree.Group<Types>>{(child) => <Item item={child} />}</Tree.Group>
        </Tree.Item>
    );
}
