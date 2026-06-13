import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export type UserRole = "ADMIN" | "USER";
export type UserStatus = "ACTIVE" | "PENDING_EMAIL" | "PENDING_APPROVAL";
// PENDING_EMAIL  = registered, not yet confirmed email
// PENDING_APPROVAL = email confirmed, waiting for admin approval
// ACTIVE = can login

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

const DB_PATH = path.join(process.cwd(), ".users.json");

function loadUsers(): User[] {
  try {
    if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as User[];
  } catch { /* corrupt */ }
  return [];
}

function saveUsers(users: User[]): void {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2), "utf-8"); } catch { /* non-fatal */ }
}

declare global { var __users__: User[] | undefined; }
if (!global.__users__) global.__users__ = loadUsers();

function getUsers(): User[] { return global.__users__!; }
function setUsers(u: User[]): void { global.__users__ = u; saveUsers(u); }

export function ensureAdminExists(): void {
  if (getUsers().some((u) => u.role === "ADMIN")) return;
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@destinate.ch";
  const admin: User = {
    id: "admin-1",
    username: adminUsername,
    email: adminEmail,
    passwordHash: bcrypt.hashSync(adminPassword, 12),
    role: "ADMIN",
    status: "ACTIVE",
    emailVerifyToken: null,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  setUsers([...getUsers(), admin]);
}

export function findUserByUsername(username: string): User | undefined {
  return getUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
}
export function findUserByEmail(email: string): User | undefined {
  return getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}
export function findUserById(id: string): User | undefined {
  return getUsers().find((u) => u.id === id);
}
export function findUserByToken(token: string): User | undefined {
  return getUsers().find((u) => u.emailVerifyToken === token);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function registerUser(
  username: string,
  email: string,
  password: string
): { ok: boolean; error?: string; token?: string; userId?: string } {
  const users = getUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase()))
    return { ok: false, error: "Benutzername bereits vergeben" };
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
    return { ok: false, error: "E-Mail bereits registriert" };
  if (password.length < 8)
    return { ok: false, error: "Passwort muss mindestens 8 Zeichen haben" };

  const newUser: User = {
    id: `user-${Date.now()}`,
    username,
    email,
    passwordHash: bcrypt.hashSync(password, 12),
    role: "USER",
    status: "PENDING_APPROVAL",
    emailVerifyToken: null,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  setUsers([...users, newUser]);
  return { ok: true, userId: newUser.id };
}

export function verifyEmailToken(token: string): { ok: boolean; error?: string } {
  const user = findUserByToken(token);
  if (!user) return { ok: false, error: "Ungültiger oder abgelaufener Link" };
  if (user.status !== "PENDING_EMAIL") return { ok: false, error: "E-Mail bereits bestätigt" };
  setUsers(getUsers().map((u) =>
    u.id === user.id ? { ...u, status: "PENDING_APPROVAL", emailVerifyToken: null } : u
  ));
  return { ok: true };
}

export function updateLastLogin(id: string): void {
  setUsers(getUsers().map((u) => u.id === id ? { ...u, lastLoginAt: new Date().toISOString() } : u));
}

export function updateUsername(id: string, newUsername: string): { ok: boolean; error?: string } {
  const users = getUsers();
  if (users.some((u) => u.id !== id && u.username.toLowerCase() === newUsername.toLowerCase()))
    return { ok: false, error: "Benutzername bereits vergeben" };
  if (newUsername.length < 3)
    return { ok: false, error: "Benutzername muss mindestens 3 Zeichen haben" };
  setUsers(users.map((u) => u.id === id ? { ...u, username: newUsername } : u));
  return { ok: true };
}

export function updatePassword(id: string, newHash: string): void {
  setUsers(getUsers().map((u) => u.id === id ? { ...u, passwordHash: newHash } : u));
}

export function getAllUsers(): UserPublic[] { return getUsers().map(toPublic); }

export function approveUser(id: string): boolean {
  if (!getUsers().find((u) => u.id === id)) return false;
  setUsers(getUsers().map((u) => u.id === id ? { ...u, status: "ACTIVE" } : u));
  return true;
}

export function deleteUser(id: string): boolean {
  const target = getUsers().find((u) => u.id === id);
  if (!target || target.role === "ADMIN") return false;
  setUsers(getUsers().filter((u) => u.id !== id));
  return true;
}

export function toPublic(u: User): UserPublic {
  return { id: u.id, username: u.username, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt };
}
