import { prisma } from "@/lib/db";

interface ClerkUserProfile {
  id: string;
  email?: string | null;
  name?: string | null;
  imageUrl?: string | null;
}

export async function upsertAppUser(profile: ClerkUserProfile) {
  return prisma.appUser.upsert({
    where: { clerkId: profile.id },
    create: {
      clerkId: profile.id,
      email: profile.email ?? null,
      name: profile.name ?? null,
      imageUrl: profile.imageUrl ?? null,
    },
    update: {
      email: profile.email ?? null,
      name: profile.name ?? null,
      imageUrl: profile.imageUrl ?? null,
    },
  });
}
