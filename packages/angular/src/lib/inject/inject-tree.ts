import { computed, type Signal } from "@angular/core";
import type {
    AnyTypes,
    TreeEngine,
    TreeModel,
    TreeTypes,
} from "@fragiola/tree";
import { injectTreeContext, typedEngine, typedModel } from "../context";

export interface InjectTreeResult<T extends TreeTypes = AnyTypes> {
    /**
     * the model of the enclosing `[treeRoot]`: the tree's data and its rules. Change the tree with
     * `model().run("item.expand", { itemId })`, read it with `model().get` / `model().is`
     */
    model: Signal<TreeModel<T>>;
    /**
     * the engine of the tree on screen: screen actions (`engine.run("focus", { itemId })`) and
     * screen facts (`engine.get("drop-target")`). It is there from the start; before the root
     * created its engine an action is refused and a read is empty
     */
    engine: TreeEngine<T>;
}

/**
 * The model and the engine of the enclosing `[treeRoot]`. Pass the model's registry as the type
 * argument (`injectTree<Types>()`): a child cannot infer it through injection. Call it in an
 * injection context (a constructor or a field initializer).
 */
export function injectTree<
    T extends TreeTypes = AnyTypes,
>(): InjectTreeResult<T> {
    const context = injectTreeContext("injectTree");
    return {
        model: computed(() => typedModel<T>(context.model())),
        engine: typedEngine<T>(context.publicEngine),
    };
}
