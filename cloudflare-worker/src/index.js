const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const DEFAULT_MAX_IMAGE_FILE_BYTES = 30 * 1024 * 1024;
const DEFAULT_MAX_VIDEO_FILE_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_STORAGE_BYTES = 13 * 1024 * 1024 * 1024;
const THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif",
]);
const VIDEO_TYPES = new Set([
  "video/mp4", "video/quicktime", "video/webm",
]);

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function getAllowedOrigin(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((v) => v.trim());
  return allowed.includes(origin) ? origin : null;
}

function cors(origin) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,HEAD,POST,OPTIONS",
    "access-control-allow-headers": [
      "content-type",
      "content-length",
      "x-upload-uploader-name",
      "x-upload-uploader-phone",
      "x-upload-name-key",
      "x-upload-phone-key",
      "x-upload-folder-key",
      "x-upload-password-hash",
      "x-upload-group-id",
      "x-upload-original-name",
      "x-admin-password-hash",
    ].join(","),
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function clean(value, max = 100) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function decodedHeader(request, name, max = 100) {
  const value = clean(request.headers.get(name), max * 3);

  try {
    return clean(decodeURIComponent(value), max);
  } catch {
    return "";
  }
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function numberSetting(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function extension(fileName) {
  return fileName.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || "jpg";
}

function safeDriveName(value, max = 80) {
  return clean(value, max)
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "") || "photo";
}

function driveTimestamp(value = Date.now()) {
  const date = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-");
}

function driveFileName(originalName, value = Date.now(), thumbnail = false) {
  const ext = extension(originalName);
  const base = safeDriveName(originalName.replace(/\.[^.]+$/, ""));
  return `${driveTimestamp(value)}_${base}${thumbnail ? "_thumb.webp" : `.${ext}`}`;
}

function uploaderFolderName(uploaderName, uploaderPhone) {
  const name = safeDriveName(uploaderName, 60);
  const phoneDigits = digits(uploaderPhone).slice(0, 20);
  let phone = phoneDigits;
  if (phoneDigits.length === 11) phone = phoneDigits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  if (phoneDigits.length === 10) phone = phoneDigits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  return phone ? `${name}_${phone}` : name;
}

function mediaType(type, fileName) {
  const ext = extension(fileName);
  const typeKind = IMAGE_TYPES.has(type)
    ? "image"
    : VIDEO_TYPES.has(type)
      ? "video"
      : null;
  const extensionKind = ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif"].includes(ext)
    ? "image"
    : ["mp4", "mov", "webm"].includes(ext)
      ? "video"
      : null;

  if (typeKind && extensionKind && typeKind !== extensionKind) return null;
  return typeKind || extensionKind;
}

function safeContentType(kind, type, fileName) {
  if (kind === "image" && IMAGE_TYPES.has(type)) return type;
  if (kind === "video" && VIDEO_TYPES.has(type)) return type;

  const byExtension = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    heic: "image/heic", heif: "image/heif", avif: "image/avif",
    mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  };
  return byExtension[extension(fileName)] || "application/octet-stream";
}

