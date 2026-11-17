// Type fixtures (compiled by `pnpm typecheck`, never run): the root's props, the hooks and the refs
// are typed by the model's features. `@ts-expect-error` marks what must not compile.
import { createTreeModel, Tree, useTreeRef, useTreeState } from "../../src";
import { asyncChildren } from "../../src/async-children";
import { checkboxes } from "../../src/checkboxes";
import { rename } from "../../src/rename";
import { selection } from "../../src/selection";
import { typeAhead } from "../../src/type-ahead";
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

const stateFeatures = [
    checkboxes(),
    rename(),
    asyncChildren(),
    typeAhead(),
] as const;
const stateModel = createTreeModel<FileTypes, typeof stateFeatures>(undefined, {
    features: stateFeatures,
});

export function WithStateFeatures() {
    const checked = useTreeState((state) => state.checkedItemIds.length, {
        model: stateModel,
    });
    const tree = useTreeRef<FileTypes, typeof stateFeatures>();
    tree.current?.engine.run("load-children", { itemId: "a" });
    tree.current?.engine.run("cancel-rename", { itemId: "a" });
    return (
        <Tree.Root
            model={stateModel}
            treeRef={tree}
            checkedItemIds={[]}
            onCheckedItemIdsChange={(itemIds: string[]) => void itemIds}
            // the loader is typed by the registry: a file's data is { size }
            loadChildren={async (item) =>
                item.kind === "file"
                    ? []
                    : [{ kind: "file", label: "x", data: { size: 1 } }]
            }
            aria-label={String(checked)}
        />
    );
}

export function WithoutStateFeatures() {
    // @ts-expect-error a bare tree's state has no checks
    useTreeState((state) => state.checkedItemIds, { model: bare });
    const tree = useTreeRef<FileTypes>();
    // @ts-expect-error the async children feature is not installed
    tree.current?.engine.run("load-children", { itemId: "a" });
    // @ts-expect-error the rename feature is not installed
    tree.current?.engine.run("commit-rename", { itemId: "a", label: "b" });
    return (
        <>
            {/* @ts-expect-error checkedItemIds needs the checkboxes feature */}
            <Tree.Root model={bare} checkedItemIds={[]} />
            {/* @ts-expect-error loadChildren needs the async children feature */}
            <Tree.Root model={bare} loadChildren={async () => []} />
            <Tree.Root
                model={stateModel}
                // @ts-expect-error a file's data is { size: number }
                loadChildren={async () => [
                    { kind: "file", label: "x", data: { size: "big" } },
                ]}
            />
        </>
    );
}
