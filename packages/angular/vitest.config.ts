import angular from "@analogjs/vite-plugin-angular";
import { defaultClientConditions, type Plugin, transformWithOxc } from "vite";
import { defineProject } from "vitest/config";
import { withSourceCondition } from "../../scripts/source-condition.ts";

/**
 * The React adapter's sources (`.tsx`), which the parity test renders: the Angular plugin
 * transforms TypeScript itself and leaves them alone, so Oxc strips their types and JSX here.
 */
function reactSources(): Plugin {
    return {
        name: "react-sources",
        async transform(code, id) {
            if (!id.endsWith(".tsx")) return undefined;
            const result = await transformWithOxc(code, id, {
                lang: "tsx",
                jsx: { runtime: "automatic" },
            });
            return { code: result.code, map: result.map };
        },
    };
}

export default defineProject({
    // the directives compiled by the Angular compiler (TypeScript 6.0.3, this package's); the React
    // adapter the parity test renders (from its sources) is Vite's to transform
    plugins: [
        angular({
            tsconfig: "tsconfig.spec.json",
            transformFilter: (_code, id) => !id.endsWith(".tsx"),
        }),
        reactSources(),
    ],
    // the core from its sources (the source export condition), not its dist
    resolve: { conditions: withSourceCondition(defaultClientConditions) },
    test: {
        name: "angular",
        environment: "jsdom",
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
    },
});