function validFolderKey(value) {
  return /^[a-z0-9_-]{1,160}$/.test(value);
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validFileId(value) {
  return /^[A-Za-z0-9_-]{10,200}$/.test(value);
}

async function accessToken(env, refresh = false) {
  if (!refresh && cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) return cachedToken;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(`Google 인증 실패 (${response.status})`);

  const data = await response.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function googleFetch(env, url, init = {}, retry = true) {
  const headers = new Headers(init.headers || {});
  headers.set("authorization", `Bearer ${await accessToken(env)}`);
  const response = await fetch(url, { ...init, headers });
  if (response.status === 401 && retry) {
    await accessToken(env, true);
    return googleFetch(env, url, init, false);
  }
  return response;
}

function supabaseHeaders(env, prefer) {
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
  };
  if (prefer) headers.prefer = prefer;
  return headers;
}

async function driveUsage(env) {
  const response = await googleFetch(env, `${DRIVE_API}/about?fields=storageQuota(limit,usage)`);
  if (!response.ok) throw new Error(`Drive 용량 확인 실패 (${response.status})`);
  const data = await response.json();
  return { limit: Number(data.storageQuota?.limit || 0), usage: Number(data.storageQuota?.usage || 0) };
}

async function uploadToDrive(env, request, folderId, name, type, size) {
  const prepared = await googleFetch(
    env,
    `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,name,mimeType,size`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-upload-content-type": type,
        "x-upload-content-length": String(size),
      },
      body: JSON.stringify({ name, parents: [folderId] }),
    }
  );
  if (!prepared.ok) throw new Error(`Drive 업로드 준비 실패 (${prepared.status})`);

  const uploadUrl = prepared.headers.get("location");
  if (!uploadUrl) throw new Error("Drive 업로드 주소를 받지 못했습니다.");

  const uploaded = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": type, "content-length": String(size) },
    body: request.body,
  });
  if (!uploaded.ok) throw new Error(`Drive 업로드 실패 (${uploaded.status})`);
  return uploaded.json();
}

async function deleteDriveFile(env, id) {
  if (validFileId(id)) await googleFetch(env, `${DRIVE_API}/files/${id}`, { method: "DELETE" });
}

async function ensureUploaderFolder(env, parentId, uploaderName, uploaderPhone, folderKey) {
  const desiredName = uploaderFolderName(uploaderName, uploaderPhone);
  const query = new URL(`${DRIVE_API}/files`);
  query.searchParams.set(
    "q",
    `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false and appProperties has { key='weddingUploaderKey' and value='${folderKey}' }`
  );
  query.searchParams.set("spaces", "drive");
  query.searchParams.set("pageSize", "1");
  query.searchParams.set("fields", "files(id,name)");

  const found = await googleFetch(env, query);
  if (!found.ok) throw new Error(`Drive 폴더 확인 실패 (${found.status})`);
  const existing = (await found.json()).files?.[0];
  if (existing?.id) {
    if (existing.name !== desiredName) {
      const renamed = await googleFetch(env, `${DRIVE_API}/files/${existing.id}?fields=id,name`, {
        method: "PATCH",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ name: desiredName }),
      });
      if (!renamed.ok) throw new Error(`Drive 폴더 이름 변경 실패 (${renamed.status})`);
    }
    return existing.id;
  }

  const created = await googleFetch(env, `${DRIVE_API}/files?fields=id,name`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      name: desiredName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
      appProperties: { weddingUploaderKey: folderKey },
    }),
  });
  if (!created.ok) throw new Error(`Drive 폴더 생성 실패 (${created.status})`);
  return (await created.json()).id;
}

