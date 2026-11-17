// The IDE's demo content: a project as a tree document (JSON v1), each file's text, its git
// status, and the package manager's folder the app loads lazily. No tree assembly and no styles.
import type {
    LoadChildren,
    TreeItemJson,
    TreeJson,
    TreeModel,
    TreeState,
} from "@fragiola/tree-angular";

/** What git says about a file. */
export type GitStatus = "modified" | "added" | "untracked";

/** The project's registry: folders, and files that may carry a git status. */
export type ProjectTypes = {
    items: { folder: undefined; file: { status?: GitStatus } };
};

const file = (label: string, status?: GitStatus) => ({
    kind: "file" as const,
    label,
    data: status ? { status } : {},
});

const folder = (label: string, childItemIds: string[]) => ({
    kind: "folder" as const,
    label,
    childItemIds,
});

/** The project, `src` and its components open, several files selectable at once. */
export function project(): TreeJson<ProjectTypes> {
    return {
        version: 1,
        rootItemIds: [
            "github",
            "node-modules",
            "public",
            "src",
            "tests",
            "env",
            "gitignore",
            "package",
            "lock",
            "readme",
            "tsconfig",
            "vite-config",
        ],
        items: {
            github: folder(".github", ["workflows"]),
            workflows: folder("workflows", ["ci"]),
            ci: file("ci.yml"),
            // the package manager's folder: read-only, its content listed only when it is opened
            "node-modules": {
                kind: "folder",
                label: "node_modules",
                childrenStatus: "unloaded",
                droppable: false,
                movable: false,
                renamable: false,
            },
            public: folder("public", ["favicon", "logo"]),
            favicon: file("favicon.svg"),
            logo: file("logo.png"),
            src: folder("src", [
                "components",
                "hooks",
                "styles",
                "app",
                "main",
                "env-d",
            ]),
            components: folder("components", ["button", "tree-view", "tabs"]),
            button: file("button.tsx", "added"),
            "tree-view": file("tree-view.tsx", "modified"),
            tabs: file("tabs.tsx"),
            hooks: folder("hooks", ["use-theme"]),
            "use-theme": file("use-theme.ts", "untracked"),
            styles: folder("styles", ["global-css"]),
            "global-css": file("global.css"),
            app: file("app.tsx", "modified"),
            main: file("main.tsx"),
            "env-d": file("env.d.ts"),
            tests: folder("tests", ["app-test", "setup"]),
            "app-test": file("app.test.tsx"),
            setup: file("setup.ts", "untracked"),
            env: file(".env.local"),
            gitignore: file(".gitignore"),
            package: file("package.json", "modified"),
            lock: file("pnpm-lock.yaml"),
            readme: file("README.md"),
            tsconfig: file("tsconfig.json"),
            "vite-config": file("vite.config.ts"),
        },
        expandedItemIds: ["src", "components"],
        // the file the editor opens with
        selectedItemIds: ["app"],
        settings: { selectionMode: "multiple" },
    };
}

