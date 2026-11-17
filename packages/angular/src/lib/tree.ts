import { TreeCheckboxDirective } from "./directives/checkbox.directive";
import { TreeDropIndicatorDirective } from "./directives/drop-indicator.directive";
import { TreeGroupDirective } from "./directives/group.directive";
import { TreeItemDirective } from "./directives/item.directive";
import { TreeItemContentDirective } from "./directives/item-content.directive";
import { TreeItemsDirective } from "./directives/items.directive";
import { TreeLiveRegionDirective } from "./directives/live-region.directive";
import { TreeRenameInputDirective } from "./directives/rename-input.directive";
import { TreeRootDirective } from "./directives/root.directive";
import { TreeToggleDirective } from "./directives/toggle.directive";

/**
 * Every Tree directive, for a standalone component's `imports`:
 * `@Component({ imports: [TREE], … })`.
 */
export const TREE = [
    TreeRootDirective,
    TreeItemsDirective,
    TreeItemDirective,
    TreeItemContentDirective,
    TreeGroupDirective,
    TreeToggleDirective,
    TreeCheckboxDirective,
    TreeRenameInputDirective,
    TreeDropIndicatorDirective,
    TreeLiveRegionDirective,
] as const;