async function insertPhoto(env, row) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/uploaded_photos`, {
    method: "POST",
    headers: supabaseHeaders(env, "return=representation"),
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`사진 목록 저장 실패 (${response.status})`);
  return (await response.json())[0];
}

async function originalUpload(request, env, origin) {
  const uploaderName = decodedHeader(request, "x-upload-uploader-name", 60);
  const uploaderPhone = digits(request.headers.get("x-upload-uploader-phone")).slice(0, 20);
  const nameKey = decodedHeader(request, "x-upload-name-key", 100).toLowerCase();
  const phoneKey = digits(request.headers.get("x-upload-phone-key")).slice(0, 20);
  const folderKey = clean(request.headers.get("x-upload-folder-key"), 160);
  const passwordHash = clean(request.headers.get("x-upload-password-hash"), 64);
  const groupId = clean(request.headers.get("x-upload-group-id"), 36);
  const originalName = decodedHeader(request, "x-upload-original-name", 180);
  const type = clean(request.headers.get("content-type"), 80).toLowerCase();
  const size = Number(request.headers.get("content-length") || 0);
  const kind = mediaType(type, originalName);
  const uploadType = kind ? safeContentType(kind, type, originalName) : type;
  const maxImage = numberSetting(
    env.MAX_IMAGE_FILE_BYTES || env.MAX_FILE_BYTES,
    DEFAULT_MAX_IMAGE_FILE_BYTES
  );
  const maxVideo = numberSetting(env.MAX_VIDEO_FILE_BYTES, DEFAULT_MAX_VIDEO_FILE_BYTES);
  const maxFile = kind === "video" ? maxVideo : maxImage;

  if (!uploaderName || !originalName || !validFolderKey(folderKey) || !validUuid(groupId)) {
    return json({ error: "업로더 또는 파일 정보가 올바르지 않습니다." }, 400, cors(origin));
  }
  if (passwordHash && !/^[0-9a-f]{64}$/i.test(passwordHash)) {
    return json({ error: "비밀번호 정보가 올바르지 않습니다." }, 400, cors(origin));
  }
  if (!kind) return json({ error: "지원하지 않는 사진 또는 동영상 형식입니다." }, 415, cors(origin));
  if (!Number.isFinite(size) || size <= 0 || size > maxFile) {
    return json({ error: `${kind === "video" ? "동영상" : "사진"}은 개당 ${Math.floor(maxFile / 1024 / 1024)}MB 이하여야 합니다.` }, 413, cors(origin));
  }
  const quota = await driveUsage(env);
  const configuredLimit = numberSetting(env.MAX_STORAGE_BYTES, DEFAULT_MAX_STORAGE_BYTES);
  const limit = quota.limit ? Math.min(quota.limit, configuredLimit) : configuredLimit;
  if (quota.usage + size > limit) {
    return json({ error: "사진 저장공간이 가득 찼습니다. 신랑·신부에게 알려주세요." }, 507, cors(origin));
  }

  let driveFile;
  try {
    const uploaderFolderId = await ensureUploaderFolder(
      env,
      env.GOOGLE_DRIVE_ORIGINALS_FOLDER_ID,
      uploaderName,
      uploaderPhone,
      folderKey
    );
    driveFile = await uploadToDrive(
      env, request, uploaderFolderId,
      driveFileName(originalName), uploadType, size
    );
    const workerOrigin = new URL(request.url).origin;
    const photoUrl = `${workerOrigin}/media/${driveFile.id}`;
    const thumbnailUrl = kind === "image" ? `${workerOrigin}/thumbnail/${driveFile.id}` : null;
    const row = await insertPhoto(env, {
      upload_group_id: groupId,
      uploader_name: uploaderName,
      uploader_phone: uploaderPhone || null,
      uploader_name_key: nameKey,
      uploader_phone_key: phoneKey,
      uploader_folder_key: folderKey,
      uploader_password_hash: passwordHash || null,
      photo_url: photoUrl,
      storage_path: `gdrive:${driveFile.id}`,
      thumbnail_url: thumbnailUrl,
      thumbnail_storage_path: null,
      media_type: kind,
      original_name: originalName,
      file_size: size,
      visible: true,
    });
    return json({ id: row.id, fileId: driveFile.id, photoUrl }, 201, cors(origin));
  } catch (error) {
    if (driveFile?.id) await deleteDriveFile(env, driveFile.id).catch(() => undefined);
    throw error;
  }
}

async function findPhoto(env, recordId, originalFileId) {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/uploaded_photos`);
  url.searchParams.set(
    "select",
    "id,uploader_name,uploader_phone,uploader_folder_key,original_name,created_at,media_type,thumbnail_storage_path"
  );
  url.searchParams.set("id", `eq.${recordId}`);
  url.searchParams.set("storage_path", `eq.gdrive:${originalFileId}`);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, { headers: supabaseHeaders(env) });
  return response.ok ? (await response.json())[0] : null;
}

