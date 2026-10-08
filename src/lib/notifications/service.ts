import { db } from '@/lib/db';
import {
  NotificationProvider,
  SendNotificationInput,
  NotificationChannel,
} from './types';

class InAppNotificationProvider implements NotificationProvider {
  name = 'In-App Provider';
  channel: NotificationChannel = 'IN_APP';

  async send(input: SendNotificationInput): Promise<boolean> {
    try {
      await db.notification.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          title: input.title,
          message: input.message,
          type: input.type || 'INFO',
          linkUrl: input.linkUrl,
        },
      });
      return true;
    } catch (error) {
      console.error('[InAppNotificationProvider] Failed to create notification:', error);
      return false;
    }
  }
}

class EmailNotificationProvider implements NotificationProvider {
  name = 'Email Channel (SMTP/SES Stub)';
  channel: NotificationChannel = 'EMAIL';

  async send(input: SendNotificationInput): Promise<boolean> {
    // Extensible email dispatcher stub
    console.log(`[EmailNotificationProvider] To: User(${input.userId}) | Subject: ${input.title} | ${input.message}`);
    return true;
  }
}

class WhatsAppNotificationProvider implements NotificationProvider {
  name = 'WhatsApp Channel (WA Gateway Stub)';
  channel: NotificationChannel = 'WHATSAPP';

  async send(input: SendNotificationInput): Promise<boolean> {
    // Extensible WhatsApp dispatcher stub
    console.log(`[WhatsAppNotificationProvider] To: User(${input.userId}) | Text: [${input.title}] ${input.message}`);
    return true;
  }
}

export class NotificationService {
  private static instance: NotificationService;
  private providers: Map<NotificationChannel, NotificationProvider> = new Map();

  private constructor() {
    this.registerProvider(new InAppNotificationProvider());
    this.registerProvider(new EmailNotificationProvider());
    this.registerProvider(new WhatsAppNotificationProvider());
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public registerProvider(provider: NotificationProvider) {
    this.providers.set(provider.channel, provider);
  }

  public async send(input: SendNotificationInput): Promise<boolean[]> {
    const channels: NotificationChannel[] = input.channels && input.channels.length > 0 ? input.channels : ['IN_APP'];
    const results: boolean[] = [];

    for (const ch of channels) {
      const provider = this.providers.get(ch);
      if (provider) {
        try {
          const res = await provider.send(input);
          results.push(res);
        } catch (e) {
          console.error(`[NotificationService] Error executing provider ${ch}:`, e);
          results.push(false);
        }
      }
    }

    return results;
  }

  public async markAsRead(notificationId: string, userId: string) {
    return db.notification.updateMany({
      where: {
        id: notificationId,
        userId: userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  public async markAllAsRead(userId: string) {
    return db.notification.updateMany({
      where: {
        userId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  public async getUnreadCount(userId: string): Promise<number> {
    return db.notification.count({
      where: {
        userId: userId,
        isRead: false,
      },
    });
  }

  public async getUserNotifications(userId: string, limit = 20) {
    return db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export const notificationService = NotificationService.getInstance();
