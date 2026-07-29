# Related Records Pattern

## Purpose

Related Records makes relationships discoverable without copying data into the current record. Every relationship has source, target, type, effective dates, state, and permission.

## Layout and views

Place a concise relationship summary after primary record content or in a stable Overview region. Use cards for a small heterogeneous set and tables for numerous comparable records. Provide count, state, key metadata, quick link, and “View all.”

## Relationship types

Identity/guardian, assignment/class, financial/account, operational/attendance, communication/message, document/evidence, transport/route, and workflow/approval relationships.

## Quick links and cross navigation

Quick links open the related record workspace at the relevant tab. Preserve the origin record, tab, filters, and search context for return navigation. Never expose the existence of unauthorized records through counts or disabled links.

## Examples

- Student → Guardians, Attendance, Invoices, Messages, Documents.
- Teacher → Classes, Attendance, Communication.
- Parent → Children, Payments, Messages.
- Invoice → Payments, Receipts, Student, Parent.

## Accessibility and RTL

Relationship names are explicit link text, tables use headers, cards follow heading order, and counts have labels. Use logical flow and isolate identifiers and amounts.