async function thumbnailUpload(request, env, origin) {
  const url = new URL(request.url);
  const recordId = clean(url.searchParams.get("recordId"), 36);
  const originalFileId = clean(url.searchParams.get("originalFileId"), 200);
  const folderKey = clean(request.headers.get("x-upload-folder-key"), 160);
  const size = Number(request.headers.get("content-length") || 0);

  if (!validUuid(recordId) || !validFileId(originalFileId) || !validFolderKey(folderKey)) {
    return json({ error: "썸네일 대상이 올바르지 않습니다." }, 400, cors(origin));
  }
  if (request.headers.get("content-type") !== "image/webp") {
    return json({ error: "WebP 썸네일만 허용됩니다." }, 415, cors(origin));
  }
  if (!Number.isFinite(size) || size <= 0 || size > THUMBNAIL_MAX_BYTES) {
    return json({ error: "썸네일 크기가 올바르지 않습니다." }, 413, cors(origin));
  }

  const photo = await findPhoto(env, recordId, originalFileId);
  if (!photo || photo.uploader_folder_key !== folderKey || photo.media_type !== "image") {
    return json({ error: "원본 사진을 찾지 못했습니다." }, 404, cors(origin));
  }
  if (photo.thumbnail_storage_path) {
    return json({ error: "이미 썸네일이 생성된 사진입니다." }, 409, cors(origin));
  }

  let thumbnail;
  try {
    const uploaderFolderId = await ensureUploaderFolder(
      env,
      env.GOOGLE_DRIVE_THUMBNAILS_FOLDER_ID,
      photo.uploader_name,
      photo.uploader_phone,
      photo.uploader_folder_key
    );
    thumbnail = await uploadToDrive(
      env,
      request,
      uploaderFolderId,
      driveFileName(photo.original_name, photo.created_at, true),
      "image/webp",
      size
    );
    const thumbnailUrl = `${new URL(request.url).origin}/media/${thumbnail.id}`;
    const updateUrl = new URL(`${env.SUPABASE_URL}/rest/v1/uploaded_photos`);
    updateUrl.searchParams.set("id", `eq.${recordId}`);
    const updated = await fetch(updateUrl, {
      method: "PATCH",
      headers: supabaseHeaders(env),
      body: JSON.stringify({
        thumbnail_url: thumbnailUrl,
        thumbnail_storage_path: `gdrive:${thumbnail.id}`,
      }),
    });
    if (!updated.ok) throw new Error(`썸네일 목록 저장 실패 (${updated.status})`);
    return json({ thumbnailUrl }, 201, cors(origin));
  } catch (error) {
    if (thumbnail?.id) await deleteDriveFile(env, thumbnail.id).catch(() => undefined);
    throw error;
  }
}

async function driveThumbnail(request, env, id, ctx) {
  if (!validFileId(id)) return new Response("Not found", { status: 404 });

  const cacheKey = new Request(request.url, { method: "GET" });
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const metadata = await googleFetch(
    env,
    `${DRIVE_API}/files/${id}?fields=id,mimeType,thumbnailLink`
  );
  if (!metadata.ok) return new Response("Not found", { status: metadata.status === 404 ? 404 : 502 });

  const file = await metadata.json();
  if (!String(file.mimeType || "").startsWith("image/")) {
    return new Response("Not found", { status: 404 });
  }

  let response = file.thumbnailLink
    ? await googleFetch(env, file.thumbnailLink)
    : null;
  let cacheable = Boolean(response?.ok);

  if (!response?.ok) {
    response = await googleFetch(env, `${DRIVE_API}/files/${id}?alt=media`);
    cacheable = false;
  }
  if (!response.ok) return new Response("Not found", { status: response.status === 404 ? 404 : 502 });

  const headers = new Headers();
  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) return new Response("Not found", { status: 404 });
  headers.set("content-type", contentType);
  const contentLength = response.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);
  headers.set("cache-control", cacheable
    ? "public, max-age=2592000, stale-while-revalidate=604800"
    : "public, max-age=300");
  headers.set("access-control-allow-origin", "*");
  headers.set("x-content-type-options", "nosniff");

  const thumbnail = new Response(response.body, { status: 200, headers });
  if (cacheable) ctx?.waitUntil(caches.default.put(cacheKey, thumbnail.clone()));
  return thumbnail;
}

