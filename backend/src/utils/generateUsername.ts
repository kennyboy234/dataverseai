// backend\src\utils\generateUsername.ts

export function generateUsername(email: string): string {
  const username = email
    .split("@")[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

  const random = Math.floor(1000 + Math.random() * 9000);

  return `${username}${random}`;
}