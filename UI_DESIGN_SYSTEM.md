# Thần Mệnh — UI Design System

## Target and existing surfaces

**Ancient Bronze Fantasy UI**: restrained Đông Sơn borders, Chim Lạc accent, dark bronze/parchment, modern readable interaction. Ornament frames content; it cannot substitute for state/accessibility.

Initial source: canvas rectangles/circles, bronze rivets, Arial outlined labels in art.ts; Hud, TouchControls, PauseOverlay; six Village RPG tabs; MenuScene HTML controls/settings modal with focus styling in style.css. Source affordances are not verified mobile usability. SettingsModel initially persists mute only; graphics presets/reduced shake belong to coordinator's current work.

Style colors in VISUAL_STYLE_GUIDE.md. Proposed spacing 8px base, 16px panel inset, 8px row gap; existing layout need not be rewritten indiscriminately. Text 16–18px body, 20–24px headings at logical desktop scale, then verify actual CSS display size. Never rely on FIT scale to guarantee physical touch target size.

Same-day refresh: coordinator added separate GraphicsSettings storage, accessible Menu select/checkbox for Low/Medium/High/reduced motion and role=status persistence feedback. Source says apply next play session. SettingsModel mute is not the graphics store; future UI must preserve both keys. Model self-check passed, but browser interaction/safe-area approval remains open.

## Complete screen/state contracts

| Surface | Required content and states | Existing / remaining |
|---|---|---|
| Main Menu | Layered background, logo, New Game, Continue, Settings, Credits; disabled save, hover/press/focus, fade/loading | Menu and controls modal exist; dedicated premium logo/background/credits/settings presentation remains |
| Gameplay HUD | HP/MP/EXP, level/currency, four skill slots, cooldown/resource/lock feedback, quest tracker/toast | Bars/text/buttons exist; inspect complete information, overlap and truthful cooldown states |
| Boss HUD | Name, HP/shield, phase indication, encounter/defeat feedback | Boss health/labels source exists; approved layout across four bosses still pending |
| Inventory | Slots/icons, stack, categories, rarity border+symbol/label, tooltip, empty/full/error states | Inventory view/pagination exists; exported icons and cohesive slot visuals missing |
| Equipment | Weapon/armor/accessory slots, compare, equip/unequip, actual hero preview | Data transactions exist; weapon/body preview and world visuals missing |
| Skill Tree | Sơn/Hỏa/Thủy branches, nodes/connectors, locked/unlocked/equipped states, cost/prerequisite/cooldown tooltip, upgrade feedback | Skills list/pagination exists; list is not completed visual tree |
| Quest Journal | Region/chapter grouping, objective/progress, available/active/complete/reward states | Tab exists; complete catalog quest wiring is gameplay dependency |
| Dialogue | Portrait/name/box, optional text reveal/skip, choices, quest marker, interaction feedback | Three text-based NPC services exist; portraits and all fifteen NPC integrations missing |
| Shop | Item/icon/price/quantity, affordability, buy/sell confirmation, success/error | Model/tab transactions exist; coherent visual states and touch QA pending |
| Crafting/Upgrade | Material requirement/owned counts, result preview, confirm/cancel, success/failure/upgrade motion | Crafting tab/shared recipes exist; complete visual coverage pending |
| Pause/Settings | Resume, audio, controls, preset and reduced shake if implemented; persist/reset/close | Pause/mute/help exist; verify coordinator preset/shake wiring after settlement |
| Victory/Ending/GameOver | Chapter/reward/save feedback, continue/retry/menu, coherent art/transitions | Scenes exist; authored premium presentation and runtime flow review pending |
| Mobile Controls | Joystick, large attack, dodge, four skills and interact; active/cooldown/disabled states | Canvas controls exist; safe-area and physical-device ergonomics not approved |

All twelve skills and nine current items require distinctive icons linked to actual IDs in ASSET_INVENTORY.md. Future quest/rare items require new briefs; do not imply nonexistent catalog items are implemented.

## Interaction/accessibility rules

- Selected, focus, hover, pressed, disabled, locked, loading and error states differ without color alone. Keyboard focus remains visible; tooltip available by focus or tap, not hover only.
- Proposed minimum 44×44 CSS-pixel interactive target, measured after canvas scaling; ensure separation and no accidental joystick/skill overlap. Existing 44px logical buttons alone do not meet this test.
- Vietnamese strings must retain diacritics, readable line spacing and wrapping: test “Thần Mệnh”, “Thuồng Luồng Nhiễm Tà”, “Địa Chấn”, long NPC/quest names, numeric stacks/prices and maximum tooltip text.
- Aim for measured 4.5:1 body-text contrast and 3:1 large text/control boundaries; no compliance claim until contrast checked on rendered backgrounds.
- Rarity: common neutral, uncommon green, rare blue, epic purple, legendary gold plus shape/icon/label; item kind and rarity never conflated.
- Dialogue/menus lock world input only while intended; Escape/back closes topmost surface; restore focus, clear pointer on cancellation/blur, prevent click-through.
- Keep destructive purchases/upgrades clearly confirmed where appropriate; show missing resources and failure reasons without changing transaction semantics.
- Reduced-motion suppresses decorative zoom/shake/transitions, not critical warnings. No mandatory flicker to identify danger.

## Responsive and integration gate

Target landscape, including small 640×360 and larger 844×390/960×540 CSS viewports as test cases, not proof of supported devices. Account for notch/inset on Android/iOS, browser chrome and virtual keyboard. Portrait must offer a usable orientation notice or responsive fallback, not silently crop controls.

Preserve actual combat space, move modal content/pagination before shrinking text; avoid covering enemy warning zones with lower-right skill clusters. Safe-area padding must apply to both DOM overlays and scaled canvas controls.

Acceptance captures all table surfaces in relevant states, desktop keyboard/mouse and mobile touch; include empty inventory, full slots, insufficient materials/gold/MP, locked skills, long text, reload persistence and boss combat under open/closed UI. Visual snapshots and actual interactions required; existing model checks alone are insufficient. Evidence matrix in GRAPHICS_QA.md, sequencing in GRAPHICS_ROADMAP.md.
