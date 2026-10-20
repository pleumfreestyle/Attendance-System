# Attendance-System API Contract

เอกสารนี้เป็นสัญญาการเชื่อมต่อระหว่าง Frontend (GitHub Pages) กับ Backend (Cloudflare Worker + D1) เพื่อให้สามารถปรับหน้าเว็บได้โดยไม่ต้องเปลี่ยน API ตามทุกครั้ง

## Base URL

`https://school-attendance-api.projectcsemn.workers.dev`

> URL นี้เป็น Worker ที่ใช้งานอยู่ในปัจจุบัน แต่โค้ดใน branch `feature/real-attendance-backend` ยังไม่ deploy ดังนั้น endpoint ด้านล่างอธิบายตามโค้ดใน branch และต้องทดสอบกับ staging ก่อนใช้งานจริง

## รูปแบบทั่วไป

- Request/response ใช้ JSON และ UTF-8
- เส้นทางที่ต้องเข้าสู่ระบบให้ส่ง header `Authorization: Bearer <token>`
- token หมดอายุใน 8 ชั่วโมง; เปลี่ยน/รีเซ็ตรหัสผ่านแล้ว token เดิมจะใช้ไม่ได้
- เมื่อสำเร็จจะมี `success: true`; เมื่อผิดพลาดจะมี `success: false` และ `message` ภาษาไทย
- Frontend ต้องไม่เก็บ secret ของ Worker หรือ LINE ไว้ใน JavaScript/HTML
- Frontend ต้องจัดการสถานะ HTTP ด้วย ไม่ควรตรวจเฉพาะข้อความใน `message`

## API สำหรับผู้ใช้

| Method | Path | Auth | หน้าที่ |
|---|---|---|---|
| POST | `/api/register` | ไม่ต้อง | สมัครบัญชี; บัญชีใหม่เริ่มเป็นรออนุมัติ |
| POST | `/api/login` | ไม่ต้อง | เข้าสู่ระบบและรับ token |
| GET | `/api/me` | ต้อง | ข้อมูลบัญชีปัจจุบัน |
| POST | `/api/me/password` | ต้อง | เปลี่ยนรหัสผ่าน |
| POST | `/api/password-reset-requests` | ไม่ต้อง | ส่งคำขอรีเซ็ตรหัสผ่าน |
| GET | `/api/work-location` | ต้อง | อ่านสถานที่ทำงานที่เปิดใช้งาน |
| GET | `/api/attendance` | ต้อง | ดูประวัติลงเวลา |
| POST | `/api/attendance` | ต้อง | ลงเวลาเข้า/ออกโดยตรวจ geofence |
| GET | `/api/leave-requests` | ต้อง | ดูคำขอลาของบัญชีตัวเอง |
| POST | `/api/leave-requests` | ต้อง | ส่งคำขอลา |

### ตัวอย่าง request

สมัครบัญชี:

```json
{
  "staffCode": "EMP001",
  "fullName": "ชื่อ นามสกุล",
  "email": "user@example.com",
  "position": "เจ้าหน้าที่",
  "password": "อย่างน้อย 8 ตัวอักษร"
}
```

เข้าสู่ระบบ:

```json
{
  "email": "user@example.com",
  "password": "รหัสผ่าน"
}
```

ลงเวลาเข้า/ออก:

```json
{
  "type": "check_in",
  "latitude": 14.2341,
  "longitude": 100.5774,
  "accuracy": 25
}
```

ค่า `type` รองรับ `check_in` และ `check_out`; `accuracy` เป็นค่าความคลาดเคลื่อน GPS หน่วยเมตร และ API ปัจจุบันรับเฉพาะค่าไม่เกิน 100 เมตร

ส่งคำขอลา:

```json
{
  "leaveType": "ลากิจ",
  "startDate": "2026-10-22",
  "endDate": "2026-10-22",
  "reason": "ธุระส่วนตัว"
}
```

## API สำหรับผู้ดูแลระบบ

ทุกเส้นทางในหมวดนี้ต้องใช้ token ของบัญชีที่มี role `admin`

| Method | Path | หน้าที่ |
|---|---|---|
| GET | `/api/admin/personnel` | ดูรายชื่อบุคลากร |
| POST | `/api/admin/approve` | อนุมัติ/ระงับบัญชีด้วย `{ "id": 1, "active": true }` |
| POST | `/api/admin/personnel/role` | เปลี่ยนบทบาทเป็น `staff`, `supervisor` หรือ `admin` |
| GET | `/api/admin/locations` | ดูสถานที่ทำงานทั้งหมด |
| POST | `/api/admin/locations` | เพิ่มสถานที่ทำงาน |
| PATCH | `/api/admin/locations` | เปิด/ปิดสถานที่ หรือเปลี่ยนรัศมี |
| GET | `/api/admin/shifts` | ดูกะทำงาน |
| POST | `/api/admin/shifts` | เพิ่มกะทำงาน |
| PATCH | `/api/admin/shifts` | เปิด/ปิดกะทำงาน |
| GET | `/api/admin/leaves` | ดูคำขอลาทั้งหมด |
| POST | `/api/admin/leaves/review` | อนุมัติ/ปฏิเสธคำขอลา |
| GET | `/api/admin/password-reset-requests` | ดูคำขอรีเซ็ตรหัสผ่าน |
| POST | `/api/admin/password-reset` | ออก temporary password สำหรับคำขอที่รอจัดการ |

