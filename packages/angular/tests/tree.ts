// The tree the tests render: every directive, assembled the way an app does, with no text but the
// labels (the app's data) and the names the app gives. The same tree as packages/react's and
// packages/vue's tests.
import { ApplicationRef, Component, input, type Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
    type AnnounceEvent,
    createTreeModel,
    type KeyMap,
    type LoadChildren,
    TREE,
    type TreeJson,
    type TreeModel,
} from "../src/public-api";

export type FileTypes = {
    items: { folder: undefined; file: { size: number } };
};

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

/** The inputs of {@link FileTree}: the root's. */
export interface FileTreeInputs {
    model?: TreeModel<FileTypes> | undefined;
    defaultTree?: TreeJson<FileTypes> | undefined;
    expandedItemIds?: readonly string[] | undefined;
    selectedItemIds?: readonly string[] | undefined;
    checkedItemIds?: readonly string[] | undefined;
    loadChildren?: LoadChildren<FileTypes> | undefined;
    announce?: ((event: AnnounceEvent) => string | undefined) | undefined;
    keyMap?: Partial<KeyMap> | undefined;
    expandOnClick?: boolean | undefined;
    checkboxes?: boolean | undefined;
    dragThreshold?: number | undefined;
    autoExpandDelay?: number | undefined;
    indentation?: number | undefined;
    typeAheadTimeout?: number | undefined;
}

/** What the root's change outputs reported, in order. */
export type Emitted = [list: string, itemIds: string[]];

/** `[treeRoot]` with the file items (one recursive template), a drop indicator and a live region. */
@Component({
    selector: "test-file-tree",
    imports: [TREE],
    template: `
        <div
            [treeRoot]="model()"
            #tree="treeRoot"
            [defaultTree]="defaultTree()"
            [expandedItemIds]="expandedItemIds()"
            [selectedItemIds]="selectedItemIds()"
            [checkedItemIds]="checkedItemIds()"
            [loadChildren]="loadChildren()"
            [announce]="announce()"
            [keyMap]="keyMap()"
            [expandOnClick]="expandOnClick()"
            [checkboxes]="checkboxes()"
            [dragThreshold]="dragThreshold()"
            [autoExpandDelay]="autoExpandDelay()"
            [indentation]="indentation()"
            [typeAheadTimeout]="typeAheadTimeout()"
            (expandedItemIdsChange)="emitted.push(['expandedItemIds', $event])"
            (selectedItemIdsChange)="emitted.push(['selectedItemIds', $event])"
            (checkedItemIdsChange)="emitted.push(['checkedItemIds', $event])"
            aria-label="Files"
        >
            <ng-template [treeItems]="model()" let-item>
                <div [treeItem]="item">
                    <div treeItemContent>
                        <span treeToggle></span>
                        <span treeCheckbox></span>
                        <span>{{ item.label }}</span>
                        <input treeRenameInput aria-label="Name" (renameError)="renameErrors.push($event.code)" />
                    </div>
                    <div treeGroup></div>
                </div>
            </ng-template>
            <div treeDropIndicator></div>
            <div treeLiveRegion></div>
        </div>
    `,
})
export class FileTree {
    readonly model = input<TreeModel<FileTypes> | undefined>(undefined);
    readonly defaultTree = input<TreeJson<FileTypes> | undefined>(undefined);
    readonly expandedItemIds = input<readonly string[] | undefined>(undefined);
    readonly selectedItemIds = input<readonly string[] | undefined>(undefined);
    readonly checkedItemIds = input<readonly string[] | undefined>(undefined);
    readonly loadChildren = input<LoadChildren<FileTypes> | undefined>(
        undefined,
    );
    readonly announce = input<
        ((event: AnnounceEvent) => string | undefined) | undefined
    >(undefined);
    readonly keyMap = input<Partial<KeyMap> | undefined>(undefined);
    readonly expandOnClick = input<boolean | undefined>(undefined);
    readonly checkboxes = input<boolean | undefined>(undefined);
    readonly dragThreshold = input<number | undefined>(undefined);
    readonly autoExpandDelay = input<number | undefined>(undefined);
    readonly indentation = input<number | undefined>(undefined);
    readonly typeAheadTimeout = input<number | undefined>(undefined);
    /** what the change outputs reported */
    readonly emitted: Emitted[] = [];
    /** the codes `(renameError)` reported */
    readonly renameErrors: string[] = [];
}

/** A rendered component: its fixture, and how to change its inputs. */
export interface Rendered<C> {
    component: C;
    set(name: string, value: unknown): Promise<void>;
    destroy(): void;
}

/** Renders `type` into the document with `inputs`, and lets the root create its engine. */
export async function render<C>(
    type: Type<C>,
    inputs: Record<string, unknown> = {},
): Promise<Rendered<C>> {
    const fixture = TestBed.createComponent(type);
    for (const [name, value] of Object.entries(inputs)) {
        fixture.componentRef.setInput(name, value);
    }
    document.body.append(fixture.nativeElement as HTMLElement);
    await settle();
    return {
        component: fixture.componentInstance,
        async set(name, value) {
            fixture.componentRef.setInput(name, value);
            await settle();
        },
        destroy() {
            fixture.destroy();
        },
    };
}

/** Renders the file tree with the root's `inputs`. */
export const renderFiles = (inputs: FileTreeInputs = {}) =>
    render(FileTree, inputs as Record<string, unknown>);

/** Lets Angular run its change detection, its effects and the promises they wait for. */
export async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
        await TestBed.inject(ApplicationRef).whenStable();
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
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

/** An item's row (`treeItemContent`), by its label. */
export function content(label: string): HTMLElement {
    const element = itemElement(label).querySelector<HTMLElement>(
        ':scope > [data-tree-part="content"]',
    );
    if (!element) throw new Error(`no row "${label}"`);
    return element;
}

export const byPath = (path: string) =>
    document.querySelector<HTMLElement>(`[data-tree-path="${path}"]`);

/** The items on screen (a collapsed group renders none). */
export const items = () => [
    ...document.querySelectorAll<HTMLElement>('[role="treeitem"]'),
];

/** The groups shown (a collapsed item's group is there, empty and hidden). */
export const shownGroups = () =>
    [...document.querySelectorAll<HTMLElement>('[role="group"]')].filter(
        (group) => group.style.display !== "none",
    );

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
