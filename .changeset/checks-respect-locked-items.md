---
"@fragiola/tree": patch
---

In `cascade` mode, checking or unchecking an item leaves its disabled descendants, and what is under them, as they are, so an action locked as granted stays checked when its parent is unchecked. `item.toggle-check` on a parent unchecks it when every item the cascade reaches is checked, even when a disabled descendant keeps it `mixed`, and checks it otherwise. A controlled `checkedItemIds` that drops a parent the cascade had checked now keeps the children it still lists.
