import type {
    AnyTypes,
    TreeEngine,
    TreeModel,
    TreeTypes,
} from "@fragiola/tree";
import { typedEngine, typedModel, useTreeContext } from "../context";

export interface UseTreeResult<T extends TreeTypes = AnyTypes> {
    /**
     * the model of the enclosing `Tree.Root`: the tree's data and its rules. Change the tree with
     * `model.run("item.expand", { itemId })`, read it with `model.get` / `model.is`
     */
    model: TreeModel<T>;
    /**
     * the engine of the tree on screen: screen actions (`engine.run("focus", { itemId })`) and
     * screen facts (`engine.get("drop-target")`). It is there from the first render; before the
     * root is mounted (and on the server) an action is refused and a read is empty
     */
    engine: TreeEngine<T>;
}

/**
 * The model and the engine of the enclosing `Tree.Root`. Pass the model's registry as the type
 * argument (`useTree<Types>()`): a child cannot infer it through context.
 */
export function useTree<T extends TreeTypes = AnyTypes>(): UseTreeResult<T> {
    const context = useTreeContext("useTree");
    return {
        model: typedModel<T>(context.model),
        engine: typedEngine<T>(context.publicEngine),
    };
}
