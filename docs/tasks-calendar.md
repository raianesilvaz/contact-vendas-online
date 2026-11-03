# Integrated task calendar

Extends existing employee_tasks without schema or permission changes. Month (42-day grid) and week views, period navigation, Today and day selection. Calendar selection drives the paginated sidebar. Existing deadline/status filters and undated pending tasks remain available. Mobile Calendar/List toggle shares selected day and editing state.

Calendar reads only id/title/priority/status/deadline/updated_at for the visible range and current owner/assignment scope; cancelled tasks are omitted. Batches of 500 are fetched until exhausted, never silently truncated. Side list keeps server pagination of 15. Full notes are fetched under existing RLS when opening a calendar event. Search and scope affect both views. At most 3 events/day in month or 8/day in week are painted, with a More tasks action leading to the paginated list.

Calendar date keys are America/Sao_Paulo. Grid arithmetic uses UTC noon for calendar-only dates; SQL ranges use Brasilia midnight and exclusive next-day boundary. No new map/calendar service or third-party calendar library. No additional database state, no duplicate task copies.

Checks: JS syntax; month/year rollover, leap year, week/month ranges, Brasilia/UTC midnight tests; isolated browser creation on selected Nov 10 with automatic 09:00 deadline and confirmation in both calendar and list; week/month switching; layout inspection. Reminder and ownership backend is unchanged. Preview fixture data is not published.
