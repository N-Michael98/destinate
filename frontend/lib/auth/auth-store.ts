import bcrypt from "bcryptjs";
import { getPrisma } from "../../app/lib/prisma";

export type UserRole = "ADMIN" | "USER";
export type UserStatus = "ACTIVE" | "PENDING_EMAIL" | "PENDING_APPROVAL";

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  emailVerifyToken: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserPublic {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

function toUser(u: any): User {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    passwordHash: u.passwordHash,
    role: u.role as UserRole,
    status: u.status as UserStatus,
    emailVerifyToken: u.emailVerifyToken ?? null,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    lastLoginAt: u.lastLoginAt instanceof Date ? u.lastLoginAt.toISOString() : (u.lastLoginAt ?? null),
  };
}

export function toPublic(u: User): UserPublic {
  return { id: u.id, username: u.username, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt };
}

export async function ensureAdminExists(): Promise<void> {
  const db = getPrisma();
  const existing = await db.user.findFirst({ where: { role: "ADMIN" } });
  if (existing) return;
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@destinate.ch";
  await db.user.create({
    data: {
      id: "admin-1",
      username: adminUsername,
      email: adminEmail,
      passwordHash: bcrypt.hashSync(adminPassword, 12),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const u = await getPrisma().user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
  return u ? toUser(u) : null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const u = await getPrisma().user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  return u ? toUser(u) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const u = await getPrisma().user.findUnique({ where: { id } });
  return u ? toUser(u) : null;
}

export async function findUserByToken(token: string): Promise<User | null> {
  const u = await getPrisma().user.findFirst({ where: { emailVerifyToken: token } });
  return u ? toUser(u) : null;
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string; userId?: string }> {
  const db = getPrisma();
  const existingUsername = await db.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
  if (existingUsername) return { ok: false, error: "Benutzername bereits vergeben" };
  const existingEmail = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (existingEmail) return { ok: false, error: "E-Mail bereits registriert" };
  if (password.length < 8) return { ok: false, error: "Passwort muss mindestens 8 Zeichen haben" };

  const newUser = await db.user.create({
    data: {
      username,
      email,
      passwordHash: bcrypt.hashSync(password, 12),
      role: "USER",
      status: "PENDING_APPROVAL",
    },
  });
  return { ok: true, userId: newUser.id };
}

export async function updateLastLogin(id: string): Promise<void> {
  await getPrisma().user.update({ where: { id }, data: { lastLoginAt: new Date() } });
}

export async function updateUsername(id: string, newUsername: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await getPrisma().user.findFirst({ where: { username: { equals: newUsername, mode: "insensitive" }, NOT: { id } } });
  if (existing) return { ok: false, error: "Benutzername bereits vergeben" };
  if (newUsername.length < 3) return { ok: false, error: "Benutzername muss mindestens 3 Zeichen haben" };
  await getPrisma().user.update({ where: { id }, data: { username: newUsername } });
  return { ok: true };
}

export async function updatePassword(id: string, newHash: string): Promise<void> {
  await getPrisma().user.update({ where: { id }, data: { passwordHash: newHash } });
}

export async function getAllUsers(): Promise<UserPublic[]> {
  const users = await getPrisma().user.findMany({ orderBy: { createdAt: "desc" } });
  return users.map((u: unknown) => toPublic(toUser(u)));
}

export async function approveUser(id: string): Promise<boolean> {
  try {
    await getPrisma().user.update({ where: { id }, data: { status: "ACTIVE" } });
    return true;
  } catch { return false; }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    const u = await getPrisma().user.findUnique({ where: { id } });
    if (!u || u.role === "ADMIN") return false;
    await getPrisma().user.delete({ where: { id } });
    return true;
  } catch { return false; }
}
