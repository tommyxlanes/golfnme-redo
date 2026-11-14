import { Storage, type Bucket } from "@google-cloud/storage";

// Avatars live in a Google Cloud Storage bucket. The bucket does not need to
// be public: the API serves the images itself (GET /api/avatars/...).
//
//   GCS_BUCKET_NAME        bucket name
//   GCS_KEY_JSON           the service-account key file's contents, as one
//                          JSON string (must include client_email and
//                          private_key)
//   GCS_EMULATOR_HOST      optional — a local GCS emulator such as
//                          fake-gcs-server (e.g. http://localhost:4443);
//                          no key needed

let bucket: Bucket | null | undefined;

// null when storage isn't (fully) configured — callers answer 503.
export function getAvatarBucket(): Bucket | null {
  if (bucket !== undefined) return bucket;
  bucket = null;

  const name = process.env.GCS_BUCKET_NAME;
  if (!name) return bucket;

  if (process.env.GCS_EMULATOR_HOST) {
    bucket = new Storage({
      apiEndpoint: process.env.GCS_EMULATOR_HOST,
      projectId: "local",
    }).bucket(name);
    return bucket;
  }

  const keyJson = process.env.GCS_KEY_JSON;
  if (!keyJson) return bucket;

  try {
    const credentials = JSON.parse(keyJson);
    if (!credentials.client_email || !credentials.private_key) {
      console.error(
        "[storage] GCS_KEY_JSON is missing client_email / private_key — avatar uploads are disabled",
      );
      return bucket;
    }
    bucket = new Storage({
      credentials,
      projectId: credentials.project_id,
    }).bucket(name);
  } catch {
    console.error("[storage] GCS_KEY_JSON is not valid JSON — avatar uploads are disabled");
  }
  return bucket;
}

export const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

// avatarUrl values we issue look like /api/avatars/<userId>/<file>
const AVATAR_URL = /^\/api\/avatars\/([a-z0-9]+)\/(\d+\.(?:jpg|png|webp))$/;

export function avatarUrlFor(userId: string, file: string) {
  return `/api/avatars/${userId}/${file}`;
}

// The bucket object behind one of our avatar URLs, or null for anything
// else (e.g. a Google profile picture).
export function avatarObjectName(avatarUrl: string | null | undefined) {
  const match = avatarUrl ? AVATAR_URL.exec(avatarUrl) : null;
  return match ? `avatars/${match[1]}/${match[2]}` : null;
}
