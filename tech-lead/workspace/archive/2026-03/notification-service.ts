// notification-service.ts — Core notification dispatch
import { RateLimiter } from './rate-limiter';
import { TemplateEngine } from './template-engine';

interface Notification {
  id: string;
  userId: string;
  channel: 'email' | 'sms' | 'push';
  template: string;
  data: Record<string, string>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  createdAt: number;
}

interface SendResult {
  notificationId: string;
  success: boolean;
  channel: string;
  retryable: boolean;
  error?: string;
}

const CHANNEL_LIMITS: Record<string, number> = {
  email: 100,
  sms: 50,
  push: 200,
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export class NotificationService {
  private queue: Notification[] = [];
  private limiter: RateLimiter;
  private templates: TemplateEngine;
  private sent: Map<string, SendResult> = new Map();

  constructor(limiter: RateLimiter, templates: TemplateEngine) {
    this.limiter = limiter;
    this.templates = templates;
  }

  enqueue(notification: Notification): void {
    this.queue.push(notification);
    this.sortByPriority();
  }

  private sortByPriority(): void {
    this.queue.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return a.createdAt - b.createdAt;
    });
  }

  async processQueue(): Promise<SendResult[]> {
    const results: SendResult[] = [];
    const batch = this.queue.splice(0, this.queue.length);

    for (const notification of batch) {
      const result = await this.send(notification);
      results.push(result);
      this.sent.set(notification.id, result);
    }

    return results;
  }

  private async send(notification: Notification): Promise<SendResult> {
    const limit = CHANNEL_LIMITS[notification.channel];
    if (!this.limiter.tryAcquire(notification.channel, limit)) {
      return {
        notificationId: notification.id,
        success: false,
        channel: notification.channel,
        retryable: true,
        error: 'Rate limit exceeded',
      };
    }

    const body = this.templates.render(notification.template, notification.data);
    if (!body) {
      return {
        notificationId: notification.id,
        success: false,
        channel: notification.channel,
        retryable: false,
        error: `Template "${notification.template}" not found`,
      };
    }

    // Simulate channel delivery
    return {
      notificationId: notification.id,
      success: true,
      channel: notification.channel,
      retryable: false,
    };
  }

  getResult(notificationId: string): SendResult | undefined {
    return this.sent.get(notificationId);
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  getStats(): { sent: number; failed: number; pending: number } {
    let sent = 0;
    let failed = 0;
    for (const result of this.sent.values()) {
      if (result.success) sent++;
      else failed++;
    }
    return { sent, failed, pending: this.queue.length };
  }
}