async function media(request, env, id) {
  if (!validFileId(id)) return new Response("Not found", { status: 404 });
  const requestUrl = new URL(request.url);
  const requestHeaders = {};
  if (request.headers.get("range")) requestHeaders.range = request.headers.get("range");
  const response = await googleFetch(env, `${DRIVE_API}/files/${id}?alt=media`, {
    method: request.method,
    headers: requestHeaders,
  });
  if (!response.ok) return new Response("Not found", { status: response.status === 404 ? 404 : 502 });

  const headers = new Headers();
  for (const key of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = response.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  headers.set("x-content-type-options", "nosniff");

  if (requestUrl.searchParams.has("download")) {
    const requestedName = clean(requestUrl.searchParams.get("download"), 180);
    const downloadName = safeDriveName(requestedName || "wedding-original", 180);
    const fallbackName = `wedding-original.${extension(downloadName)}`;
    headers.set(
      "content-disposition",
      `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    );
  }

  return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers });
}

async function safeEqual(left, right) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(left || ""))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(right || ""))),
  ]);
  return crypto.subtle.timingSafeEqual(leftHash, rightHash);
}

async function verifyAdminPassword(env, passwordHash) {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/app_admin_settings`);
  url.searchParams.set("select", "value");
  url.searchParams.set("key", "eq.upload_admin_password_hash");
  url.searchParams.set("limit", "1");
  const response = await fetch(url, { headers: supabaseHeaders(env) });
  if (!response.ok) throw new Error(`관리자 설정 확인 실패 (${response.status})`);
  const expected = (await response.json())[0]?.value || "";
  return safeEqual(expected, passwordHash);
}

async function driveFolderStatus(env, id) {
  const response = await googleFetch(
    env,
    `${DRIVE_API}/files/${id}?fields=id,name,mimeType,trashed`
  );
  if (!response.ok) return { ok: false, status: response.status, name: null };
  const folder = await response.json();
  return {
    ok: folder.mimeType === "application/vnd.google-apps.folder" && !folder.trashed,
    status: response.status,
    name: folder.name || null,
  };
}

async function photoStorageRows(env) {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/uploaded_photos`);
  url.searchParams.set("select", "storage_path,thumbnail_url,thumbnail_storage_path,media_type,file_size");
  url.searchParams.set("limit", "10000");
  const response = await fetch(url, { headers: supabaseHeaders(env) });
  if (!response.ok) throw new Error(`사진 저장 현황 조회 실패 (${response.status})`);
  return response.json();
}

async function adminStorageStats(request, env, origin) {
  const passwordHash = clean(request.headers.get("x-admin-password-hash"), 64);
  if (!/^[0-9a-f]{64}$/i.test(passwordHash)) {
    return json({ error: "관리자 인증이 필요합니다." }, 401, cors(origin));
  }
  if (!(await verifyAdminPassword(env, passwordHash))) {
    return json({ error: "관리자 비밀번호가 올바르지 않습니다." }, 403, cors(origin));
  }

  const [quota, originalsFolder, thumbnailsFolder, rows] = await Promise.all([
    driveUsage(env),
    driveFolderStatus(env, env.GOOGLE_DRIVE_ORIGINALS_FOLDER_ID),
    env.GOOGLE_DRIVE_THUMBNAILS_FOLDER_ID
      ? driveFolderStatus(env, env.GOOGLE_DRIVE_THUMBNAILS_FOLDER_ID)
      : Promise.resolve({ ok: true, status: 204, name: "별도 저장 안 함" }),
    photoStorageRows(env),
  ]);
  const configuredLimit = numberSetting(env.MAX_STORAGE_BYTES, DEFAULT_MAX_STORAGE_BYTES);
  const uploadLimit = quota.limit ? Math.min(quota.limit, configuredLimit) : configuredLimit;
  const usageBytes = Math.max(0, quota.usage || 0);
  const driveOriginals = rows.filter((row) => String(row.storage_path || "").startsWith("gdrive:")).length;
  const driveThumbnails = rows.filter((row) => String(row.thumbnail_storage_path || "").startsWith("gdrive:")).length;
  const dynamicThumbnails = rows.filter((row) => String(row.thumbnail_url || "").includes("/thumbnail/")).length;
  const missingThumbnails = rows.filter((row) =>
    row.media_type === "image" &&
    !String(row.thumbnail_storage_path || "").startsWith("gdrive:") &&
    !String(row.thumbnail_url || "").includes("/thumbnail/")
  ).length;
  const legacyFiles = rows.length - driveOriginals;
  const guestOriginalBytes = rows.reduce((sum, row) => sum + Number(row.file_size || 0), 0);

  return json({
    storage: {
      usageBytes,
      accountLimitBytes: Math.max(0, quota.limit || 0),
      uploadLimitBytes: uploadLimit,
      remainingUploadBytes: Math.max(0, uploadLimit - usageBytes),
      usagePercent: uploadLimit > 0 ? Math.min(100, (usageBytes / uploadLimit) * 100) : 0,
      guestOriginalBytes,
    },
    files: {
      records: rows.length,
      driveOriginals,
      driveThumbnails,
      dynamicThumbnails,
      missingThumbnails,
      legacyFiles,
    },
    folders: {
      originals: originalsFolder,
      thumbnails: thumbnailsFolder,
    },
  }, 200, cors(origin));
}

function missingSettings(env) {
  return [
    "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN",
    "GOOGLE_DRIVE_ORIGINALS_FOLDER_ID", "GOOGLE_DRIVE_THUMBNAILS_FOLDER_ID",
    "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ALLOWED_ORIGINS",
  ].filter((key) => !env[key]);
}

async function uploadRateLimit(request, env, origin) {
  const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
  const folderKey = clean(request.headers.get("x-upload-folder-key"), 80);

  if (env.UPLOAD_CLIENT_RATE_LIMITER) {
    const clientKey = validFolderKey(folderKey) ? `${clientIp}:${folderKey}` : `${clientIp}:unknown`;
    const { success } = await env.UPLOAD_CLIENT_RATE_LIMITER.limit({ key: clientKey });
    if (!success) {
      return json(
        { error: "이 기기에서 업로드 요청이 잠시 많습니다. 1분 후 다시 시도해주세요." },
        429,
        cors(origin)
      );
    }
  }

  if (env.UPLOAD_RATE_LIMITER) {
    const { success } = await env.UPLOAD_RATE_LIMITER.limit({ key: clientIp });
    if (!success) {
      return json(
        { error: "현재 네트워크에서 업로드 요청이 많습니다. 1분 후 다시 시도해주세요." },
        429,
        cors(origin)
      );
    }
  }

  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      const missing = missingSettings(env);
      return json({ ok: missing.length === 0, missing }, missing.length ? 503 : 200);
    }
    const match = url.pathname.match(/^\/media\/([A-Za-z0-9_-]+)$/);
    if (match && ["GET", "HEAD"].includes(request.method)) return media(request, env, match[1]);
    const thumbnailMatch = url.pathname.match(/^\/thumbnail\/([A-Za-z0-9_-]+)$/);
    if (thumbnailMatch && request.method === "GET") {
      return driveThumbnail(request, env, thumbnailMatch[1], ctx);
    }

    const origin = getAllowedOrigin(request, env);
    if (request.method === "OPTIONS") return origin ? new Response(null, { status: 204, headers: cors(origin) }) : new Response(null, { status: 403 });
    if (!origin) return json({ error: "허용되지 않은 요청입니다." }, 403);
    const missing = missingSettings(env);
    if (missing.length) return json({ error: "업로드 서버 설정이 완료되지 않았습니다.", missing }, 503, cors(origin));

    try {
      if (url.pathname === "/upload" && request.method === "POST") {
        const limited = await uploadRateLimit(request, env, origin);
        return limited || await originalUpload(request, env, origin);
      }
      if (url.pathname === "/thumbnail" && request.method === "POST") {
        const limited = await uploadRateLimit(request, env, origin);
        return limited || await thumbnailUpload(request, env, origin);
      }
      if (url.pathname === "/admin/storage-stats" && request.method === "GET") return await adminStorageStats(request, env, origin);
      return json({ error: "Not found" }, 404, cors(origin));
    } catch (error) {
      console.error(error);
      return json({ error: error instanceof Error ? error.message : "업로드 서버 오류" }, 500, cors(origin));
    }
  },
};
