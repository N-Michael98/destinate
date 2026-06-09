# V15.B.18 Mission Control Alert Engine Consolidation

## Goal

Connect Mission Control Alert Layer to the live alert source mapping.

## Changed

MissionControlAlertLayer now uses:

- mapHealthScannerToAlertSources()

before falling back to the internal alert preview logic.

## Result

Health Scanner results now map into Telegram-ready alert payloads through the shared mapping layer.

## Safety

No API changed.
No engine changed.
No trading logic changed.
No live execution changed.
No Telegram sending added.
Only alert mapping wiring was consolidated.
