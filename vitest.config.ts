import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // each adapter Epic adds its packages, and the playground and examples apps their own
        projects: ["packages/*", "site"],
    },
});
