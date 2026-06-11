import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

export type UserRole = "ADMIN" | "USER";
export type UserStatus = "ACTIVE" | "PENDING"; // PENDING = waiting for admin approval

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
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
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as User[];
    }
  } catch { /* corrupt → start fresh */ }
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
  const users = getUsers();
  if (users.some((u) => u.role === "ADMIN")) return;

  // Create default admin — user should change password after first login
  const hash = bcrypt.hashSync("admin123", 12);
  const admin: User = {
    id: "admin-1",
    username: "admin",
    email: "admin@trading.local",
    passwordHash: hash,
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  setUsers([...users, admin]);
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

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function registerUser(
  username: string,
  email: string,
  password: string
): { ok: boolean; error?: string; user?: UserPublic } {
  const users = getUsers();

  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, error: "Benutzername bereits vergeben" };
  }
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: "E-Mail bereits registriert" };
  }
  if (password.length < 8) {
    return { ok: false, error: "Passwort muss mindestens 8 Zeichen haben" };
  }

  const hash = bcrypt.hashSync(password, 12);
  const id = `user-${Date.now()}`;
  // First registration after admin = auto ACTIVE, otherwise PENDING (needs admin approval)
  const status: UserStatus = users.length === 0 ? "ACTIVE" : "PENDING";

  const newUser: User = {
    id,
    username,
    email,
    passwordHash: hash,
    role: "USER",
    status,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };

  setUsers([...users, newUser]);
  return { ok: true, user: toPublic(newUser) };
}

export function updateLastLogin(id: string): void {
  const users = getUsers();
  setUsers(users.map((u) => u.id === id ? { ...u, lastLoginAt: new Date().toISOString() } : u));
}

export function getAllUsers(): UserPublic[] {
  return getUsers().map(toPublic);
}

export function approveUser(id: string): boolean {
  const users = getUsers();
  if (!users.find((u) => u.id === id)) return false;
  setUsers(users.map((u) => u.id === id ? { ...u, status: "ACTIVE" } : u));
  return true;
}

export function deleteUser(id: string): boolean {
  const users = getUsers();
  const target = users.find((u) => u.id === id);
  if (!target || target.role === "ADMIN") return false; // can't delete admin
  setUsers(users.filter((u) => u.id !== id));
  return true;
}

export function toPublic(u: User): UserPublic {
  return { id: u.id, username: u.username, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt };
}
