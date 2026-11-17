import type {
    AnyTypes,
    TreeEngine,
    TreeFeatures,
    TreeModel,
    TreeTypes,
} from "@fragiola/tree";
import { typedEngine, typedModel, useTreeContext } from "../context";

export interface UseTreeResult<
    T extends TreeTypes = AnyTypes,
    F extends TreeFeatures = readonly [],
> {
    /**
     * the model of the enclosing `Tree.Root`: the tree's data and its rules. Change the tree with
     * `model.run("item.expand", { itemId })`, read it with `model.get` / `model.is`
     */
    model: TreeModel<T, F>;
    /**
     * the engine of the tree on screen: screen actions (`engine.run("focus", { itemId })`) and
     * screen facts (`engine.get("drop-target")`). It is there from the first render; before the
     * root is mounted (and on the server) an action is refused and a read is empty
     */
    engine: TreeEngine<T, F>;
}

/**
 * The model and the engine of the enclosing `Tree.Root`. Pass the model's registry as the type
 * argument (`useTree<Types>()`): a child cannot infer it through context.
 */
export function useTree<
    T extends TreeTypes = AnyTypes,
    F extends TreeFeatures = readonly [],
>(): UseTreeResult<T, F> {
    const context = useTreeContext("useTree");
    return {
        model: typedModel<T, F>(context.model),
        engine: typedEngine<T, F>(context.publicEngine),
    };
}
