# V15.B.1 Move Evolution Detail to Strategy Evolution

## Goal

Move the Evolution detail dashboard out of AI Agent and into the correct sidebar page.

## What changed

Strategy Evolution now renders:

- EvolutionCenterPanel

Learning pages still render:

- LearningCenter

## Reason

AI Agent must remain only a clean overview.
Detailed center dashboards must live in their correct sidebar pages.

## Safety

No API changed.
No engine changed.
No component deleted.
Only page routing was cleaned.
