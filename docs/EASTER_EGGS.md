# Easter eggs

Hidden interactions in the Babylon environment. Discoveries persist in `localStorage` under `babel.easterEggs.v1`.

> **Spoilers.** This document lists every egg, how to trigger it, and what it unlocks. Skip it if you want to find them yourself.

## Catalog

Source of truth: `src/lib/easterEggs/catalog.js`. Discovery store: `src/lib/easterEggs/discoveryStore.js`.

| Id | Name | How to find it |
| --- | --- | --- |
| `creator-portrait` | Creator portrait | Click the portrait hotspot on the Babylon background (profile card for Leen Al-Zu'bi). |
| `cat-portrait` | Cat portrait | Click the cat circle beside the creator portrait (shows the Builder's note). |
| `tablet-gate` | Clay tablet near the gate | On the **Debate** tab, click the clay tablet near the gate. |
| `tablet-water` | Clay tablet near the water | On the **Findings** tab, click the clay tablet near the water. |
| `tablet-palms` | Clay tablet among the palms | On the **Method** tab (or Lab, when enabled), click the clay tablet among the palms. |
| `gate-completion` | Gate after a completed debate | Finish a debate on **Debate**, then click the lit / completion gate hotspot. |
| `lineage-mode` | Lineage view | Triple-click the **Babel** wordmark in the top bar within about 2 seconds. |
| `trash-archive` | Trash | Open **Trash** from the side shortcuts (desktop) or the trash control in the shell. |

Hotspots live in `src/components/easterEggs/EnvironmentEasterEggs.jsx` and open through the shared `EasterEgg` component.

## What each egg does

### Environment tablets and portrait

Opening a tablet, the creator portrait, or the cat portrait marks that id as discovered and shows a short card (inscription, creator profile, or Builder's note). Tablet copy:

| Id | Inscription |
| --- | --- |
| `tablet-gate` | Agreement is not evidence of truth. |
| `tablet-water` | Partial failure is still a result. |
| `tablet-palms` | The minority report was not lost. It was merely harder to find. |
| `gate-completion` | The gate opened. The question did not close. |

### Lineage view

Triple-clicking the wordmark unlocks lineage mode and toggles `data-lineage-mode` on the document. In that mode, synthesis findings and claim chips emphasize inspectable lineage. Click the wordmark again while lineage is active to exit (and return home to Debate).

Implementation: `GlobalNav.jsx` (triple-click), `App.jsx` (document attribute).

### Trash

Opening Trash marks `trash-archive` discovered and shows a small desktop window with remnant files that cannot be opened (each attempt shows an error). Files are intentional dead ends (`TrashWindow.jsx`).

### Archive unlock

After **3** distinct discoveries (`ARCHIVE_UNLOCK_COUNT`), the Archive unlocks.

- A short notice appears: “Archive unlocked” (with an Open Archive action).
- Route `/archive` becomes reachable (`ArchivePanel`); visiting Archive without the unlock redirects away.

Archive copy is editorial product history from `ARCHIVE_CONTENT` in the catalog (not invented chronology).

## Persistence

```text
localStorage key: babel.easterEggs.v1
shape: {
  discovered: string[],          // known EasterEggId values only
  archiveUnlocked: boolean,      // true when discovered.length >= 3
  archiveNoticePending: boolean  // one-shot unlock toast
}
```

Invalid or unknown ids are stripped on read. Clearing site data resets discoveries.

## Adding an egg

1. Add an id to `EASTER_EGG_IDS` and `EASTER_EGG_META` in `catalog.js`.
2. Wire a trigger that calls `markEasterEggDiscovered(id)` (or `discover(id)` from `useEasterEggDiscovery`).
3. Prefer the shared `EasterEgg` hotspot for environment spots.
4. Extend `discoveryStore.test.js` if unlock rules change.
5. Update this doc.

## Related UI

| Surface | Role |
| --- | --- |
| `EnvironmentEasterEggs.jsx` | Portrait, cat, tablets, gate completion |
| `GlobalNav.jsx` | Lineage triple-click |
| `TrashTrigger.jsx` / `TrashWindow.jsx` | Trash shell + window |
| `ArchivePanel.jsx` | Unlocked archive page |
| `LineageModeNotice.jsx` / `ArchiveUnlockedNotice.jsx` | Unlock toasts |
