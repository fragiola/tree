import { createTreeModel, veto } from "@fragiola/tree-react";
import {
    type DragAndDropFeature,
    dragAndDrop,
} from "@fragiola/tree-react/drag-and-drop";
import {
    type SelectionFeature,
    selection,
} from "@fragiola/tree-react/selection";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FixtureTree, files, type Types } from "../../src/fixture/tree";
import "../../src/fixture/fixture.css";

// The drag and drop fixture: the pointer and the keyboard drag on an unstyled tree. `docs` refuses
// drops (a middleware veto); every drop is announced in the live region and logged below.

function App() {
    const [model] = useState(() => {
        const created = createTreeModel<
            Types,
            readonly [SelectionFeature, DragAndDropFeature]
        >(files(), {
            features: [selection(), dragAndDrop({ autoExpandDelay: 300 })],
        });
        created.use((ctx, next) =>
            ctx.command === "item.move" &&
            (ctx.payload as { to: { parentItemId: string | null } }).to
                .parentItemId === "docs"
                ? veto("docs is locked")
                : next(),
        );
        return created;
    });
    const [moves, setMoves] = useState<string[]>([]);
    useEffect(
        () =>
            model.subscribe((event) => {
                if (event.command === "item.move") {
                    setMoves((all) => [...all, JSON.stringify(event.payload)]);
                }
            }),
        [model],
    );
    return (
        <>
            <FixtureTree
                model={model}
                announce={(event) =>
                    event.type === "drop"
                        ? `Dropped ${event.itemIds.join(", ")}`
                        : undefined
                }
            />
            <ol aria-label="Moves">
                {moves.map((move, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: the log only grows
                    <li key={index}>{move}</li>
                ))}
            </ol>
        </>
    );
}

const container = document.getElementById("app");
if (!container) throw new Error("no #app");
createRoot(container).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
