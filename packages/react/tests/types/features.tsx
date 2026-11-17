// Type fixtures (compiled by `pnpm typecheck`, never run): the root's props, the hooks and the refs
// are typed by the model's features. `@ts-expect-error` marks what must not compile.
import { createTreeModel, Tree, useTreeRef, useTreeState } from "../../src";
import { selection } from "../../src/selection";
import { virtualization } from "../../src/virtualization";
import type { FileTypes } from "../tree";

const features = [selection(), virtualization({ rowSize: 20 })] as const;
const model = createTreeModel<FileTypes, typeof features>(undefined, {
    features,
});
const bare = createTreeModel<FileTypes>();

export function WithFeatures() {
    // the hooks infer the features from the model
    const count = useTreeState((state) => state.selectedItemIds.length, {
        model,
    });
    const tree = useTreeRef<FileTypes, typeof features>();
    void tree.current?.engine.get("virtual-window")?.rows;
    return (
        <Tree.Root
            model={model}
            treeRef={tree}
            selectedItemIds={[]}
            onSelectedItemIdsChange={(itemIds: string[]) => void itemIds}
            aria-label={String(count)}
        />
    );
}

export function WithoutFeatures() {
    // @ts-expect-error a bare tree's state has no selection
    useTreeState((state) => state.selectedItemIds, { model: bare });
    const tree = useTreeRef<FileTypes>();
    // @ts-expect-error the virtualization feature is not installed
    void tree.current?.engine.get("virtual-window");
    return (
        <>
            {/* @ts-expect-error selectedItemIds needs the selection feature */}
            <Tree.Root model={bare} selectedItemIds={[]} />
            <Tree.Root<FileTypes, typeof features>
                defaultTree={{ version: 1, rootItemIds: [], items: {} }}
                features={features}
                selectedItemIds={[]}
            />
            {/* @ts-expect-error a root's features type its model */}
            <Tree.Root<FileTypes> features={features} />
        </>
    );
}
