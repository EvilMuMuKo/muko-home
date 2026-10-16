# Equipment and accessory reconciliation

This review checks current rendered objects and their ownership rather than treating every legacy source definition as visible furniture.

## Plan and decisions

| Previous arrangement | Final arrangement | Verification |
|---|---|---|
| Fixed TV, receiver furniture, old screen wash | Lockable mobile TV stand with console shelf, secured rear power-pack support and internal cable run. Old wall screen-wash fixture and per-scene overrides removed. | Live object inventory, full movement states and light configuration |
| Two abstract controllers floating above PS5 | Two modeled controllers supported by separate charging bases on the trolley shelf. PS5 no longer contains controller geometry. | Shelf support and footprint checks; controller/console/power-pack parent and pose checks |
| TV console and upper media cabinet | Retained as peripheral daily storage for books, game cases, light board games, organizing boxes and portable charging items. TV and PS5 are not assigned to them. | Explicit purpose metadata, low tray supported by the cabinet, updated labels |
| Fixed media wall frame | The old salon architecture function is not called in the current renderer; its import is removed. No wall frame is generated. | Actual rendered inventory checks for media piers/crown |
| Rear storage, old coffee table, old gate panel, entry display/hooks, laundry folding unit | Removed in the selected layout; the replacement pegboards, pullout and laundry basket remain. | Final model and rendered-object absence checks; corrected added/removed storage ledger |
| Old flip-up hatch tray/stool/stop | Empty or hidden compatibility references only. | No visible mesh in obsolete parts; pullout travel remains independently checked |

## Scope

The trolley shelf and accessory geometry are concept dimensions inside the existing stand footprint. Power is disconnected before relocation; the model does not show a live wall cable stretched across a route. Selected stand load, VESA, tip resistance, PS5 installation clearances, charging compatibility and real sockets require product/site confirmation. The existing cabinet's ID is retained for API compatibility, but its name and assigned use now describe daily storage.
