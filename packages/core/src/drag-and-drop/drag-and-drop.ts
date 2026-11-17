// The drag and drop feature: `dragAndDrop(options?)` lets the tree's items be dragged with Pointer
// Events (../guidelines/decisions.md#drag-and-drop: pointer capture, a movement threshold, one path
// for mouse, touch and pen) and with the keyboard (`start-keyboard-drag`, the key map's
// `start-drag`), onto the targets `model.can("item.move", …)` accepts. A drop runs the core's
// `item.move`; drag groups (`dragGroup()`) and drops outside (`dropOutside()`) extend it. A tree
// without it never drags: a press only focuses and selects.
import { fail, ok } from "../commands/define";
import type { CommandResult } from "../commands/types";
import { type DropTuning, modifiersOf } from "../drop-target/host";
import { dragSessionOf } from "../drop-target/session";
import type { FeatureEngine, TreeFeature } from "../features/types";
import { dragSetOf } from "./drag-set";
import { KeyboardDrag } from "./keyboard-drag";
import { PointerDrag } from "./pointer-drag";

/** Options of {@link dragAndDrop}: how a press becomes a drag, and how its target shows. */
export interface DragAndDropOptions extends DropTuning {
    /** how far (px) a press moves before it is a drag (default 4) */
    dragThreshold?: number | undefined;
}

/** The drag and drop feature, as `features` holds it. */
export type DragAndDropFeature = TreeFeature<"drag-and-drop">;

/**
 * The drag and drop feature: the engine drags the pressed item (or the selection it is in) past
 * the threshold, shows the target (`engine.get("drop-target")`, `Tree.DropIndicator`), expands a
 * collapsed parent hovered long enough, scrolls near the edges, and drops with one `item.move`.
 *
 * ```ts
 * import { dragAndDrop } from "@fragiola/tree/drag-and-drop";
 * const model = createTreeModel(json, { features: [dragAndDrop({ indicatorInset: 30 })] });
 * ```
 */
export function dragAndDrop(
    options: DragAndDropOptions = {},
): DragAndDropFeature {
    const frozen = Object.freeze({ ...options });
    return Object.freeze({
        name: "drag-and-drop",
        engine: (host): FeatureEngine => {
            const session = dragSessionOf(host);
            session.tune(frozen, true);
            const pointer = new PointerDrag(session);
            const keyboard = new KeyboardDrag(session);
            const cancel = () => {
                pointer.cancel();
                keyboard.cancel();
            };
            session.onCancel(cancel);
            const startKeyboardDrag = (
                { itemIds }: { itemIds: string[] },
                dryRun: boolean,
            ): CommandResult<unknown> => {
                const { model } = session;
                if (!Array.isArray(itemIds) || itemIds.length === 0) {
                    return fail(
                        "invalid_payload",
                        "must have at least 1 item(s)",
                        "/itemIds",
                    );
                }
                for (const [i, itemId] of itemIds.entries()) {
                    if (!model.get("item-by", { id: itemId })) {
                        return fail(
                            "not_found",
                            `"${itemId}" is not an item`,
                            `/itemIds/${i}`,
                        );
                    }
                    if (!model.is("item-movable", { itemId })) {
                        return fail(
                            "refused",
                            `"${itemId}" cannot move`,
                            `/itemIds/${i}`,
                        );
                    }
                }
                if (session.drag() || pointer.pressed) {
                    return fail("refused", "a drag is under way");
                }
                if (dryRun) return ok({ itemIds: [...itemIds] });
                return keyboard.start(itemIds)
                    ? ok({ itemIds: [...itemIds] })
                    : fail("refused", "the items have nowhere to go");
            };
            const verbs = session.verbs("drag-and-drop");
            return {
                ...verbs,
                run: {
                    ...verbs.run,
                    "start-keyboard-drag": (payload, dryRun) =>
                        startKeyboardDrag(
                            payload as { itemIds: string[] },
                            dryRun,
                        ),
                },
                keyAction: (action, { current }) =>
                    action === "start-drag"
                        ? startKeyboardDrag(
                              { itemIds: dragSetOf(session.model, current) },
                              false,
                          ).ok
                        : undefined,
                interceptKey: (event) => {
                    if (keyboard.active) {
                        switch (event.key) {
                            case "ArrowDown":
                                keyboard.step(1);
                                return true;
                            case "ArrowUp":
                                keyboard.step(-1);
                                return true;
                            case "Enter":
                                keyboard.drop(modifiersOf(event));
                                return true;
                            case "Escape":
                                keyboard.cancel();
                                return true;
                            default:
                                return false;
                        }
                    }
                    // a pointer drag leaves the tree's keys alone (its Escape is the document's)
                    return pointer.active ? false : undefined;
                },
                press: (itemId, event, content) =>
                    pointer.pointerDown(itemId, event, content),
                consumeClick: () => pointer.consumeClick(),
                pinnedItemId: () => pointer.pressedItemId,
                detached: cancel,
            };
        },
    } satisfies DragAndDropFeature);
}
