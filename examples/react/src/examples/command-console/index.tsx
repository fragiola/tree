"use client";

import {
    type CommandResult,
    createTreeModel,
    type ItemOf,
    Tree,
    veto,
} from "@fragiola/tree-react";
import { rename } from "@fragiola/tree-react/rename";
import { selection } from "@fragiola/tree-react/selection";
import { ChevronRight, File, Folder, Play } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { type FileTypes, fileSystem } from "../_kit/data";
import * as styles from "./styles";

/** The opt-in features of the model: the selection and the rename (`item.rename`). */
const features = [selection(), rename()] as const;

// An assistant, a script or a remote control drives the tree with the same JSON commands a key
// or a click runs: `model.get("commands")` describes each one (its JSON Schemas are ready to be
// tool definitions), and `model.dispatch` validates untrusted input before running it.

const PRESETS: readonly { name: string; input: unknown }[] = [
    { name: "Expand all", input: { command: "tree.expand-all", payload: {} } },
    {
        name: "Select README.md",
        input: { command: "item.select", payload: { itemId: "readme" } },
    },
    {
        name: "Rename app.tsx",
        input: {
            command: "item.rename",
            payload: { itemId: "app", label: "root.tsx" },
        },
    },
    {
        name: "Move README.md into src",
        input: {
            command: "item.move",
            payload: {
                itemIds: ["readme"],
                to: { parentItemId: "src", index: 0 },
            },
        },
    },
    {
        name: "Delete README.md",
        input: { command: "item.remove", payload: { itemIds: ["readme"] } },
    },
];

const format = (value: unknown) => JSON.stringify(value, null, 2);

type Outcome =
    | { status: "ok"; text: string }
    | { status: "error"; text: string }
    | undefined;

function outcomeOf(result: CommandResult<unknown>): Outcome {
    return result.ok
        ? { status: "ok", text: format(result.value) }
        : { status: "error", text: format(result.error) };
}

export default function CommandConsole() {
    const [model] = useState(() =>
        createTreeModel<FileTypes, typeof features>(fileSystem(), { features }),
    );
    const [text, setText] = useState(() => format(PRESETS[0]?.input));
    const [outcome, setOutcome] = useState<Outcome>();
    const inputId = useId();

    // the app's policy for what it did not type itself: `meta` comes from the app, never from
    // the untrusted input, so a middleware can trust it
    useEffect(
        () =>
            model.use((ctx, next) =>
                ctx.meta?.source === "console" && ctx.command === "item.remove"
                    ? veto("The console may not delete items.")
                    : next(),
            ),
        [model],
    );

    const run = (input: string) => {
        let parsed: unknown;
        try {
            parsed = JSON.parse(input);
        } catch (error) {
            setOutcome({
                status: "error",
                text: `Invalid JSON: ${String(error)}`,
            });
            return;
        }
        setOutcome(
            outcomeOf(model.dispatch(parsed, { meta: { source: "console" } })),
        );
    };

    return (
        <div className={styles.frame}>
            <Tree.Root<FileTypes, typeof features>
                model={model}
                aria-label="Project files"
                className={styles.root}
            >
                <Tree.Items<FileTypes>>
                    {(item) => <FileItem item={item} />}
                </Tree.Items>
            </Tree.Root>
            <section aria-label="Command console" className={styles.panel}>
                <div className={styles.presets}>
                    {PRESETS.map((preset) => (
                        <Clickable.Button
                            key={preset.name}
                            variant="outline"
                            size="sm"
                            className={styles.preset}
                            onClick={() => {
                                const input = format(preset.input);
                                setText(input);
                                run(input);
                            }}
                        >
                            {preset.name}
                        </Clickable.Button>
                    ))}
                </div>
                <label htmlFor={inputId} className={styles.inputLabel}>
                    Command (JSON)
                </label>
                <textarea
                    id={inputId}
                    value={text}
                    spellCheck={false}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                        if (
                            event.key === "Enter" &&
                            (event.ctrlKey || event.metaKey)
                        ) {
                            event.preventDefault();
                            run(text);
                        }
                    }}
                    className={styles.input}
                />
                <div className={styles.runRow}>
                    <span className={styles.runHint}>Ctrl/⌘ + Enter</span>
                    <Clickable.Button
                        size="sm"
                        className={styles.dispatch}
                        onClick={() => run(text)}
                    >
                        <Play aria-hidden />
                        Dispatch
                    </Clickable.Button>
                </div>
                <output
                    aria-live="polite"
                    data-testid="console-result"
                    data-status={outcome?.status}
                    className={styles.result(outcome?.status)}
                >
                    {outcome ? outcome.text : "The result shows here."}
                </output>
                <details className={styles.commands}>
                    <summary className={styles.commandsSummary}>
                        {`Every command (${model.get("commands").length})`}
                    </summary>
                    <dl className={styles.commandList}>
                        {model.get("commands").map((command) => (
                            <div key={command.name} className={styles.command}>
                                <dt className={styles.commandName}>
                                    {command.name}
                                </dt>
                                <dd className={styles.commandDescription}>
                                    {command.description}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </details>
            </section>
        </div>
    );
}

function FileItem({ item }: { item: ItemOf<FileTypes> }) {
    return (
        <Tree.Item item={item} className={styles.item}>
            <Tree.ItemContent className={styles.row}>
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                {item.kind === "folder" ? (
                    <Folder aria-hidden className={styles.folderIcon} />
                ) : (
                    <File aria-hidden className={styles.fileIcon} />
                )}
                <span className={styles.label}>{item.label}</span>
            </Tree.ItemContent>
            <Tree.Group<FileTypes>>
                {(child) => <FileItem item={child} />}
            </Tree.Group>
        </Tree.Item>
    );
}