### ตัวอย่างข้อมูลตอบกลับ

เข้าสู่ระบบสำเร็จ:

```json
{
  "success": true,
  "token": "<bearer-token>",
  "expiresIn": 28800,
  "user": {
    "id": 1,
    "staff_code": "EMP001",
    "full_name": "ชื่อ นามสกุล",
    "email": "user@example.com",
    "position": "เจ้าหน้าที่",
    "role": "staff",
    "is_active": 1
  }
}
```

ตัวอย่างข้อผิดพลาด:

```json
{
  "success": false,
  "message": "กรุณาเข้าสู่ระบบ"
}
```

## สถานะ HTTP ที่ Frontend ควรรองรับ

| Status | ความหมายทั่วไป | แนวทางบนหน้าเว็บ |
|---|---|---|
| 200 | สำเร็จ | แสดงข้อมูล/ข้อความสำเร็จ |
| 201 | สร้างข้อมูลสำเร็จ | ยืนยันการสมัคร/ลงเวลา/ส่งคำขอ |
| 202 | รับคำขอแล้ว | แจ้งว่ารับคำขอรีเซ็ตรหัสผ่านแล้ว |
| 400 | ข้อมูลไม่ถูกต้อง | แสดงข้อความและให้แก้ข้อมูล |
| 401 | ไม่มี token หรือ token ใช้ไม่ได้ | กลับไปเข้าสู่ระบบ |
| 403 | ไม่มีสิทธิ์/อยู่นอกพื้นที่ | แสดงเหตุผล ห้ามทำซ้ำโดยอัตโนมัติ |
| 404 | ไม่พบข้อมูลหรือเส้นทาง | แจ้งว่าไม่พบรายการ |
| 409 | ข้อมูลซ้ำ/สถานะไม่ตรง | รีโหลดข้อมูลก่อนลองอีกครั้ง |
| 500/502/503 | ระบบหรือบริการที่พึ่งพามีปัญหา | แจ้งให้ลองใหม่ภายหลัง และบันทึกข้อมูลวินิจฉัยที่ไม่ใช่ความลับ |

## ข้อตกลงที่ควรคงไว้ระหว่างพัฒนา Frontend

1. ใช้ path, method, ชื่อ field และชนิดข้อมูลตามเอกสารนี้ อย่าผูก logic กับข้อความภาษาไทยใน `message` เพียงอย่างเดียว
2. เก็บ token ในสถานะ session ของแอปและแนบเป็น Bearer token; ห้ามฝัง token คงที่ใน source code
3. แยก URL ของ staging และ production ไว้ใน config จุดเดียว เพื่อสลับ backend ได้โดยไม่แก้ทุกหน้า
4. อย่าใช้ localStorage เป็นฐานข้อมูลจริง; ข้อมูลบัญชี การลงเวลา และคำขอลาต้องอ่าน/เขียนผ่าน API
5. บัญชีที่สมัครใหม่ยังเข้าใช้งานไม่ได้จนกว่าแอดมินจะอนุมัติ
6. การตรวจ GPS ฝั่ง server ใช้พิกัดจาก browser จึงช่วยตรวจพื้นที่ได้ แต่ไม่สามารถป้องกันการปลอม GPS ได้สมบูรณ์
7. การขอรีเซ็ตรหัสผ่านยังไม่มีการส่งอีเมลอัตโนมัติ; แอดมินต้องตรวจสอบตัวตนและส่งรหัสชั่วคราวผ่านช่องทางที่เชื่อถือได้

## รายการตรวจสอบก่อน deploy

- [ ] สมัครบัญชีและป้องกันอีเมล/รหัสบุคลากรซ้ำ
- [ ] Login ถูกต้อง, รหัสผ่านผิด, บัญชีรออนุมัติ และบัญชีถูกระงับ
- [ ] API ที่ต้อง auth ปฏิเสธ token หาย/ผิด/หมดอายุ
- [ ] ผู้ใช้ทั่วไปไม่สามารถเรียก API แอดมินได้
- [ ] ตรวจ geofence ทั้งในและนอกพื้นที่ และ GPS accuracy ที่ไม่ผ่านเกณฑ์
- [ ] ป้องกันลงเวลาเข้าซ้ำและออกก่อนเข้า
- [ ] ส่ง/พิจารณาคำขอลาและตรวจสิทธิ์
- [ ] เปลี่ยนรหัสผ่านและยกเลิก token เดิม
- [ ] รีเซ็ตรหัสผ่านโดยแอดมินและตรวจการเปิดเผย temporary password
- [ ] ตรวจ CORS จาก GitHub Pages
- [ ] ทดสอบ LINE webhook signature ถูก/ผิด และส่งข้อความทดสอบจริง
- [ ] ตรวจว่า Worker ที่ทดสอบเป็น staging ไม่ใช่ production ก่อนทดสอบที่อาจเปลี่ยนข้อมูล
