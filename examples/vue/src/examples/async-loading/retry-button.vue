<script setup lang="ts">
import { useTree } from "@fragiola/tree-vue";
import { CircleAlert, RotateCcw } from "@lucide/vue";
import { Clickable } from "#/components/atoms/clickable";
import type { FileTypes } from "../_kit/data";
import * as styles from "./styles";

/** A failed load stays `error` until the app loads it again: a screen action of the engine. */
const props = defineProps<{ itemId: string; label: string }>();
const { engine } = useTree<FileTypes>();
</script>

<template>
    <span :class="styles.error">
        <CircleAlert aria-hidden="true" :class="styles.errorIcon" />
        <Clickable.Button
            variant="ghost"
            size="sm"
            :class="styles.retry"
            :aria-label="`Retry loading ${label}`"
            @click="engine.run('load-children', { itemId: props.itemId })"
        >
            <RotateCcw aria-hidden="true" />
            Retry
        </Clickable.Button>
    </span>
</template>
