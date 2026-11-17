import {
    createTreeModel,
    type LoadChildren,
    type TreeJson,
    useTree,
} from "@fragiola/tree-react";
import { asyncChildren } from "@fragiola/tree-react/async-children";
import { selection } from "@fragiola/tree-react/selection";
import { useState } from "react";
import { StyledTree } from "../../fixture/styled";
import { useInspector } from "../../inspector/context";

// A loader that is slow (1 s) and fails every other time: expand, collapse during a load, retry
// from the row, and watch item.set-children-status / item.set-children in the Inspector.

type Types = { items: { folder: undefined; file: undefined } };

const json: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["one", "two", "three"],
    items: {
        one: { kind: "folder", label: "one", childrenStatus: "unloaded" },
        two: { kind: "folder", label: "two", childrenStatus: "unloaded" },
        three: { kind: "folder", label: "three", childrenStatus: "unloaded" },
    },
};

/** The scenario's features: the selection, and children from the loader. */
const features = [selection(), asyncChildren()] as const;

let calls = 0;

const loadChildren: LoadChildren<Types> = (item, { signal }) =>
    new Promise((resolve, reject) => {
        calls += 1;
        const fail = calls % 2 === 0;
        const timer = setTimeout(() => {
            if (fail) reject(new Error("the server is flaky"));
            else
                resolve([
                    {
                        kind: "folder",
                        label: `${item.label} / nested`,
                        childrenStatus: "unloaded",
                    },
                    { kind: "file", label: `${item.label}.txt` },
                ]);
        }, 1000);
        signal.addEventListener("abort", () => clearTimeout(timer));
    });

function Retry({ itemId }: { itemId: string }) {
    const { engine, model } = useTree<Types, typeof features>();
    if (model.get("children-status-by", { itemId }) !== "error") return null;
    return (
        <button
            type="button"
            className="ms-auto rounded-sm px-1.5 text-xs text-palette-accent underline"
            onClick={() => engine.run("load-children", { itemId })}
        >
            Retry
        </button>
    );
}

export default function FlakyServer() {
    const [model] = useState(() =>
        createTreeModel<Types, typeof features>(json, { features }),
    );
    useInspector(model);
    return (
        <StyledTree<Types, typeof features>
            model={model}
            loadChildren={loadChildren}
            announce={(event) =>
                event.type === "load-error"
                    ? `${event.itemId} failed`
                    : undefined
            }
            after={(item) => <Retry itemId={item.id} />}
        />
    );
}
