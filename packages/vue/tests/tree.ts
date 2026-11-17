// The tree the tests render: every primitive, assembled the way an app does, with no text but the
// labels (the app's data) and the names the app gives. The same tree as packages/react's tests.
import { flushPromises, mount } from "@vue/test-utils";
import {
    defineComponent,
    h,
    nextTick,
    type PropType,
    type VNodeChild,
} from "vue";
import {
    createTreeModel,
    type ItemOf,
    type RootProps,
    type TreeJson,
    typedTree,
    useTree,
    useTreeItem,
    useTreeItemRename,
} from "../src";

export type FileTypes = {
    items: { folder: undefined; file: { size: number } };
};

export const Tree = typedTree<FileTypes>();

//   src/            folder, expanded
//     app.ts
//     lib/          loaded by the app's loader (unloaded)
//     utils/        folder
//       a.ts
//       b.ts
//   readme.md
export function files(
    patch: Partial<TreeJson<FileTypes>> = {},
): TreeJson<FileTypes> {
    return {
        version: 1,
        rootItemIds: ["src", "readme"],
        items: {
            src: {
                kind: "folder",
                label: "src",
                childItemIds: ["app", "lib", "utils"],
            },
            app: { kind: "file", label: "app.ts", data: { size: 120 } },
            lib: { kind: "folder", label: "lib", childrenStatus: "unloaded" },
            utils: { kind: "folder", label: "utils", childItemIds: ["a", "b"] },
            a: { kind: "file", label: "a.ts", data: { size: 1 } },
            b: { kind: "file", label: "b.ts", data: { size: 2 } },
            readme: { kind: "file", label: "readme.md", data: { size: 3 } },
        },
        expandedItemIds: ["src"],
        ...patch,
    };
}

export const filesModel = (patch: Partial<TreeJson<FileTypes>> = {}) =>
    createTreeModel<FileTypes>(files(patch));

/**
 * The app's own check control: a native button out of the tab order and hidden from assistive
 * technology (the item carries `aria-checked`, and Space toggles it), running `item.toggle-check`.
 */
export const Check = defineComponent({
    name: "CheckControl",
    props: {
        item: { type: Object as PropType<ItemOf<FileTypes>>, required: true },
    },
    setup(props) {
        const { model } = useTree<FileTypes>();
        const { state } = useTreeItem(() => props.item);
        return (): VNodeChild =>
            h("button", {
                type: "button",
                tabindex: -1,
                "aria-hidden": "true",
                "data-testid": "check",
                "data-checked": state.value.checked ? "" : undefined,
                "data-indeterminate": state.value.indeterminate
                    ? ""
                    : undefined,
                onClick: () =>
                    model.run("item.toggle-check", { itemId: props.item.id }),
            });
    },
});

/** The app's own rename editor, wired by `useTreeItemRename`. */
export const RenameField = defineComponent({
    name: "RenameField",
    props: {
        item: { type: Object as PropType<ItemOf<FileTypes>>, required: true },
    },
    setup(props) {
        const { state, props: inputProps } = useTreeItemRename(
            () => props.item,
        );
        return (): VNodeChild =>
            state.value.renaming
                ? h("input", { ...inputProps.value, "aria-label": "Name" })
                : null;
    },
});

export const FileItem = defineComponent({
    name: "FileItem",
    props: {
        item: { type: Object as PropType<ItemOf<FileTypes>>, required: true },
    },
    setup(props) {
        return (): VNodeChild =>
            h(
                Tree.Item,
                { item: props.item },
                {
                    default: () => [
                        h(Tree.ItemContent, null, {
                            default: () => [
                                h(Tree.Toggle),
                                h(Check, { item: props.item }),
                                h("span", props.item.label),
                                h(RenameField, { item: props.item }),
                            ],
                        }),
                        h(Tree.Group, null, {
                            default: ({
                                item,
                            }: {
                                item: ItemOf<FileTypes>;
                            }) => [h(FileItem, { item })],
                        }),
                    ],
                },
            );
    },
});

/** `Tree.Root` with the file items, a drop indicator and a live region. */
export function fileTree(
    props: RootProps<FileTypes> & Record<string, unknown>,
): VNodeChild {
    return h(
        Tree.Root,
        { "aria-label": "Files", ...props },
        {
            default: () => [
                h(Tree.Items, null, {
                    default: ({ item }: { item: ItemOf<FileTypes> }) => [
                        h(FileItem, { item }),
                    ],
                }),
                h(Tree.DropIndicator),
                h(Tree.LiveRegion),
            ],
        },
    );
}

/** Mounts `render` into the document, and lets the root create its engine. */
export async function render(render: () => VNodeChild) {
    const host = document.createElement("div");
    document.body.append(host);
    const wrapper = mount(defineComponent({ render }), { attachTo: host });
    await settle();
    return wrapper;
}

/** Lets Vue flush its updates (and the promises they wait for). */
export async function settle(): Promise<void> {
    await flushPromises();
    await nextTick();
}

/** An item's element, by its label: `role="treeitem"` with its label. */
export function itemElement(label: string): HTMLElement {
    const row = [
        ...document.querySelectorAll<HTMLElement>('[data-tree-part="item"]'),
    ].find(
        (element) =>
            element.querySelector(
                ':scope > [data-tree-part="content"] > span:not([data-tree-part])',
            )?.textContent === label,
    );
    if (!row) throw new Error(`no item "${label}"`);
    return row;
}

/** An item's row (`Tree.ItemContent`), by its label. */
export function content(label: string): HTMLElement {
    const element = itemElement(label).querySelector<HTMLElement>(
        ':scope > [data-tree-part="content"]',
    );
    if (!element) throw new Error(`no row "${label}"`);
    return element;
}

export const byPath = (path: string) =>
    document.querySelector<HTMLElement>(`[data-tree-path="${path}"]`);

/** Dispatches a DOM event on `target` (the fields of `init` an event lacks are set on it), then settles. */
export async function fire(
    target: EventTarget,
    type: string,
    init: Record<string, unknown> = {},
): Promise<void> {
    const options = { bubbles: true, cancelable: true, ...init };
    const event = type.startsWith("key")
        ? new KeyboardEvent(type, options)
        : type.startsWith("pointer")
          ? new (window.PointerEvent ?? MouseEvent)(type, options)
          : type.startsWith("focus") || type === "blur"
            ? new FocusEvent(type, { ...options, bubbles: false })
            : type === "input"
              ? new Event(type, options)
              : new MouseEvent(type, options);
    for (const [key, value] of Object.entries(init)) {
        if (!(key in event)) {
            Object.defineProperty(event, key, { value });
        }
    }
    target.dispatchEvent(event);
    await settle();
}

/** Focuses `element`, then settles. */
export async function focus(element: HTMLElement): Promise<void> {
    element.focus();
    await settle();
}

/** The keyboard on the focused element. */
export const press = (key: string, init: Record<string, unknown> = {}) =>
    fire(document.activeElement ?? document.body, "keydown", { key, ...init });

/** Types `value` into an input (an `input` event). */
export async function type(input: HTMLInputElement, value: string) {
    input.value = value;
    await fire(input, "input");
}
