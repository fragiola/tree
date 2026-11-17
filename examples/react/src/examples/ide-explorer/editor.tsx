import { useTreeState } from "@fragiola/tree-react";
import { ChevronRight, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { FileIcon } from "./file-icon";
import { ancestorIds, CONTENTS } from "./project";
import * as styles from "./styles";
import type { EditorsStore, ProjectModel } from "./workspace";

/** The editor area: a tab per open file, the active file's path and its text. */
export function Editor({
    model,
    editors,
}: {
    model: ProjectModel;
    editors: EditorsStore;
}) {
    const { openFileIds, activeFileId } = useSyncExternalStore(
        editors.subscribe,
        editors.get,
        editors.get,
    );
    // the labels and the path come from the model: a rename or a move shows here at once
    const files = useTreeState(
        (_state, current) =>
            openFileIds.flatMap((id) => current.get("item-by", { id }) ?? []),
        { model },
    );
    const path = useTreeState(
        (_state, current) =>
            activeFileId === null
                ? []
                : [...ancestorIds(current, activeFileId), activeFileId].map(
                      (id) => ({
                          id,
                          label: current.get("item-by", { id })?.label ?? id,
                      }),
                  ),
        { model },
    );
    const text =
        activeFileId === null ? undefined : (CONTENTS[activeFileId] ?? "");
    return (
        <section aria-label="Editor" className={styles.editor}>
            <div
                role="tablist"
                aria-label="Open editors"
                className={styles.tabList}
            >
                {files.map((file) => (
                    <div
                        key={file.id}
                        data-active={file.id === activeFileId ? "" : undefined}
                        className={styles.tab}
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={file.id === activeFileId}
                            className={styles.tabButton}
                            onClick={() => editors.activate(file.id)}
                        >
                            <FileIcon item={file} model={model} />
                            {file.label}
                        </button>
                        <button
                            type="button"
                            aria-label={`Close ${file.label}`}
                            className={styles.tabClose}
                            onClick={() => editors.close(file.id)}
                        >
                            <X aria-hidden />
                        </button>
                    </div>
                ))}
            </div>
            {text === undefined ? (
                <p className={styles.empty}>
                    Select a file in the explorer to open it.
                </p>
            ) : (
                <>
                    <nav aria-label="Path" className={styles.breadcrumb}>
                        {path.map((crumb, index) => (
                            <span key={crumb.id} className={styles.crumb}>
                                {index > 0 && <ChevronRight aria-hidden />}
                                {crumb.label}
                            </span>
                        ))}
                    </nav>
                    <Code text={text} />
                </>
            )}
        </section>
    );
}

/** The file's text, read-only, with line numbers (an app mounts its editor here). */
function Code({ text }: { text: string }) {
    const lines = text === "" ? [""] : text.split("\n");
    return (
        <pre data-testid="code" className={styles.code}>
            {lines.map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a line is its position
                <span key={index} className={styles.line}>
                    <span aria-hidden className={styles.lineNumber}>
                        {index + 1}
                    </span>
                    <span>{line}</span>
                </span>
            ))}
        </pre>
    );
}
