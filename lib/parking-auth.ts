import { cookies } from "next/headers";

export type ParkingRole = "admin" | "staff_wash";

export type ParkingSession = {
  userId: string;
  email: string;
  fullName: string;
  role: ParkingRole;
};

type AuthUser = {
  id: string;
  email?: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user: AuthUser;
};

const ACCESS_COOKIE = "parking_access_token";
const REFRESH_COOKIE = "parking_refresh_token";

function config() {
  return {
    url: (process.env.SUPABASE_URL || "").replace(/\/$/, ""),
    adminKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
  };
}

function ensureConfig() {
  const current = config();
  if (!current.url || !current.adminKey) {
    throw new Error("Chưa cấu hình đầy đủ Supabase cho đăng nhập.");
  }
  return current;
}

async function responseError(response: Response) {
  const text = await response.text();
  if (!text) return `Supabase trả về lỗi ${response.status}.`;
  try {
    const parsed = JSON.parse(text) as { message?: string; error_description?: string; msg?: string };
    return parsed.message || parsed.error_description || parsed.msg || text;
  } catch {
    return text;
  }
}

export async function adminRequest(path: string, init: RequestInit = {}) {
  const { url, adminKey } = ensureConfig();
  const legacyJwtKey = !adminKey.startsWith("sb_secret_");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: adminKey,
      ...(legacyJwtKey ? { Authorization: `Bearer ${adminKey}` } : {}),
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(await responseError(response));
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function authRequest(path: string, init: RequestInit = {}) {
  const { url, adminKey, publishableKey } = ensureConfig();
  const apiKey = publishableKey || adminKey;
  const response = await fetch(`${url}/auth/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json();
}

function loginEmail(username: string) {
  const clean = username.trim().toLowerCase();
  return clean.includes("@") ? clean : `${clean}@parking.local`;
}

async function profileFor(user: AuthUser): Promise<ParkingSession | null> {
  const rows = await adminRequest(
    `parking_profiles?select=user_id,email,full_name,role,is_active&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
  ) as Array<Record<string, unknown>>;
  const profile = rows[0];
  if (!profile || !profile.is_active) return null;
  const role = String(profile.role);
  if (role !== "admin" && role !== "staff_wash") return null;
  return {
    userId: String(profile.user_id),
    email: String(profile.email || user.email || ""),
    fullName: String(profile.full_name || profile.email || user.email || ""),
    role,
  };
}

async function setTokenCookies(tokens: TokenResponse) {
  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  store.set(ACCESS_COOKIE, tokens.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, Number(tokens.expires_in || 3600)),
  });
  store.set(REFRESH_COOKIE, tokens.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function userFromAccessToken(accessToken: string): Promise<AuthUser | null> {
  try {
    return await authRequest("user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }) as AuthUser;
  } catch {
    return null;
  }
}

export async function loginParkingUser(username: string, password: string) {
  if (!username.trim() || !password) throw new Error("Vui lòng nhập tên đăng nhập và mật khẩu.");
  const tokens = await authRequest("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: loginEmail(username), password }),
  }) as TokenResponse;
  const session = await profileFor(tokens.user);
  if (!session) throw new Error("Tài khoản chưa được cấp quyền sử dụng hệ thống.");
  await setTokenCookies(tokens);
  return session;
}

export async function getParkingSession(): Promise<ParkingSession | null> {
  ensureConfig();
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value || "";
  const refreshToken = store.get(REFRESH_COOKIE)?.value || "";

  let user = accessToken ? await userFromAccessToken(accessToken) : null;
  if (!user && refreshToken) {
    try {
      const tokens = await authRequest("token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      }) as TokenResponse;
      await setTokenCookies(tokens);
      user = tokens.user;
    } catch {
      user = null;
    }
  }
  if (!user) return null;
  return profileFor(user);
}

export async function logoutParkingUser() {
  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    store.set(name, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  }
}
