import { Component, computed, signal } from "@angular/core";
import {
    type AnnounceEvent,
    createTreeModel,
    type DropTarget,
    TREE,
    type TreeJson,
    type TreeModel,
} from "@fragiola/tree-angular";
import {
    LucideChevronRight,
    LucideFolder,
    LucideGripVertical,
    LucideLeaf,
} from "@lucide/angular";
import { SWITCH } from "#/components/ui/switch";
import * as styles from "./styles";

type Types = { items: { group: undefined; produce: undefined } };

// Two trees in one drag group (`dragGroup`): items drag between them with the pointer, or with the
// keyboard (Ctrl+Shift+D, then Down past the last place of one list reaches the other). Over two
// models a drop is a transfer: the target model adds the dragged subtrees (`item.add`), the source
// model removes them (`item.remove`), each through its own middleware. Over one shared model it is
// one `item.move`.
const available: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["fruit", "vegetables", "herbs"],
    items: {
        fruit: {
            kind: "group",
            label: "Fruit",
            childItemIds: ["apple", "banana", "cherry"],
        },
        apple: { kind: "produce", label: "Apple" },
        banana: { kind: "produce", label: "Banana" },
        cherry: { kind: "produce", label: "Cherry" },
        vegetables: {
            kind: "group",
            label: "Vegetables",
            childItemIds: ["carrot", "leek"],
        },
        carrot: { kind: "produce", label: "Carrot" },
        leek: { kind: "produce", label: "Leek" },
        herbs: {
            kind: "group",
            label: "Herbs",
            childItemIds: ["basil", "mint"],
        },
        basil: { kind: "produce", label: "Basil" },
        mint: { kind: "produce", label: "Mint" },
    },
    expandedItemIds: ["fruit", "vegetables", "herbs"],
};

const selected: TreeJson<Types> = { version: 1, rootItemIds: [], items: {} };

/** The live region's text for each step of a drag, naming the list a target is in. */
function announcer(model: TreeModel<Types>, list: string) {
    return (event: AnnounceEvent): string | undefined => {
        // a target in the other list comes with its tree: its model and its root (its name)
        const other = "targetTree" in event ? event.targetTree : undefined;
        const into = other?.model ?? model;
        const listName = other?.root.getAttribute("aria-label") ?? list;
        // the labels are read from either model's items
        const label = (
            itemId: string | null,
            from: TreeModel<Types> | TreeModel = into,
        ) =>
            itemId === null
                ? listName
                : (from.state.items[itemId]?.label ?? itemId);
        const names = (
            itemIds: readonly string[],
            from: TreeModel<Types> | TreeModel = model,
        ) => itemIds.map((itemId) => label(itemId, from)).join(", ");
        const where = (target: DropTarget) =>
            target.itemId === null
                ? `into ${listName}`
                : target.position === "inside"
                  ? `into ${label(target.itemId)} in ${listName}`
                  : `${target.position} ${label(target.itemId)} in ${listName}`;
        switch (event.type) {
            case "drag-start":
                return event.target
                    ? `Picked up ${names(event.itemIds)}. Up and Down choose a place, in either list; Enter drops, Escape cancels. Drop ${where(event.target)}.`
                    : `Picked up ${names(event.itemIds)}.`;
            case "drag-over":
                return event.target
                    ? `Drop ${where(event.target)}.`
                    : "No place to drop here.";
            case "drop":
                // the moved items are the target's now (their ids are kept)
                return `Moved ${names(event.itemIds, into)} ${where(event.target)}.`;
            case "drag-cancel":
                return `Cancelled. ${names(event.itemIds)} stayed in place.`;
            default:
                return undefined;
        }
    };
}

/** One list: a tree of the "lists" drag group, with its own announcer. */
type List = {
    key: string;
    name: string;
    model: TreeModel<Types>;
    announce: (event: AnnounceEvent) => string | undefined;
};

function list(model: TreeModel<Types>, name: string, shared: boolean): List {
    return {
        key: `${name}-${shared}`,
        name,
        model,
        announce: announcer(model, name),
    };
}

let nextId = 0;

@Component({
    selector: "example-two-trees",
    imports: [
        TREE,
        SWITCH,
        LucideChevronRight,
        LucideFolder,
        LucideGripVertical,
        LucideLeaf,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span [class]="styles.switchField">
                    <button
                        kitSwitch
                        [attr.aria-labelledby]="switchId"
                        [checked]="shared()"
                        (checkedChange)="shared.set($event)"
                    >
                        <span kitSwitchThumb></span>
                    </button>
                    <span [id]="switchId">One shared model</span>
                </span>
            </div>
            <div [class]="styles.lists">
                <!-- keyed by the mode: the lists remount when the switch toggles -->
                @for (list of lists(); track list.key) {
                    <div
                        [treeRoot]="list.model"
                        dragGroup="lists"
                        #tree="treeRoot"
                        [announce]="list.announce"
                        [indicatorInset]="styles.indicatorInset"
                        [attr.aria-label]="list.name"
                        [class]="styles.root"
                    >
                        <ng-template [treeItems]="list.model" let-item>
                            <div [treeItem]="item" [class]="styles.item">
                                <div treeItemContent [class]="styles.row">
                                    <svg lucideGripVertical aria-hidden="true" [class]="styles.grip"></svg>
                                    <span treeToggle [class]="styles.toggle">
                                        <svg lucideChevronRight aria-hidden="true"></svg>
                                    </span>
                                    @if (item.kind === "group") {
                                        <svg lucideFolder aria-hidden="true" [class]="styles.groupIcon"></svg>
                                    } @else {
                                        <svg lucideLeaf aria-hidden="true" [class]="styles.produceIcon"></svg>
                                    }
                                    <span [class]="styles.label">{{ item.label }}</span>
                                </div>
                                <div treeGroup></div>
                            </div>
                        </ng-template>
                        <!-- the receiving list is dragging too while a drag from the other one is
                             under way, so each list's indicator is there only during a drag -->
                        @if (tree.state().dragging) {
                            <div treeDropIndicator [class]="styles.dropIndicator"></div>
                        }
                        <div treeLiveRegion [class]="styles.liveRegion"></div>
                    </div>
                }
            </div>
            <p [class]="styles.hint">
                Drag items from one list to the other, or press Ctrl+Shift+D on one and Down past
                the last place of its list.
            </p>
        </div>
    `,
})
export default class TwoTrees {
    protected readonly styles = styles;
    protected readonly switchId = `two-trees-switch-${nextId++}`;
    // separate models (a transfer between them), or one model both trees show (a move)
    private readonly models = {
        available: createTreeModel<Types>(available),
        selected: createTreeModel<Types>(selected),
        shared: createTreeModel<Types>(available),
    };
    protected readonly shared = signal(false);
    protected readonly lists = computed(() => {
        const shared = this.shared();
        return [
            list(
                shared ? this.models.shared : this.models.available,
                "Available",
                shared,
            ),
            list(
                shared ? this.models.shared : this.models.selected,
                "Selected",
                shared,
            ),
        ];
    });
}
