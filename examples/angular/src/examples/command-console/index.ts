import { Component, DestroyRef, inject, signal } from "@angular/core";
import {
    type CommandResult,
    createTreeModel,
    TREE,
    veto,
} from "@fragiola/tree-angular";
import { selection } from "@fragiola/tree-angular/selection";
import {
    LucideChevronRight,
    LucideFile,
    LucideFolder,
    LucidePlay,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { type FileTypes, fileSystem } from "../_kit/data";
import * as styles from "./styles";

/** The opt-in features of the model: the selection. */
const features = [selection()] as const;

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

let nextId = 0;

@Component({
    selector: "example-command-console",
    imports: [
        TREE,
        ClickableButton,
        LucideChevronRight,
        LucideFile,
        LucideFolder,
        LucidePlay,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [treeRoot]="model" aria-label="Project files" [class]="styles.root">
                <ng-template [treeItems]="model" let-item>
                    <div [treeItem]="item" [class]="styles.item">
                        <div treeItemContent [class]="styles.row">
                            <span treeToggle [class]="styles.toggle">
                                <svg lucideChevronRight aria-hidden="true"></svg>
                            </span>
                            @if (item.kind === "folder") {
                                <svg lucideFolder aria-hidden="true" [class]="styles.folderIcon"></svg>
                            } @else {
                                <svg lucideFile aria-hidden="true" [class]="styles.fileIcon"></svg>
                            }
                            <span [class]="styles.label">{{ item.label }}</span>
                        </div>
                        <div treeGroup></div>
                    </div>
                </ng-template>
            </div>
            <section aria-label="Command console" [class]="styles.panel">
                <div [class]="styles.presets">
                    @for (preset of presets; track preset.name) {
                        <button kitClickable variant="outline" size="sm" [class]="styles.preset" (click)="runPreset(preset)">
                            {{ preset.name }}
                        </button>
                    }
                </div>
                <label [for]="inputId" [class]="styles.inputLabel">Command (JSON)</label>
                <textarea
                    #input
                    [id]="inputId"
                    [value]="text()"
                    spellcheck="false"
                    [class]="styles.input"
                    (input)="text.set(input.value)"
                    (keydown)="onKeyDown($event)"
                ></textarea>
                <div [class]="styles.runRow">
                    <span [class]="styles.runHint">Ctrl/⌘ + Enter</span>
                    <button kitClickable size="sm" [class]="styles.dispatch" (click)="run(text())">
                        <svg lucidePlay aria-hidden="true"></svg>
                        Dispatch
                    </button>
                </div>
                <output
                    aria-live="polite"
                    data-testid="console-result"
                    [attr.data-status]="outcome()?.status"
                    [class]="styles.result(outcome()?.status)"
                >{{ outcome()?.text ?? "The result shows here." }}</output>
                <details [class]="styles.commands">
                    <summary [class]="styles.commandsSummary">Every command ({{ commands.length }})</summary>
                    <dl [class]="styles.commandList">
                        @for (command of commands; track command.name) {
                            <div [class]="styles.command">
                                <dt [class]="styles.commandName">{{ command.name }}</dt>
                                <dd [class]="styles.commandDescription">{{ command.description }}</dd>
                            </div>
                        }
                    </dl>
                </details>
            </section>
        </div>
    `,
})
export default class CommandConsole {
    protected readonly styles = styles;
    protected readonly presets = PRESETS;
    protected readonly model = createTreeModel<FileTypes, typeof features>(
        fileSystem(),
        { features },
    );
    protected readonly commands = this.model.get("commands");
    protected readonly text = signal(format(PRESETS[0]?.input));
    protected readonly outcome = signal<Outcome>(undefined);
    protected readonly inputId = `command-console-input-${nextId++}`;

    constructor() {
        // the app's policy for what it did not type itself: `meta` comes from the app, never from
        // the untrusted input, so a middleware can trust it
        inject(DestroyRef).onDestroy(
            this.model.use((ctx, next) =>
                ctx.meta?.source === "console" && ctx.command === "item.remove"
                    ? veto("The console may not delete items.")
                    : next(),
            ),
        );
    }

    protected run(input: string): void {
        let parsed: unknown;
        try {
            parsed = JSON.parse(input);
        } catch (error) {
            this.outcome.set({
                status: "error",
                text: `Invalid JSON: ${String(error)}`,
            });
            return;
        }
        this.outcome.set(
            outcomeOf(
                this.model.dispatch(parsed, { meta: { source: "console" } }),
            ),
        );
    }

    protected runPreset(preset: (typeof PRESETS)[number]): void {
        const input = format(preset.input);
        this.text.set(input);
        this.run(input);
    }

    protected onKeyDown(event: KeyboardEvent): void {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            this.run(this.text());
        }
    }
}
