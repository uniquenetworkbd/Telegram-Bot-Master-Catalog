# Phase 4B — Interactive Flow Specification

This document defines observable behavior for the six-page prototype. It is an interaction contract, not a claim that every future production feature exists.

## 1. Global navigation contract

| Trigger | Expected behavior | State requirement |
|---|---|---|
| Home | Show Home and mark Home active | Preserve other page state |
| Dashboard | Show dataset-derived analytics | Do not invent live metrics |
| Bot Catalog | Show catalog controls and current result set | Restore saved catalog state when returning |
| Bot Details | Show the selected Bot ID record | Selected ID must resolve to a real loaded record |
| Admin Profile | Show read-only project metadata | No admin controls or secrets |
| System | Show theme, runtime checks, and implementation boundaries | Theme change must not reset navigation state |
| Browser Back | Return to the previous route/state | Catalog query/filter/page/scroll should be restored where available |
| Browser Forward | Restore the forward route | Do not silently discard route state |
| Android Back / browser-equivalent | Follow browser history rather than forcing Home | More menu state is restored where supported |

### Route contract

Valid logical routes are `home`, `dashboard`, `catalog`, `bot`, `profile`, and `system`. Unknown routes resolve safely to Home rather than rendering an undefined screen.

## 2. Home interaction contract

### Quick search

If a future Home quick-search control is added, submission must navigate to `catalog` with the same query. It must not maintain a second independent search engine.

### Browse Catalog

Tap/click → `catalog`. No data mutation.

### Dashboard / quick links

Tap/click → the selected route. The destination becomes active and the More menu closes when applicable.

## 3. Dashboard contract

- Statistics are derived from the loaded catalog dataset.
- Category distribution is derived from category values in the loaded records.
- Automation distribution is derived from the source labels.
- Dashboard does not claim API availability, business demand, or real-time monitoring.
- If the dataset is unavailable, the UI must expose an unavailable/error state rather than zero-as-success.

## 4. Bot Catalog contract

### Search

- Input is applied to the loaded record fields.
- Search is case-insensitive.
- Search does not call an external API.
- Query changes reset pagination to page 1.

### Category filter

- Options come from categories actually found in the loaded dataset.
- Selecting a category narrows the current result set.
- Clearing the category returns to all categories.

### API filter

- `API required` selects records whose source label indicates a required API.
- `No / optional` selects records not classified as required.
- The filter must not infer a specific third-party API provider.

### Automation filter

- Filter values correspond to source labels.
- No new automation rating is invented by the UI.

### Reset filters

Tap/click → clear search and all filter controls, then render the first page.

### Page size / pagination

- Page size is user-selectable from the provided options.
- Changing page size returns to page 1.
- Previous is disabled on the first page.
- Next is disabled on the final page.
- Empty result sets display an explicit empty state.

### Bot Card / record selection

Selecting a record stores its stable Bot ID and opens Bot Details. The UI must not use array position as the long-term identity.

### Export

Export uses the current filtered result set and creates a browser CSV download. It does not imply server-side storage or synchronization.

## 5. Bot Details contract

- A valid Bot ID renders the matching loaded record.
- Missing/unknown IDs render a safe Not Found/No Selection state.
- Details are read-only in this prototype.
- Returning to Catalog restores the last known query/filter/page/scroll state when that state exists.
- A related-bot feature, if introduced later, must preserve a stack or explicit return target so nested details do not lose context.

## 6. More menu contract

Mobile primary navigation contains Home, Dashboard, Catalog, and More.

More opens a menu containing Bot Details, Admin Profile, and System. Opening a More destination records the route needed to restore the menu context where browser history supports it. Escape closes the menu.

The More menu is navigation only; it is not an admin command panel.

## 7. Theme contract

Allowed values:

- `system` — follow OS/browser preference;
- `light` — force light theme;
- `dark` — force dark theme.

Changing theme must update the complete application shell and page UI without changing the active route, selected Bot ID, catalog query, filters, page, or other non-theme state.

Preference persistence is best-effort browser storage. If storage is restricted, the theme control remains usable for the current session and the System page reports the limitation honestly.

## 8. Loading / Empty / Error / Not Found / Partial

| State | Meaning | UI behavior |
|---|---|---|
| Loading | Data/action has not completed | Show progress/waiting copy; do not present fake success |
| Empty | Valid data source, zero matching results | Explain that no records match and offer reset/change filters |
| Error | Required operation failed | Explain the failed operation and offer a safe retry/recovery action |
| Not Found | Requested Bot ID is not present | Show record-not-found state and return-to-catalog action |
| Partial / Review | Data loaded but validation found quality concerns | Keep usable data visible and identify the concern explicitly |
| Success / Healthy | Expected capability is available | Show the verified capability and scope |

These states must remain visually distinguishable. An empty result is not a data-loading failure.

## 9. Recovery contract

### CSV load failure

1. Keep navigation available.
2. Mark dataset status unavailable.
3. Disable or fail safely any action that requires records.
4. Provide a recheck action.
5. Do not display invented statistics.

### Filter failure

Reset to a safe empty/default filter state and keep the catalog route usable.

### Theme storage failure

Continue with session-only theme behavior and report the persistence limitation.

### Invalid route

Resolve to Home or the nearest safe route; never execute arbitrary code from a URL fragment.

## 10. Accessibility and one-hand contract

- Interactive targets should remain approximately 44–48px where practical.
- Bottom navigation must account for safe-area/gesture insets.
- Focus-visible outlines must remain available for keyboard users.
- Text and badges must wrap or reflow instead of clipping on narrow screens.
- Primary actions should remain reachable without requiring precision taps.

## 11. State model

Minimum cross-screen state:

```text
route
selectedBotId
catalog.query
catalog.category
catalog.api
catalog.automation
catalog.page
catalog.pageSize
catalog.scrollY
theme
moreMenu.open
runtime.lastChecked
runtime.status
catalog.status
```

Only state with a clear ownership need should be persisted. Catalog state may be kept as navigation/session state; theme preference may be persisted locally. Sensitive credentials must never be stored by this prototype.
