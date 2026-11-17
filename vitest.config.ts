import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // the packages, the playground, the examples apps (and what they share) and the site
        projects: [
            "packages/*",
            "apps/playground",
            "examples/shared",
            "examples/react",
            "examples/vue",
            "examples/angular",
            "site",
        ],
    },
});
