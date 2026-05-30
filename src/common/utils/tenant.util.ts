import { PrismaService } from '../../prisma/prisma.service';
import { currentRequestUser } from './request-context.util';

export async function defaultOrganizationId(prisma: PrismaService) {
  const user = currentRequestUser();
  if (user?.organizationId) return user.organizationId;

  const organization = await prisma.organization.upsert({
    where: { slug: 'northbridge' },
    update: {},
    create: {
      name: 'Northbridge University',
      slug: 'northbridge',
      timezone: 'America/Los_Angeles',
    },
    select: { id: true },
  });
  return organization.id;
}

export function codeFromName(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
}
