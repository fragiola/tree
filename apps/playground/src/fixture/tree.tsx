import {
    type ItemOf,
    type RootProps,
    Tree,
    type TreeJson,
    useTreeItemRename,
} from "@fragiola/tree-react";
import { selection } from "@fragiola/tree-react/selection";

// The unstyled tree every fixture renders: each primitive, the labels as text, the names inline.

export type Types = { items: { folder: undefined; file: undefined } };

/**
 * A project: src (expanded) with app.ts, lib (from the loader when `lazy`) and utils (a.ts, b.ts);
 * docs with guide.md; readme.md.
 */
export function files(lazy = false): TreeJson<Types> {
    return {
        version: 1,
        settings: { selectionMode: "multiple" },
        rootItemIds: ["src", "docs", "readme"],
        items: {
            src: {
                kind: "folder",
                label: "src",
                childItemIds: ["app", "lib", "utils"],
            },
            app: { kind: "file", label: "app.ts" },
            lib: lazy
                ? { kind: "folder", label: "lib", childrenStatus: "unloaded" }
                : { kind: "folder", label: "lib", childItemIds: [] },
            utils: { kind: "folder", label: "utils", childItemIds: ["a", "b"] },
            a: { kind: "file", label: "a.ts" },
            b: { kind: "file", label: "b.ts" },
            docs: { kind: "folder", label: "docs", childItemIds: ["guide"] },
            guide: { kind: "file", label: "guide.md" },
            readme: { kind: "file", label: "readme.md" },
        },
        expandedItemIds: ["src"],
    };
}

function Item({ item }: { item: ItemOf<Types> }) {
    return (
        <Tree.Item item={item}>
            <Tree.ItemContent>
                <Tree.Toggle>▸</Tree.Toggle>
                {item.label}
                <RenameField item={item} />
            </Tree.ItemContent>
            <Tree.Group<Types>>{(child) => <Item item={child} />}</Tree.Group>
        </Tree.Item>
    );
}

/** The fixtures' features: the selection. */
const FEATURES = [selection()];

export function FixtureTree(props: RootProps<Types>) {
    return (
        <Tree.Root<Types> aria-label="Files" features={FEATURES} {...props}>
            <Tree.Items<Types>>{(item) => <Item item={item} />}</Tree.Items>
            <Tree.DropIndicator />
            <Tree.LiveRegion />
        </Tree.Root>
    );
}

function RenameField({ item }: { item: ItemOf<Types> }) {
    const { state, props } = useTreeItemRename(item);
    return state.renaming ? (
        <input {...props} aria-label={`Rename ${item.label}`} />
    ) : null;
}
