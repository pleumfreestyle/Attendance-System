// Cloudflare Worker API for Attendance-System
// Required bindings: D1 database "DB"; secret "JWT_SECRET" (random, at least 32 bytes).
// Deploy only after applying schema.sql and configuring JWT_SECRET.
const TOKEN_TTL_SECONDS = 8 * 60 * 60;
const ALLOWED_ORIGIN = "https://pleumfreestyle.github.io";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
function b64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromB64url(value) {
  const s = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s + "=".repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
}
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function issueToken(user, secret) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(new TextEncoder().encode(JSON.stringify({ sub: user.id, role: user.role, iat: now, exp: now + TOKEN_TTL_SECONDS })));
  const input = head + "." + body;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(input));
  return input + "." + b64url(new Uint8Array(sig));
}
async function readToken(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const parts = token.split(".");
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || parts.length !== 3) return null;
  try {
    const input = parts[0] + "." + parts[1];
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env.JWT_SECRET), fromB64url(parts[2]), new TextEncoder().encode(input));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])));
    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    const user = await env.DB.prepare("SELECT id, staff_code, full_name, email, position, role, is_active FROM personnel WHERE id = ?").bind(payload.sub).first();
    if (!user || !user.is_active) return null;
    return user;
  } catch {
    return null;
  }
}
async function passwordHash(password, salt, iterations) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, 256);
  return new Uint8Array(bits);
}
function base64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function verifyPassword(password, stored) {
  const [scheme, rounds, saltText, hashText] = String(stored || "").split("$");
  const iterations = Number(rounds);
  if (scheme !== "pbkdf2" || !Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
  try {
    return equalBytes(await passwordHash(password, fromB64urlSafeBase64(saltText), iterations), Uint8Array.from(atob(hashText), c => c.charCodeAt(0)));
  } catch {
    return false;
  }
}
function fromB64urlSafeBase64(value) {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
function thaiDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function distanceMeters(aLat, aLng, bLat, bLng) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const cors = {};
    if (origin === ALLOWED_ORIGIN) {
      cors["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN;
      cors["Access-Control-Allow-Methods"] = "GET, POST, PATCH, OPTIONS";
      cors["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
      cors["Access-Control-Max-Age"] = "86400";
      cors.Vary = "Origin";
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!url.pathname.startsWith("/api/") && url.pathname !== "/") return json({ success: false, message: "ไม่พบเส้นทางที่ร้องขอ" }, 404, cors);
    if (url.pathname === "/" && request.method === "GET") return new Response("School Attendance API is running.", { headers: cors });
    if (!env.DB) return json({ success: false, message: "ยังไม่ได้เชื่อมต่อฐานข้อมูล" }, 500, cors);
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) return json({ success: false, message: "ระบบยังไม่ได้ตั้งค่า JWT_SECRET" }, 503, cors);

    const body = async () => {
      try { return await request.json(); } catch { return null; }
    };

    try {
      if (request.method === "POST" && url.pathname === "/api/register") {
        const data = await body();
        if (!data) return json({ success: false, message: "รูปแบบข้อมูลไม่ถูกต้อง" }, 400, cors);
        const fullName = String(data.fullName || "").trim();
        const email = String(data.email || "").trim().toLowerCase();
        const staffCode = String(data.staffCode || "").trim();
        const position = String(data.position || "").trim();
        const password = String(data.password || "");
        if (!fullName || !email || !staffCode || !position || !password) return json({ success: false, message: "กรุณากรอกข้อมูลให้ครบทุกช่อง" }, 400, cors);
        if (fullName.length > 150 || email.length > 254 || staffCode.length > 50 || position.length > 100) return json({ success: false, message: "ข้อมูลบางช่องยาวเกินกำหนด" }, 400, cors);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ success: false, message: "รูปแบบอีเมลไม่ถูกต้อง" }, 400, cors);
        if (password.length < 8 || password.length > 128) return json({ success: false, message: "รหัสผ่านต้องมีความยาว 8–128 ตัวอักษร" }, 400, cors);
        const iterations = 210000;
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await passwordHash(password, salt, iterations);
        const stored = "pbkdf2$" + iterations + "$" + base64(salt) + "$" + base64(hash);
        await env.DB.prepare("INSERT INTO personnel (staff_code, full_name, email, position, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, 'staff', 0)")
          .bind(staffCode, fullName, email, position, stored).run();
        return json({ success: true, message: "สมัครสมาชิกสำเร็จ กรุณารอผู้ดูแลอนุมัติบัญชี" }, 201, cors);
      }

      if (request.method === "POST" && url.pathname === "/api/login") {
        const data = await body();
        const email = String(data?.email || "").trim().toLowerCase();
        const password = String(data?.password || "");
        if (!email || !password) return json({ success: false, message: "กรุณากรอกอีเมลและรหัสผ่าน" }, 400, cors);
        const user = await env.DB.prepare("SELECT id, staff_code, full_name, email, position, password_hash, role, is_active FROM personnel WHERE email = ? COLLATE NOCASE").bind(email).first();
        if (!user || !(await verifyPassword(password, user.password_hash))) return json({ success: false, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, 401, cors);
        if (!user.is_active) return json({ success: false, message: "บัญชียังไม่ได้รับอนุมัติหรือถูกระงับ กรุณาติดต่อผู้ดูแล" }, 403, cors);
        const token = await issueToken(user, env.JWT_SECRET);
        delete user.password_hash;
        return json({ success: true, token, expiresIn: TOKEN_TTL_SECONDS, user }, 200, cors);
      }

      if (url.pathname === "/api/me" && request.method === "GET") {
        const user = await readToken(request, env);
        if (!user) return json({ success: false, message: "เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่" }, 401, cors);
        return json({ success: true, user }, 200, cors);
      }

      if (url.pathname === "/api/work-location" && request.method === "GET") {
        const user = await readToken(request, env);
        if (!user) return json({ success: false, message: "กรุณาเข้าสู่ระบบ" }, 401, cors);
        const location = await env.DB.prepare("SELECT id, name, latitude, longitude, radius_meters FROM work_locations WHERE is_active = 1 ORDER BY id LIMIT 1").first();
        if (!location) return json({ success: false, message: "ยังไม่ได้ตั้งค่าสถานที่ทำงาน" }, 503, cors);
        return json({ success: true, location }, 200, cors);
      }

      if (url.pathname === "/api/attendance" && request.method === "GET") {
        const user = await readToken(request, env);
        if (!user) return json({ success: false, message: "กรุณาเข้าสู่ระบบ" }, 401, cors);
        const isAdmin = user.role === "admin" || user.role === "supervisor";
        const rows = isAdmin
          ? await env.DB.prepare("SELECT a.id, a.personnel_id, p.full_name, p.staff_code, a.attendance_type, a.recorded_at, a.latitude, a.longitude, a.note FROM attendance_records a JOIN personnel p ON p.id = a.personnel_id ORDER BY a.recorded_at DESC LIMIT 500").all()
          : await env.DB.prepare("SELECT id, personnel_id, attendance_type, recorded_at, latitude, longitude, note FROM attendance_records WHERE personnel_id = ? ORDER BY recorded_at DESC LIMIT 100").bind(user.id).all();
        return json({ success: true, records: rows.results || [] }, 200, cors);
      }

      if (url.pathname === "/api/attendance" && request.method === "POST") {
        const user = await readToken(request, env);
        if (!user) return json({ success: false, message: "กรุณาเข้าสู่ระบบ" }, 401, cors);
        const data = await body();
        if (!data || !["check_in", "check_out"].includes(data.type)) return json({ success: false, message: "ประเภทการลงเวลาไม่ถูกต้อง" }, 400, cors);
        const lat = Number(data.latitude), lng = Number(data.longitude), accuracy = Number(data.accuracy);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return json({ success: false, message: "พิกัด GPS ไม่ถูกต้อง" }, 400, cors);
        if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) return json({ success: false, message: "ความแม่นยำ GPS ต่ำเกินไป กรุณาลองใหม่ในพื้นที่เปิดโล่ง" }, 400, cors);
        const location = await env.DB.prepare("SELECT id, name, latitude, longitude, radius_meters FROM work_locations WHERE is_active = 1 ORDER BY id LIMIT 1").first();
        if (!location) return json({ success: false, message: "ยังไม่ได้ตั้งค่าสถานที่ทำงาน" }, 503, cors);
        const distance = distanceMeters(lat, lng, location.latitude, location.longitude);
        if (distance > location.radius_meters) return json({ success: false, message: "อยู่นอกพื้นที่ปฏิบัติงาน", distance: Math.round(distance), radius: location.radius_meters }, 403, cors);
        const day = thaiDate();
        const today = await env.DB.prepare("SELECT id, attendance_type, recorded_at FROM attendance_records WHERE personnel_id = ? AND date(recorded_at, '+7 hours') = ? ORDER BY recorded_at ASC").bind(user.id, day).all();
        const records = today.results || [];
        if (data.type === "check_in" && records.some(x => x.attendance_type === "check_in")) return json({ success: false, message: "วันนี้ลงเวลาเข้างานแล้ว" }, 409, cors);
        if (data.type === "check_out" && (!records.some(x => x.attendance_type === "check_in") || records.some(x => x.attendance_type === "check_out"))) return json({ success: false, message: "ไม่สามารถลงเวลาออกได้ กรุณาตรวจสอบการลงเวลาเข้า-ออก" }, 409, cors);
        const now = new Date().toISOString();
        const note = "ระยะจากจุดทำงานประมาณ " + Math.round(distance) + " เมตร; GPS accuracy " + Math.round(accuracy) + " เมตร";
        const result = await env.DB.prepare("INSERT INTO attendance_records (personnel_id, attendance_type, recorded_at, latitude, longitude, face_verified, note) VALUES (?, ?, ?, ?, ?, 0, ?)")
          .bind(user.id, data.type, now, lat, lng, note).run();
        return json({ success: true, message: data.type === "check_in" ? "ลงเวลาเข้างานสำเร็จ" : "ลงเวลาออกงานสำเร็จ", id: result.meta?.last_row_id, recordedAt: now, distance: Math.round(distance) }, 201, cors);
      }

      if (url.pathname === "/api/admin/personnel" && request.method === "GET") {
        const user = await readToken(request, env);
        if (!user) return json({ success: false, message: "กรุณาเข้าสู่ระบบ" }, 401, cors);
        if (user.role !== "admin") return json({ success: false, message: "ไม่มีสิทธิ์ดำเนินการ" }, 403, cors);
        const rows = await env.DB.prepare("SELECT id, staff_code, full_name, email, position, role, is_active, created_at FROM personnel ORDER BY created_at DESC").all();
        return json({ success: true, personnel: rows.results || [] }, 200, cors);
      }

      if (url.pathname === "/api/admin/approve" && request.method === "POST") {
        const user = await readToken(request, env);
        if (!user) return json({ success: false, message: "กรุณาเข้าสู่ระบบ" }, 401, cors);
        if (user.role !== "admin") return json({ success: false, message: "ไม่มีสิทธิ์ดำเนินการ" }, 403, cors);
        const data = await body();
        const id = Number(data?.id);
        const active = data?.active;
        if (!Number.isInteger(id) || id < 1 || typeof active !== "boolean") return json({ success: false, message: "ข้อมูลอนุมัติไม่ถูกต้อง" }, 400, cors);
        const result = await env.DB.prepare("UPDATE personnel SET is_active = ? WHERE id = ?").bind(active ? 1 : 0, id).run();
        if (!result.meta?.changes) return json({ success: false, message: "ไม่พบบัญชีบุคลากร" }, 404, cors);
        await env.DB.prepare("INSERT INTO audit_logs (personnel_id, action, details) VALUES (?, ?, ?)").bind(user.id, active ? "personnel_approved" : "personnel_suspended", "personnel_id=" + id).run();
        return json({ success: true, message: active ? "อนุมัติบัญชีแล้ว" : "ระงับบัญชีแล้ว" }, 200, cors);
      }

      return json({ success: false, message: "ไม่พบเส้นทางที่ร้องขอ" }, 404, cors);
    } catch (error) {
      if (/UNIQUE constraint failed/i.test(String(error?.message))) return json({ success: false, message: "รหัสบุคลากรหรืออีเมลนี้ถูกใช้แล้ว" }, 409, cors);
      console.error("Attendance API error", error?.message || error);
      return json({ success: false, message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่" }, 500, cors);
    }
  },
};
