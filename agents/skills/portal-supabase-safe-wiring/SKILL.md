---
name: portal-supabase-safe-wiring
description: Use this skill when the task involves portal data, Supabase queries, forms, tables, actions, assignments, or backend-connected UI. Prevents fake wiring, invented columns, placeholder actions, and broken CRUD patterns.
---

# Portal Supabase Safe Wiring

Use this skill whenever editing code that reads from or writes to Supabase, especially for portal tables, forms, dashboard data, actions, assignments, messages, documents, payments, or puppy/buyer records.

## Objective

Make the portal feel professionally built by ensuring the UI is wired to real data and real actions, not fake placeholders.

## Non-negotiable rules

- Do not invent database columns.
- Do not guess table structure when actual schema is available.
- Do not create fake CRUD actions.
- Do not leave clickable controls unwired unless clearly disabled and explained.
- Do not return code that looks functional but cannot work.

## Query discipline

Before writing queries:
- inspect existing schema usage in the codebase
- reuse the real field names already used by the project
- keep joins and selects aligned with actual table relationships
- respect nullability and missing data
- handle loading, empty, and error states

## UI data rules

For data-driven cards, tables, and forms:
- always account for empty results
- always account for loading
- always account for fetch failures
- always account for partial or missing fields
- never assume ideal data

## Mutation rules

For inserts, updates, and deletes:
- use real tables and real columns
- preserve existing patterns in the codebase
- return success and failure states cleanly
- avoid silent failures
- surface meaningful feedback in the UI

## Forms

Forms must:
- map to real fields
- validate required inputs
- provide readable errors
- submit intentionally
- avoid fake success messaging

## Tables and records

For record lists:
- make row actions real
- make card clicks real where expected
- keep displayed data tied to actual source fields
- avoid mismatched labels versus actual database meaning

## Professionalism standard

A professional portal is not only pretty. It must also:
- show the correct data
- avoid broken interactions
- avoid dead buttons
- avoid schema mismatches
- handle edge cases gracefully

## Safe fallback behavior

If backend wiring is not possible from the available code context:
- say so in the implementation notes
- disable actions clearly instead of faking them
- preserve UI integrity
- do not pretend the feature is live

## Output rules

When this skill is used:
- prefer correctness over cleverness
- prefer explicit handling over hidden assumptions
- keep code readable and maintainable
- return complete working files, not patch fragments