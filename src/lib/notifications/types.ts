export type NotificationType =
  | 'INFO'
  | 'WARNING'
  | 'SUCCESS'
  | 'APPROVAL_REQUEST'
  | 'TASK_ASSIGNED'
  | 'CREDIT_STATUS';

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'WHATSAPP';

export interface SendNotificationInput {
  organizationId: string;
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  linkUrl?: string;
  channels?: NotificationChannel[];
}

export interface NotificationProvider {
  name: string;
  channel: NotificationChannel;
  send(input: SendNotificationInput): Promise<boolean>;
}
