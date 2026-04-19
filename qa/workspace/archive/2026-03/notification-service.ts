/**
 * NotificationService — Manages user notification delivery with support for
 * batching, deduplication, priority levels, and delivery confirmation.
 *
 * Depends on EventBus for event-driven notification triggering.
 */

import { EventBus } from './event-bus';

export enum Priority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  priority: Priority;
  createdAt: number;
  deliveredAt?: number;
  readAt?: number;
}

interface BatchConfig {
  maxBatchSize: number;
  batchWindowMs: number;
}

export class NotificationService {
  private bus: EventBus;
  private notifications: Map<string, Notification> = new Map();
  private userQueues: Map<string, Notification[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private batchConfig: BatchConfig;
  private deliveredIds: Set<string> = new Set();

  constructor(bus: EventBus, batchConfig?: Partial<BatchConfig>) {
    this.bus = bus;
    this.batchConfig = {
      maxBatchSize: batchConfig?.maxBatchSize ?? 10,
      batchWindowMs: batchConfig?.batchWindowMs ?? 1000,
    };

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen for system events that trigger notifications
    this.bus.on('user.action', (payload: unknown) => {
      const data = payload as { userId: string; action: string };
      this.createFromEvent(data.userId, data.action);
    });
  }

  /**
   * Create a notification from a system event.
   */
  private createFromEvent(userId: string, action: string): void {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      title: `Action: ${action}`,
      body: `User ${userId} performed ${action}`,
      priority: Priority.MEDIUM,
      createdAt: Date.now(),
    };
    this.enqueue(notification);
  }

  /**
   * Send a notification. Deduplicates by checking the delivered set.
   * High-priority notifications bypass batching and deliver immediately.
   */
  send(notification: Notification): boolean {
    // Deduplicate
    if (this.deliveredIds.has(notification.id)) {
      return false;
    }

    // Store
    this.notifications.set(notification.id, notification);

    // Critical notifications bypass batching
    if (notification.priority >= Priority.HIGH) {
      this.deliverImmediately(notification);
      return true;
    }

    this.enqueue(notification);
    return true;
  }

  /**
   * Add a notification to the user's batch queue.
   * Starts a batch timer if one isn't running.
   */
  private enqueue(notification: Notification): void {
    const queue = this.userQueues.get(notification.userId) ?? [];
    queue.push(notification);
    this.userQueues.set(notification.userId, queue);

    // Start batch timer if not running
    if (!this.batchTimers.has(notification.userId)) {
      const timer = setTimeout(() => {
        this.flushQueue(notification.userId);
      }, this.batchConfig.batchWindowMs);
      this.batchTimers.set(notification.userId, timer);
    }

    // Flush immediately if batch is full
    if (queue.length >= this.batchConfig.maxBatchSize) {
      this.flushQueue(notification.userId);
    }
  }

  /**
   * Flush all pending notifications for a user.
   * Sorts by priority (highest first) before delivery.
   */
  private flushQueue(userId: string): void {
    const queue = this.userQueues.get(userId);
    if (!queue || queue.length === 0) return;

    // Clear timer
    const timer = this.batchTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(userId);
    }

    // Sort by priority (highest first)
    queue.sort((a, b) => a.priority - b.priority);

    // Deliver batch
    const batch = queue.splice(0, this.batchConfig.maxBatchSize);
    for (const notification of batch) {
      this.deliver(notification);
    }

    // If items remain, start a new batch timer
    if (queue.length > 0) {
      const newTimer = setTimeout(() => {
        this.flushQueue(userId);
      }, this.batchConfig.batchWindowMs);
      this.batchTimers.set(userId, newTimer);
    }
  }

  /**
   * Deliver a single notification immediately (bypass batching).
   */
  private deliverImmediately(notification: Notification): void {
    this.deliver(notification);
  }

  /**
   * Internal delivery — marks as delivered and emits event.
   */
  private deliver(notification: Notification): void {
    notification.deliveredAt = Date.now();
    this.deliveredIds.add(notification.id);
    this.bus.emit('notification.delivered', {
      id: notification.id,
      userId: notification.userId,
    });
  }

  /**
   * Mark a notification as read.
   */
  markAsRead(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);
    if (!notification) return false;

    notification.readAt = Date.now();
    this.bus.emit('notification.read', { id: notificationId });
    return true;
  }

  /**
   * Get all unread notifications for a user, sorted by creation time (newest first).
   */
  getUnread(userId: string): Notification[] {
    const results: Notification[] = [];

    for (const notification of this.notifications.values()) {
      if (notification.userId === userId && !notification.readAt) {
        results.push(notification);
      }
    }

    return results.sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Get count of undelivered notifications for a user.
   */
  getPendingCount(userId: string): number {
    const queue = this.userQueues.get(userId);
    return queue?.length ?? 0;
  }

  /**
   * Cancel a pending notification (remove from queue before delivery).
   * Returns true if the notification was found and cancelled.
   */
  cancel(notificationId: string): boolean {
    for (const [userId, queue] of this.userQueues.entries()) {
      const index = queue.findIndex(n => n.id === notificationId);
      if (index !== -1) {
        queue.splice(index, 1);
        this.notifications.delete(notificationId);
        return true;
      }
    }

    return false;
  }

  /**
   * Get delivery statistics.
   */
  getStats(): { total: number; delivered: number; pending: number; read: number } {
    let delivered = 0;
    let read = 0;
    let pending = 0;

    for (const notification of this.notifications.values()) {
      if (notification.readAt) read++;
      if (notification.deliveredAt) delivered++;
      else pending++;
    }

    return {
      total: this.notifications.size,
      delivered,
      pending,
      read,
    };
  }

  /**
   * Destroy the service — clear all timers and subscriptions.
   */
  destroy(): void {
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();
    this.userQueues.clear();
    this.bus.removeAllListeners();
  }
}
