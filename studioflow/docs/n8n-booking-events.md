# Booking events and retention

`N8N_BOOKING_EVENTS` is an encrypted, server-only production environment variable.
Its JSON array contains `{businessId, professionalId, basicUser, basicPassword,
token}`. An empty or missing array disables this integration. Each enabled
business/professional must have exactly one matching configuration. Never place
credentials in client variables, workflow bodies or source control.

After persisting a confirmed appointment, `notifyNewBooking` sends a version 1
`STUDIOFLOW_BOOKING_CREATED` event to the fixed production webhook
`https://n8n.studioflowapp.tech/webhook/studioflow-confirmacao`. Pending appointments
are excluded. Existing professional notifications remain enabled.

The event includes stable eventId, businessId, bookingId, customerId,
professionalId, service, appointmentDate (ISO), appointmentTime (São Paulo),
durationMinutes, price, timezone, status and test. It contains no phone or access
link. The webhook requires Basic Auth plus `x-studioflow-n8n-token`, validates the
scope, upserts by bookingId and acknowledges the same bookingId/eventId after
processing. `test: true` runs the table operation in dry-run mode.

Delivery has a 10-second timeout and no immediate retries. Unconfirmed webhook
delivery is logged without credentials; this is not a durable delivery outbox.

Workflows 5 and 6 run daily at 09:00 America/Sao_Paulo. They use the existing
scoped `x-studioflow-integration-token` credential to call:

- `GET /api/integrations/n8n/candidatos?action=abandoned_conversation` or
  `inactive_customer`: returns candidate IDs and episode timestamps.
- `POST /api/integrations/n8n/notificar`: accepts a strict action plus customerId
  or conversationId, and optional `test: true`. Arbitrary phone numbers and
  messages are rejected. Contacts and eligibility are resolved in the backend.

Abandonment targets AI WhatsApp conversations inactive for 1–7 days, excluding
contacts who booked subsequently. Inactive customers need a completed visit at
least 30 days ago with the selected professional and no future active booking.
Both require active business access, notification settings and connected
WhatsApp. Candidate batches contain at most 100 items; abandonment examines up
to 1,000 conversations per scan.

The server-only `n8n_notification_receipts` table atomically claims an episode
before sending. Its composite primary key prevents repeat attempts. Failed or
ambiguous attempts require manual review and are not automatically retried.
Simulation does not claim receipts or send WhatsApp messages.

Publishing imported workflows with the n8n CLI requires restarting the n8n
container for the running service to load the new active versions. Other
containers and unrelated workflows should be preserved.

## Appointment actions

The same endpoints also accept `reminder_24h`, `reminder_2h`,
`no_show_followup`, `post_appointment` (strict UUID `appointmentId`) and
`daily_summary` (São Paulo `date`, YYYY-MM-DD). All accept optional `test: true`.
No arbitrary recipient, message, business or professional is accepted.

Workflows 2/3 poll every five minutes. The 24h window is 23h45–24h before a
confirmed appointment with reminders enabled. The 2h window matches the existing
backend (15 minutes–2h, created at least 10 minutes ago), and uses its atomic
`claim_appointment_notice` journal so the backend and n8n cannot send twice.

Workflows 4/7 poll every 15 minutes. No-show must already be explicitly marked
`no_show`; the automation never changes attendance status. Aftercare requires
`completed`, 30 minutes–24h after appointment end. These windows expire after
24h. Messages are WhatsApp only; no unconfigured email/SMS/push providers are used.

Workflow 8 runs at 18h São Paulo and sends that day's appointment counts only to
the selected active professional's configured phone or connected WhatsApp number.
It checks `notifyProfessionals`; customer notifications use `notifications`.
Summary claims are unique per professional and local day. No revenue is inferred
from appointment prices. Candidate scans fail closed at 1,000 appointments.

Authenticated automation requests have a separate 1,000/minute process-local
rate bucket per scoped business/professional/IP; public mutation limits stay 20.
Backend eligibility is rechecked for every send. Simulation does not create
receipts or send messages. Failed/uncertain deliveries require manual review.
