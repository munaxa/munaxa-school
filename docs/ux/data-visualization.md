# MUNAXA Data Visualization System

## Purpose

Visualization turns school records into decisions without hiding scope, uncertainty, freshness, or accessible detail. Every chart answers a question and has a table or textual equivalent where required.

## Principles

- Decision before decoration.
- Use the least complex representation that answers the question.
- Show scope, period, units, source, and freshness.
- Preserve semantic meaning across light/dark and LTR/RTL.
- Never use color alone or manipulate axes to exaggerate change.

## Analytics domains

Attendance: rate, absence/late distribution, cohort trend, risk thresholds. Financial: billed, collected, outstanding, aging, settlement, forecast vs actual. Enrollment: inquiry-to-enrollment funnel, growth, capacity. Academic: distribution and longitudinal progress with privacy thresholds. Operational: transport, staffing, communication delivery, approvals, service exceptions.

## Chart selection

| Form | Use when | Avoid when | Real example |
|---|---|---|---|
| KPI card | One decision-critical value with scope/change | More than four equal KPIs | Attendance 94.7%, current term |
| Bar chart | Compare discrete categories | Too many categories or continuous time | Attendance by grade |
| Line chart | Show change over ordered time | Irregular categories | Monthly student growth |
| Area chart | Emphasize cumulative magnitude over time | Precise overlapping series | Cumulative fee collection |
| Pie chart | Rarely: 2–5 parts of a whole with large differences | Comparison, trends, many slices | Prefer donut/table |
| Donut chart | Compact composition with central total | Similar slices or accessibility-critical comparison | Paid vs outstanding fees |
| Table | Exact values, ranking, scanning, sorting, export | Only broad trend needed | Invoice aging |
| Heatmap | Dense two-dimensional pattern | Exact standalone values | Attendance by weekday/class |
| Progress indicator | Known bounded completion | Unbounded performance or comparison | Register 27/30 marked |

## Color rules

Use semantic tokens for status and the existing data palette for series. Primary purple highlights current/selected data, not every series. Success/warning/destructive retain documented meaning. Keep series colors stable across a workspace. Validate contrast against both themes and provide pattern, marker, label, or line-style redundancy. No neon, glow, gradients that encode values, or transparent glass charts.

## Axes

Axes include units. Time runs in chronological order; RTL changes label alignment, not chronology. Bar axes start at zero unless a clearly labelled analytical exception is necessary. Line axes disclose non-zero baselines. Use sensible tick intervals, locale formatting, and no angled labels when wrapping/abbreviation works.

## Legends and labels

Place legend near the plot, in reading order, using exact series names. Direct-label series when legible. Labels prioritize values needed for decisions; do not label every point. Use locale-aware percentage, currency, and compact number formatting. Expand abbreviations through tooltip or description.

## Tooltips

Tooltips supplement—not contain—the only value. They show dimension, series, exact value, unit, comparison, and timestamp/source when useful. Support keyboard focus and touch; do not rely on hover.

## Empty and loading rules

Empty distinguishes no data, no matches, not collected, permission denied, and unavailable. State scope and recovery. Loading preserves chart dimensions with a reduced-motion skeleton and keeps filters usable. Partial data is visibly labelled; never interpolate silently.

## Dashboard layouts

### Good

~~~text
Role + scope + period + freshness
Up to four decision metrics
Primary trend (wide) | Exceptions/action queue
Comparison/table
Source and methodology
~~~

### Bad

- Equal card grid with no priority.
- Decorative chart for every metric.
- Mixed periods/currencies without labels.
- Pie charts with many similar slices.
- Critical exceptions below secondary visualizations.

## Dashboard standards

Executive dashboards aggregate school/campus health, strategic trend, target variance, risks, and decisions; drill-down preserves scope. School dashboards show current operational state, owners, exceptions, and today/term context. Campus dashboards show campus-local operations and comparison only when authorized. Cross-campus views name every scope and prevent accidental mutation from aggregate context.

## Real examples

### Attendance

KPI: 94.7% current term. Line: weekly rate with 90% policy threshold. Bar: grade comparison. Table: students requiring intervention. Arabic label: معدل الحضور للفصل الدراسي الحالي.

### Revenue and fee collection

KPI: JOD 1.42m collected. Area: cumulative billed vs collected. Bar: aging buckets. Table: overdue accounts. Arabic label: تحصيل الرسوم حسب الحرم.

### Student growth

Line: enrolled students by month with prior-year comparison. Bar: enrollment by grade and available capacity. Never infer student quality from growth.

## Accessibility

Each visualization has a title, purpose, summary, table/text alternative, keyboard-accessible data, visible focus, non-color encoding, and screen-reader-safe updates. Respect reduced motion and 200% zoom. Do not auto-animate dashboards.

## RTL considerations

Use logical placement and Arabic labels. Chronological and numeric axes keep mathematical order. Directional tooltips and legends follow document direction; IDs and numbers are isolated. Do not mirror the underlying meaning of positive/negative movement.

## Do / Don’t

Do show targets, denominators, freshness, missing data, and exact accessible values. Don’t use 3D charts, dual axes without compelling justification, truncated misleading axes, rainbow palettes, tiny labels, or decorative motion.

## Enterprise best practices

Define metric ownership, calculation, source, refresh SLA, permission classification, threshold, and data-quality state in a metric registry. Version calculation changes and annotate discontinuities.

## Implementation notes

Wrap charts in the approved ReportVisualizationWrapper. Use semantic token adapters, locale formatters, ResizeObserver-safe responsive sizing, and a table fallback. Test screenshots in light/dark, English/Arabic, narrow widths, missing/partial data, and forced colors.

