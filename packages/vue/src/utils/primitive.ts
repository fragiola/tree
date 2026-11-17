// From Dockable (fragiola/dockable, packages/vue/src/utils/primitive.ts), same author and licence.
// Tree adds the typed events of a primitive (`v-model:*`, `@rename-error`).
import {
    type DefineSetupFnComponent,
    defineComponent,
    type ObjectEmitsOptions,
    type Prop,
    type PropType,
    type SlotsType,
    type VNode,
    type VNodeChild,
} from "vue";
import type { AsProp } from "./render";

/** A slot function: what a scoped slot of a primitive receives, and the nodes it renders. */
export type SlotFunction<Scope> = (scope: Scope) => VNode[];

/** No events: every listener a primitive takes is a fallthrough attribute. */
export type NoEmits = Record<never, never>;

/**
 * A primitive's public type: a component taking `Props` (plus any fallthrough attribute) with the
 * scoped slots `Slots` and the events `Emits` (`Tree.Root`'s `update:*`, for `v-model`). Typed by
 * the registry `T` through each part's props, and through `typedTree<T>()` for the parts that take
 * no typed prop.
 */
export type TreeComponent<
    Props extends object,
    Slots extends object,
    Emits extends ObjectEmitsOptions = NoEmits,
> = DefineSetupFnComponent<Props, Emits, SlotsType<Slots>>;

/** The props every primitive accepts on top of its own: `as` replaces its element. */
export interface PrimitiveProps {
    /** the tag or component rendered instead of the primitive's element (never `asChild`) */
    as?: AsProp | undefined;
}

/** What a primitive's setup receives with its props. */
export interface PrimitiveContext<Slots> {
    /** the fallthrough attributes: `class`, `style`, listeners, ARIA, `data-*`, … */
    attrs: Record<string, unknown>;
    slots: { readonly [K in keyof Slots]?: Slots[K] };
    /** emits one of the primitive's events */
    emit: (event: string, ...args: unknown[]) => void;
}

/**
 * The Vue props options of a primitive's props. The names in `booleans` are cast the way Vue casts
 * a boolean prop, so a bare attribute is `true` (`<Tree.Root checkboxes>`, not the empty string);
 * absent, they stay `undefined`, so the core's default applies.
 */
export function primitiveProps<Name extends string>(
    names: readonly Name[],
    booleans: readonly Name[] = [],
): Record<Name, Prop<unknown> | null> {
    // a type-erased record (the primitive's public type comes from `TreeComponent`)
    return Object.fromEntries(
        names.map((name) => [
            name,
            booleans.includes(name)
                ? { type: Boolean as PropType<unknown>, default: undefined }
                : null,
        ]),
    ) as Record<Name, Prop<unknown> | null>;
}

/**
 * Defines a primitive: a component with `inheritAttrs: false` (it merges the fallthrough attributes
 * itself, under its structural style), the props named in `props` (`booleans`: those that take a
 * bare attribute as `true`) and the events named in `emits`.
 */
export function definePrimitive<
    Props extends object,
    Slots extends object,
    Emits extends ObjectEmitsOptions = NoEmits,
>(
    name: string,
    props: readonly (keyof Props & string)[],
    setup: (props: Props, context: PrimitiveContext<Slots>) => () => VNodeChild,
    options: {
        booleans?: readonly (keyof Props & string)[];
        emits?: readonly (keyof Emits & string)[];
    } = {},
): TreeComponent<Props, Slots, Emits> {
    return defineComponent({
        name: `Tree${name}`,
        inheritAttrs: false,
        props: primitiveProps(props, options.booleans),
        emits: [...(options.emits ?? [])],
        setup(componentProps, { attrs, slots, emit }) {
            return setup(componentProps as unknown as Props, {
                attrs,
                slots: slots as PrimitiveContext<Slots>["slots"],
                emit: emit as PrimitiveContext<Slots>["emit"],
            });
        },
    }) as unknown as TreeComponent<Props, Slots, Emits>;
}
