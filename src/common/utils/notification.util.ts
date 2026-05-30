import { NotificationChannel, NotificationPriority, NotificationType, Prisma } from '@prisma/client';

type NotificationDb = {
  notification: {
    create(args: Prisma.NotificationCreateArgs): Promise<unknown>;
    findFirst(args: Prisma.NotificationFindFirstArgs): Promise<unknown>;
  };
};

type NotifyUserInput = {
  organizationId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  priority?: NotificationPriority;
  channel?: NotificationChannel;
  entityType?: string;
  entityId?: string | null;
  link?: string;
  expiresAt?: Date;
  dedupeKey?: string;
};

export async function notifyUser(db: NotificationDb, input: NotifyUserInput) {
  if (!input.userId) return null;

  if (input.dedupeKey) {
    const existing = await db.notification.findFirst({
      where: {
        organizationId: input.organizationId,
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId || undefined,
        title: input.title,
      },
      select: { id: true },
    });
    if (existing) return existing;
  }

  return db.notification.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type,
      priority: input.priority ?? 'NORMAL',
      channel: input.channel ?? 'IN_APP',
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId || undefined,
      link: input.link,
      deliveredAt: new Date(),
      expiresAt: input.expiresAt,
    },
  });
}
