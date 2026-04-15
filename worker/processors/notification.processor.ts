import { Processor, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { getAblyRest } from "@/lib/ably";
import type { SendNotificationJob, NotificationKind } from "../queues";

// ─────────────────────────────────────────────
// Notification templates
// ─────────────────────────────────────────────
interface NotificationPayload {
  title: string;
  body: string;
  actionUrl?: string;
}

function buildPayload(
  kind: NotificationKind,
  actor: { name: string } | null,
  meta: Record<string, string | number | boolean> = {}
): NotificationPayload {
  switch (kind) {
    case "friend_request":
      return {
        title:     "New friend request",
        body:      `${actor?.name ?? "Someone"} sent you a friend request.`,
        actionUrl: "/friends",
      };
    case "friend_accepted":
      return {
        title:     "Friend request accepted",
        body:      `${actor?.name ?? "Someone"} accepted your friend request.`,
        actionUrl: "/friends",
      };
    case "session_invite":
      return {
        title:     "You've been invited",
        body:      `${actor?.name ?? "Someone"} invited you to a round. Code: ${meta.inviteCode ?? "—"}`,
        actionUrl: "/session/join",
      };
    case "session_started":
      return {
        title:     "Round started",
        body:      `Your group round has started — good luck!`,
        actionUrl: meta.sessionCode ? `/session/${meta.sessionCode}` : "/",
      };
    case "round_complete":
      return {
        title:     "Round complete",
        body:      `Your round is done. Final score: ${meta.totalScore ?? "—"}`,
        actionUrl: meta.roundId ? `/round/${meta.roundId}/summary` : "/",
      };
    default:
      return { title: "Notification", body: "" };
  }
}

// ─────────────────────────────────────────────
// send-notification
// Sends an Ably real-time push to the recipient's personal channel.
// Add email (Resend/Nodemailer) block below if needed.
// ─────────────────────────────────────────────
export const sendNotification: Processor<SendNotificationJob> = async (
  job: Job<SendNotificationJob>
) => {
  const { kind, recipientId, actorId, meta = {} } = job.data;
  job.log(`Sending ${kind} notification to user ${recipientId}`);

  // Fetch actor name if provided
  const actor = actorId
    ? await prisma.user.findUnique({
        where:  { id: actorId },
        select: { name: true },
      })
    : null;

  const payload = buildPayload(kind, actor, meta);

  // ── Ably push ──────────────────────────────
  // Each user has a personal channel: `user:{userId}`
  if (process.env.ABLY_API_KEY) {
    try {
      const ably = getAblyRest();
      const channel = ably.channels.get(`user:${recipientId}`);
      await channel.publish("notification", {
        kind,
        ...payload,
        actorId,
        timestamp: new Date().toISOString(),
      });
      job.log("Ably push sent");
    } catch (err) {
      job.log(`Ably push failed: ${(err as Error).message}`);
      // Non-fatal — fall through
    }
  } else {
    job.log("ABLY_API_KEY not set — skipping real-time push");
  }

  // ── Email (optional — wire up Resend or nodemailer here) ──
  // Uncomment and fill in when you add email notifications.
  //
  // const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { email: true, name: true } });
  // if (recipient && SEND_EMAIL_KINDS.includes(kind)) {
  //   await resend.emails.send({
  //     from:    "GolfNMe <noreply@golfn.me>",
  //     to:      recipient.email,
  //     subject: payload.title,
  //     html:    buildEmailHtml(payload, recipient.name),
  //   });
  // }

  return { recipientId, kind, title: payload.title };
};
