# Universal Search Pattern

## Purpose

Universal Search finds authorized records and relationships from anywhere without losing the current workspace context.

## Search domains

- Student: name, student ID, guardian, grade, class; never sensitive notes.
- Teacher: name, employee ID, subject, class; HR fields separately protected.
- Parent: name, verified contact, linked child; relationship scope enforced.
- Invoice: invoice/account reference, payer, student, status, amount with finance permission.
- Attendance: student, class, date, resolution state; assignment and school scoped.

## Results

Group mixed results by record type with icon, primary label, safe identifier, scope, status, relationship hint, and destination. Show why a result matched only when it does not expose protected data. Never reveal unauthorized counts.

## Recent searches

Store locally or server-side according to policy, scope them to the user and tenant, allow clearing, and never retain raw sensitive queries beyond policy. Role/scope change invalidates unsafe recents.

## Keyboard navigation

Provide a documented shortcut, focus the search input, use arrow keys through results, Enter to open, Escape to close/return focus, and announce result count and active item. Preserve IME and Arabic input behavior.

## Empty, loading, and error examples

Loading keeps input interactive and marks results busy. No-results suggests safe spelling/filter changes. Permission-denied records do not appear. Service failure retains the query and offers retry/reference ID.

## RTL and accessibility

Use combobox/listbox semantics where appropriate, visible labels or accessible names, active-descendant or roving focus correctly, logical alignment, localized categories, and direction isolation for IDs and amounts.