/** The files' text, by item id: an app reads it from disk. A new file starts empty. */
export const CONTENTS: Readonly<Record<string, string>> = {
    ci: "name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: pnpm install\n      - run: pnpm test",
    button: 'export function Button(props: ButtonProps) {\n    return <button type="button" {...props} />;\n}',
    "tree-view":
        'import { Tree } from "@fragiola/tree-angular";\n\nexport function TreeView({ json }: { json: TreeJson }) {\n    return (\n        <Tree.Root defaultTree={json} aria-label="Files">\n            <Tree.Items>{(item) => <Row item={item} />}</Tree.Items>\n        </Tree.Root>\n    );\n}',
    tabs: 'export function Tabs({ children }: { children: ReactNode }) {\n    return <div role="tablist">{children}</div>;\n}',
    "use-theme":
        'export function useTheme() {\n    const [theme, setTheme] = useState<"light" | "dark">("light");\n    return { theme, toggle: () => setTheme((t) => (t === "light" ? "dark" : "light")) };\n}',
    "global-css":
        '@import "tailwindcss";\n\nbody {\n    margin: 0;\n    font-family: system-ui, sans-serif;\n}',
    app: 'import { TreeView } from "./components/tree-view";\nimport { project } from "./project";\n\nexport function App() {\n    return <TreeView json={project()} />;\n}',
    main: 'import { createRoot } from "react-dom/client";\nimport { App } from "./app";\n\ncreateRoot(document.getElementById("root")!).render(<App />);',
    "env-d": '/// <reference types="vite/client" />',
    "app-test":
        'import { render, screen } from "@testing-library/react";\nimport { App } from "../src/app";\n\ntest("renders the files", () => {\n    render(<App />);\n    expect(screen.getByRole("tree")).toBeVisible();\n});',
    setup: 'import "@testing-library/jest-dom/vitest";',
    env: "VITE_API_URL=http://localhost:3000",
    gitignore: "node_modules\ndist\n.env.local",
    package:
        '{\n    "name": "fragiola-app",\n    "type": "module",\n    "scripts": {\n        "dev": "vite",\n        "build": "vite build",\n        "test": "vitest"\n    },\n    "dependencies": {\n        "@fragiola/tree-angular": "0.1.0",\n        "react": "19.2.0"\n    }\n}',
    lock: "lockfileVersion: '9.0'\n\nimporters:\n  .:\n    dependencies:\n      react:\n        specifier: 19.2.0",
    readme: "# fragiola-app\n\nA file explorer built with Fragiola Tree.\n\n## Scripts\n\n- `pnpm dev`\n- `pnpm test`",
    tsconfig:
        '{\n    "compilerOptions": {\n        "strict": true,\n        "jsx": "react-jsx",\n        "module": "ESNext"\n    }\n}',
    "vite-config":
        'import react from "@vitejs/plugin-react";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({ plugins: [react()] });',
};

/** What the package manager installed, by folder: node_modules lists packages, a package its files. */
const PACKAGES = ["@fragiola", "react", "react-dom", "typescript", "vite"];
const SCOPED: Record<string, string[]> = {
    "@fragiola": ["tree", "tree-react"],
};

/** The item JSON of a read-only folder or file under node_modules (nothing there moves or renames). */
const readOnly = (
    id: string,
    label: string,
    kind: "folder" | "file",
): TreeItemJson<ProjectTypes> =>
    kind === "folder"
        ? {
              id,
              kind,
              label,
              childrenStatus: "unloaded",
              droppable: false,
              movable: false,
              renamable: false,
          }
        : { id, kind, label, data: {}, movable: false, renamable: false };

/**
 * The app's `loadChildren`: an editor lists node_modules from disk when it is opened; this fake
 * answers after `latency` ms. A scope lists its packages, a package its files.
 */
export function createPackageLoader(latency = 400): LoadChildren<ProjectTypes> {
    return (item, { signal }) =>
        new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (item.id === "node-modules") {
                    resolve(
                        PACKAGES.map((name) =>
                            readOnly(`node-modules/${name}`, name, "folder"),
                        ),
                    );
                    return;
                }
                const name = item.id.slice("node-modules/".length);
                const scoped = SCOPED[name];
                resolve(
                    scoped
                        ? scoped.map((child) =>
                              readOnly(`${item.id}/${child}`, child, "folder"),
                          )
                        : ["package.json", "index.js", "README.md"].map(
                              (child) =>
                                  readOnly(
                                      `${item.id}/${child}`,
                                      child,
                                      "file",
                                  ),
                          ),
                );
            }, latency);
            signal.addEventListener("abort", () => {
                clearTimeout(timer);
                reject(signal.reason);
            });
        });
}

