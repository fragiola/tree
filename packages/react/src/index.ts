// The whole core, so that a React app installs and imports one package. A local export would
// silently shadow a core name of the same spelling: tests/index.test.ts fails on one.
export * from "@fragiola/tree";
export type { CheckboxProps } from "./components/checkbox";
export type {
    DropIndicatorProps,
    DropIndicatorState,
} from "./components/drop-indicator";
export type { GroupProps } from "./components/group";
export type { ItemProps } from "./components/item";
export type { ItemContentProps } from "./components/item-content";
export type { ItemsProps } from "./components/items";
export type {
    LiveRegionProps,
    LiveRegionState,
} from "./components/live-region";
export type {
    RenameInputProps,
    RenameInputState,
} from "./components/rename-input";
export type { RootProps, RootState } from "./components/root";
export type { ToggleProps } from "./components/toggle";
export {
    createTreeRef,
    type TreeHandle,
    type TreeRef,
} from "./hooks/create-tree-ref";
export { type UseTreeResult, useTree } from "./hooks/use-tree";
export {
    type TreeItemState,
    type UseTreeItemResult,
    useTreeItem,
} from "./hooks/use-tree-item";
export { useTreeRef } from "./hooks/use-tree-ref";
export {
    type UseTreeStateOptions,
    useTreeState,
} from "./hooks/use-tree-state";
export * as Tree from "./parts";
export type {
    DivPrimitiveProps,
    InputPrimitiveProps,
    PrimitiveProps,
    RenderedProps,
    RenderProp,
    SpanPrimitiveProps,
} from "./utils/use-render";
