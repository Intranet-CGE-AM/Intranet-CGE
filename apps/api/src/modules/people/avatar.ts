import sharp from "sharp";

export const maxAvatarBytes = 2 * 1024 * 1024;

const signatures = {
  "image/jpeg": (buffer: Buffer) =>
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff,
  "image/png": (buffer: Buffer) =>
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (buffer: Buffer) =>
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP",
} as const;

export type AvatarContentType = keyof typeof signatures;

export function validateAvatar(
  buffer: Buffer,
  claimedContentType: string,
): AvatarContentType {
  if (!buffer.length || buffer.length > maxAvatarBytes) {
    throw new Error("AVATAR_SIZE");
  }
  const detected = Object.entries(signatures).find(([, matches]) =>
    matches(buffer),
  )?.[0] as AvatarContentType | undefined;
  if (!detected || detected !== claimedContentType) {
    throw new Error("AVATAR_TYPE");
  }
  return detected;
}

export function avatarObjectKey(personId: string) {
  return `people/${personId}/avatar`;
}

export async function normalizeAvatar(
  buffer: Buffer,
  claimedContentType: string,
) {
  validateAvatar(buffer, claimedContentType);
  try {
    return await sharp(buffer, {
      failOn: "warning",
      limitInputPixels: 16_777_216,
    })
      .rotate()
      .resize(512, 512, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new Error("AVATAR_INVALID");
  }
}

export function avatarUrl(personId: string, updatedAt: Date | null) {
  return updatedAt
    ? `/api/people/${personId}/avatar?v=${updatedAt.getTime()}`
    : null;
}
