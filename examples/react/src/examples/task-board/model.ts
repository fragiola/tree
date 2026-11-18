import { createTreeModel, type TreeModel } from "@fragiola/tree-react";
import { checkboxes } from "@fragiola/tree-react/checkboxes";
import { dragAndDrop } from "@fragiola/tree-react/drag-and-drop";
import { dropOutside } from "@fragiola/tree-react/drop-outside";
import { rename } from "@fragiola/tree-react/rename";
import { selection } from "@fragiola/tree-react/selection";
import {
    type BoardTypes,
    board,
    parseStatus,
    setStatus,
    workIdsOf,
} from "./board";
import { indicatorInset } from "./styles";

/** The board's features, written out: the model's type names them before the model exists. */
export type BoardFeatures = readonly [
    ReturnType<typeof selection>,
    ReturnType<typeof checkboxes>,
    ReturnType<typeof rename>,
    ReturnType<typeof dragAndDrop>,
    ReturnType<typeof dropOutside<BoardTypes>>,
];

/** The board's model, with its features. */
export type BoardModel = TreeModel<BoardTypes, BoardFeatures>;

/**
 * The board's model and its opt-in features: the selection (a click), the checks (Space: a task is
 * done when checked), the rename (F2), the drags inside the tree (a drop line starts past the
 * check), and rows released outside it, on a board column (`data-status-column`), which moves them
 * to that status. Created per board: the drop outside runs this model's own commands.
 */
export function createBoardModel(): BoardModel {
    const columns = dropOutside<BoardTypes>({
        onDrop: ({ itemIds, element }) => {
            const status = parseStatus(
                element
                    ?.closest("[data-status-column]")
                    ?.getAttribute("data-status-column"),
            );
            // a project or an epic has no status: a drop of nothing but those is refused
            const workIds = workIdsOf(model, itemIds);
            return (
                status !== undefined &&
                workIds.length > 0 &&
                setStatus(model, workIds, status).ok
            );
        },
    });
    const features: BoardFeatures = [
        selection(),
        checkboxes({ space: "check" }),
        rename(),
        dragAndDrop({ indicatorInset }),
        columns,
    ];
    const model = createTreeModel<BoardTypes, BoardFeatures>(board(), {
        features,
    });
    return model;
}
