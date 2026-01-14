/**
 * Image Optimization Utility
 * ปรับขนาดและคุณภาพของภาพเพื่อให้โหลดเร็วขึ้น
 */

export const optimizeImageUrl = (url, options = {}) => {
  if (!url) return url;
  
  // ตั้งค่า default
  const {
    width = 800,      // ลดขนาดความกว้าง
    height = 1200,    // ลดขนาดความสูง
    quality = 85,     // คุณภาพ 85% (ยังดูดีแต่ไฟล์เล็กลง)
    format = 'auto'   // รูปแบบ (auto = ให้ browser เลือก)
  } = options;
  
  // ถ้า URL เป็น Supabase Storage
  if (url.includes('supabase.co/storage') || url.includes('supabase')) {
    // Supabase Storage รองรับ query parameters สำหรับ transform
    // ใช้ query params สำหรับ resize และ optimize
    const separator = url.includes('?') ? '&' : '?';
    
    // สร้าง optimized URL
    // Note: Supabase Storage อาจต้องใช้ transformation API
    // ถ้าไม่รองรับ query params ให้ return URL เดิม
    return `${url}${separator}width=${width}&height=${height}&quality=${quality}`;
  }
  
  // ถ้าใช้ CDN อื่นๆ เช่น Cloudinary, Imgix
  // สามารถเพิ่ม logic สำหรับ CDN อื่นๆ ได้ที่นี่
  
  // ถ้าไม่ใช่ URL ที่รองรับ optimization ให้ return เดิม
  return url;
};

/**
 * ตรวจสอบว่า browser รองรับ WebP หรือไม่
 */
export const supportsWebP = () => {
  if (typeof window === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
};

/**
 * แปลง URL เป็น WebP format ถ้า browser รองรับ
 */
export const convertToWebP = (url) => {
  if (!url || !supportsWebP()) return url;
  
  // ถ้า URL มี extension ให้เปลี่ยนเป็น .webp
  // หรือเพิ่ม query parameter ตามที่ CDN รองรับ
  if (url.includes('supabase')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}format=webp`;
  }
  
  return url;
};

