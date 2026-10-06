/**
 * Admin bootstrap for a fresh ProLib instance.
 *
 *   npm run create-admin -- <email> "<full name>" <handle> <password>
 *
 * Creates exactly one `role = admin` account with a verified email so you can
 * sign in at /login and reach the admin console (taxonomy, moderation,
 * settings).
 *
 * This is the ONLY way an account appears without real signup, and it only
 * ever runs when you invoke it on purpose — ProLib never seeds data on
 * startup, and a fresh install stays empty (0 users, 0 projects) until a real
 * person signs up or you run this command.
 */
import { eq } from "drizzle-orm";

import { hashPassword } from "../lib/auth/password";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_PATTERN = /^[a-z0-9_]+$/i;

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  const [emailRaw, name, usernameRaw, password] = process.argv.slice(2);

  if (!emailRaw || !name || !usernameRaw || !password) {
    console.error(
      "Usage: npm run create-admin -- <email> \"<full name>\" <handle> <password>",
    );
    process.exit(1);
  }

  const email = emailRaw.trim().toLowerCase();
  const username = usernameRaw.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) fail("That is not a valid email address.");
  if (name.trim().length < 2) fail("Enter a full name.");
  if (!USERNAME_PATTERN.test(username) || username.length < 3 || username.length > 30) {
    fail("Handle: letters, numbers and underscores only, 3–30 characters.");
  }
  if (
    password.length < 10 ||
    !/[a-zA-Z]/.test(password) ||
    !/\d/.test(password)
  ) {
    fail("Password needs 10+ characters mixing letters and numbers.");
  }

  const existingEmail = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingEmail[0]) {
    if (existingEmail[0].role === "admin") {
      console.log(`• ${email} is already an admin — nothing to do.`);
      process.exit(0);
    }
    fail(`${email} already exists as a non-admin account — pick another email.`);
  }

  const existingUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existingUsername[0]) fail(`The handle @${username} is already taken.`);

  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id: crypto.randomUUID(),
    email,
    emailVerifiedAt: new Date(),
    passwordHash,
    name: name.trim(),
    username,
    role: "admin",
    status: "active",
  });

  console.log(`✓ Admin created: ${email} (@${username})`);
  console.log("  Sign in at /login — the admin console is at /admin.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
