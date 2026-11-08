export async function conversationErrorMessage(error) {
  const status = error?.context?.status;
  if (status === 404) return 'ระบบสร้างบทเรียนยังไม่พร้อม: ไม่พบฟังก์ชัน generate-conversation บนเซิร์ฟเวอร์ กรุณาแจ้งผู้ดูแล';
  if (status === 401) return 'ยืนยันการเข้าสู่ระบบไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่';
  try {
    const body = await error?.context?.json();
    if (typeof body?.error === 'string' && body.error.trim()) return body.error;
  } catch { /* The gateway may return a non-JSON response. */ }
  if (status === 429) return 'มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่';
  if (status >= 500) return 'บริการสร้างบทเรียนขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง';
  return 'ติดต่อบริการสร้างบทเรียนไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ หากยังไม่ได้ให้แจ้งผู้ดูแล';
}
