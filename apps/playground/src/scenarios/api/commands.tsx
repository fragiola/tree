import {
    type CommandResult,
    createTreeModel,
    type TreeJson,
} from "@fragiola/tree-react";
import { type RenameFeature, rename } from "@fragiola/tree-react/rename";
import {
    type SelectionFeature,
    selection,
} from "@fragiola/tree-react/selection";
import { useRef, useState } from "react";
import { StyledTree } from "../../fixture/styled";
import { useInspector } from "../../inspector/context";

// The commands, run through `model.run` as any consumer would: one button per common command, and
// the whole catalogue (`model.get("commands")`, what an assistant gets as tools) below. The
// Inspector is on: each click is one entry in its log, and the model JSON follows.

type Types = { items: { folder: undefined; file: undefined } };

const json: TreeJson<Types> = {
    version: 1,
    settings: { selectionMode: "multiple" },
    rootItemIds: ["src", "readme"],
    items: {
        src: { kind: "folder", label: "src", childItemIds: ["app", "lib"] },
        app: { kind: "file", label: "app.ts" },
        lib: { kind: "folder", label: "lib", childItemIds: ["util"] },
        util: { kind: "file", label: "util.ts" },
        readme: { kind: "file", label: "readme.md" },
    },
};

function describe(result: CommandResult<unknown>): string {
    return result.ok
        ? `ok ${JSON.stringify(result.value)}`
        : `${result.error.code}: ${result.error.message}`;
}

export default function CommandsScenario() {
    const [model] = useState(() =>
        createTreeModel<Types, readonly [SelectionFeature, RenameFeature]>(
            json,
            { features: [selection(), rename()] },
        ),
    );
    const added = useRef(0);
    const [last, setLast] = useState("");
    useInspector(model);

    const buttons: [string, () => CommandResult<unknown>][] = [
        ["Expand all", () => model.run("tree.expand-all", {})],
        ["Collapse all", () => model.run("tree.collapse-all", {})],
        ["Select all", () => model.run("tree.select-all", {})],
        [
            "Add file",
            () => {
                added.current += 1;
                return model.run("item.add", {
                    item: { kind: "file", label: `new-${added.current}.ts` },
                    to: { parentItemId: "src", index: 0 },
                });
            },
        ],
        [
            "Rename readme",
            () =>
                model.run("item.rename", {
                    itemId: "readme",
                    label: `${model.get("item-by", { id: "readme" })?.label ?? ""}*`,
                }),
        ],
        [
            "Move readme into src",
            () =>
                model.run("item.move", {
                    itemIds: ["readme"],
                    to: { parentItemId: "src", index: 0 },
                }),
        ],
        [
            "Expand src, then focus app (batch)",
            () =>
                model.run("batch", {
                    commands: [
                        { command: "item.expand", payload: { itemId: "src" } },
                        { command: "item.focus", payload: { itemId: "app" } },
                    ],
                }),
        ],
    ];

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
                {buttons.map(([name, run]) => (
                    <button
                        key={name}
                        type="button"
                        className="inline-flex h-8 items-center rounded-md border border-palette-line px-3 text-sm outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring"
                        onClick={() => setLast(`${name}: ${describe(run())}`)}
                    >
                        {name}
                    </button>
                ))}
                <output className="truncate text-xs text-palette-accent/85">
                    {last}
                </output>
            </div>
            <StyledTree<Types> model={model} />
            <details className="mx-4 mb-4 text-xs">
                <summary>{`${model.get("commands").length} commands`}</summary>
                <ul className="mt-2 flex flex-col gap-1">
                    {model.get("commands").map((command) => (
                        <li key={command.name}>
                            <code>{command.name}</code>
                            {` — ${command.description}`}
                        </li>
                    ))}
                </ul>
            </details>
        </div>
    );
}
