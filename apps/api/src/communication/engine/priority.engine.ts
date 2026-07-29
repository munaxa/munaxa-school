import { Injectable } from '@nestjs/common';
import type { NotificationChannel, NotificationPriority } from '@prisma/client';

/**
 * Maps a notification priority to the channels it should use, and the unread-escalation policy.
 *
 *  CRITICAL → push + email immediately (emergencies, security, OTP)
 *  HIGH     → push first; escalate to email if still unread after `escalateAfterMs`
 *  NORMAL   → push only
 *  LOW      → email only (digests / newsletters)
 *
 * The returned channels are the *desired* set; the engine intersects them with tenant kill-switches
 * and per-user preferences (unless the notification is mandatory).
 */
@Injectable()
export class PriorityEngine {
  /** Channels to attempt immediately for a given priority. */
  channelsFor(priority: NotificationPriority): NotificationChannel[] {
    switch (priority) {
      case 'CRITICAL':
        return ['PUSH', 'EMAIL'];
      case 'HIGH':
        return ['PUSH'];
      case 'NORMAL':
        return ['PUSH'];
      case 'LOW':
        return ['EMAIL'];
      default:
        return ['PUSH'];
    }
  }

  /** Whether an unread notification of this priority should later escalate to email. */
  escalatesOnUnread(priority: NotificationPriority): boolean {
    return priority === 'HIGH';
  }

  /** Delay before a HIGH notification escalates to email when still unread (default 30 min). */
  escalateAfterMs(): number {
    return 30 * 60 * 1000;
  }
}
