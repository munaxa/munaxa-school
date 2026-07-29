# Munaxa Domain Relationship Maps

Relationships are typed, directional, effective-dated, stateful, and permission-scoped. The source record does not own a copy of the target.

## Student relationships

~~~mermaid
graph TD
  Student --> Guardians
  Student --> Attendance
  Student --> Invoices
  Student --> Messages
  Student --> Documents
  Student --> Enrollment
  Student --> Transport
~~~

## Teacher relationships

~~~mermaid
graph TD
  Teacher --> Classes
  Teacher --> Attendance
  Teacher --> Communication
  Teacher --> Schedule
  Teacher --> Students
~~~

## Parent relationships

~~~mermaid
graph TD
  Parent --> Children
  Parent --> Payments
  Parent --> Messages
  Parent --> Consents
~~~

## Finance relationships

~~~mermaid
graph TD
  Invoice --> Payments
  Invoice --> Receipts
  Invoice --> Student
  Invoice --> Parent
  Payment --> Settlement
  Payment --> Refund
  Refund --> Approval
~~~

## Rules

Display only authorized relationships. Show relationship type and state, preserve source context during navigation, and link to the target record workspace. Changes create timeline events and, when sensitive, immutable audit events.