/** The ids of an item's ancestors, from the root down. */
export function ancestorIds(
    model: TreeModel<ProjectTypes>,
    itemId: string,
): string[] {
    const ids: string[] = [];
    let parent = model.get("item-parent-by", { itemId });
    while (parent) {
        ids.unshift(parent.id);
        parent = model.get("item-parent-by", { itemId: parent.id });
    }
    return ids;
}

/** Whether an item is node_modules or inside it: the package manager's, never the app's to edit. */
export function isManaged(model: TreeModel<ProjectTypes>, itemId: string) {
    return (
        itemId === "node-modules" ||
        model.is("item-descendant-of", {
            itemId,
            ancestorItemId: "node-modules",
        })
    );
}

/** The git summary of one state of the tree: the folders holding a change, and the counts. */
export interface GitSummary {
    changedFolderIds: ReadonlySet<string>;
    counts: Readonly<Record<GitStatus, number>>;
}

// The summary is derived from the model, never stored twice: computed once per state (a state is
// frozen, and every command makes a new one), whatever number of rows read it.
const summaries = new WeakMap<TreeState<ProjectTypes>, GitSummary>();

/** The git summary of the model's current state. */
export function gitSummary(model: TreeModel<ProjectTypes>): GitSummary {
    const cached = summaries.get(model.state);
    if (cached) return cached;
    const changedFolderIds = new Set<string>();
    const counts: Record<GitStatus, number> = {
        modified: 0,
        added: 0,
        untracked: 0,
    };
    for (const item of Object.values(model.state.items)) {
        if (item.kind !== "file" || !item.data.status) continue;
        counts[item.data.status]++;
        for (const folderId of ancestorIds(model, item.id))
            changedFolderIds.add(folderId);
    }
    const summary = { changedFolderIds, counts };
    summaries.set(model.state, summary);
    return summary;
}

/** The letter an editor shows for a status. */
export const STATUS_LETTERS: Record<GitStatus, string> = {
    modified: "M",
    added: "A",
    untracked: "U",
};

/** A label no sibling of `parentItemId` has yet: `untitled.ts`, `untitled-1.ts`, … */
export function freeLabel(
    model: TreeModel<ProjectTypes>,
    parentItemId: string | null,
    base: string,
    extension = "",
) {
    const siblings =
        parentItemId === null
            ? model.get("root-items")
            : model.get("child-items-by", { itemId: parentItemId });
    const taken = new Set(siblings.map((item) => item.label.toLowerCase()));
    for (let n = 0; ; n++) {
        const label = `${base}${n === 0 ? "" : `-${n}`}${extension}`;
        if (!taken.has(label.toLowerCase())) return label;
    }
}

/** What a file holds, by its name: it picks the file's icon and colour. */
export type FileKind =
    | "code"
    | "data"
    | "style"
    | "image"
    | "config"
    | "secret"
    | "lock"
    | "text";

const FILE_KINDS: Record<string, FileKind> = {
    ts: "code",
    tsx: "code",
    js: "code",
    json: "data",
    yml: "data",
    yaml: "data",
    css: "style",
    svg: "image",
    png: "image",
    md: "text",
};

/** A file's kind: dotfiles are config (`.env*` a secret), lockfiles locks, the rest by extension. */
export function fileKindOf(label: string): FileKind {
    if (label.startsWith(".env")) return "secret";
    if (label.endsWith("-lock.yaml") || label.endsWith(".lock")) return "lock";
    if (label.startsWith(".") || /\.config\.[jt]s$/.test(label))
        return "config";
    return FILE_KINDS[label.split(".").pop() ?? ""] ?? "text";
}

/** The folders an editor draws with their own icon, by name. */
export type FolderKind = "plain" | "source" | "tests" | "git" | "managed";

export function folderKindOf(label: string): FolderKind {
    if (label === "src") return "source";
    if (label === "tests") return "tests";
    if (label === ".github") return "git";
    if (label === "node_modules") return "managed";
    return "plain";
}
