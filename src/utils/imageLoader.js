import { optimizeImageUrl } from './imageOptimizer';

/**
 * โหลดภาพแบบ Parallel (หลายภาพพร้อมกัน) แบ่งเป็น batch
 * @param {string[]} urls - Array ของ image URLs
 * @param {number} batchSize - จำนวนภาพที่โหลดพร้อมกันในแต่ละ batch (default: 5)
 * @param {function} onProgress - Callback function ที่รับ progress (0-100)
 * @returns {Promise<number>} จำนวนภาพที่โหลดสำเร็จ
 */
export const loadImagesInBatches = async (urls, batchSize = 5, onProgress) => {
  if (!urls || urls.length === 0) {
    if (onProgress) onProgress(100);
    return 0;
  }
  
  const total = urls.length;
  let loaded = 0;
  const errors = [];
  
  // แบ่ง URLs เป็น batches
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    // โหลด batch นี้พร้อมกัน (parallel)
    const promises = batch.map(url => {
      return new Promise((resolve) => {
        // Optimize URL ก่อนโหลด
        const optimizedUrl = optimizeImageUrl(url, {
          width: 800,
          height: 1200,
          quality: 85
        });
        
        const img = new Image();
        
        img.onload = () => {
          loaded++;
          if (onProgress) {
            onProgress(Math.floor((loaded / total) * 100));
          }
          resolve({ success: true, url });
        };
        
        img.onerror = () => {
          console.warn('Failed to load image:', url);
          errors.push(url);
          loaded++;
          if (onProgress) {
            onProgress(Math.floor((loaded / total) * 100));
          }
          resolve({ success: false, url });
        };
        
        // เริ่มโหลด
        img.src = optimizedUrl;
      });
    });
    
    // รอให้ batch นี้โหลดเสร็จก่อนไป batch ถัดไป
    await Promise.all(promises);
  }
  
  if (errors.length > 0) {
    console.warn(`${errors.length} images failed to load`);
  }
  
  return loaded;
};

/**
 * โหลดภาพแบบ Lazy (เฉพาะภาพที่ต้องใช้ทันที + ภาพถัดไป)
 * @param {Array} cards - Array ของ card objects
 * @param {number} preloadCount - จำนวนภาพที่โหลดล่วงหน้า (default: 6 = ภาพแรก + 5 ภาพถัดไป)
 * @param {function} onProgress - Callback function ที่รับ progress (0-100)
 * @returns {Promise<number>} จำนวนภาพที่โหลดสำเร็จ
 */
export const lazyLoadImages = async (cards, preloadCount = 6, onProgress) => {
  if (!cards || cards.length === 0) {
    if (onProgress) onProgress(100);
    return 0;
  }
  
  // จำกัดจำนวนที่โหลด
  const count = Math.min(preloadCount, cards.length);
  
  // รวบรวม URLs ที่ต้องโหลด
  const urlsToPreload = [];
  for (let i = 0; i < count; i++) {
    const card = cards[i];
    if (card?.image_front_url) {
      urlsToPreload.push(card.image_front_url);
    }
    if (card?.image_back_url) {
      urlsToPreload.push(card.image_back_url);
    }
  }
  
  // โหลดแบบ parallel
  return await loadImagesInBatches(urlsToPreload, 5, onProgress);
};

/**
 * โหลดภาพถัดไปแบบ background (ไม่บล็อก UI)
 * @param {Array} cards - Array ของ card objects ที่เหลือ
 * @param {number} count - จำนวนภาพที่โหลดล่วงหน้า (default: 3)
 */
export const preloadNextImages = (cards, count = 3) => {
  if (!cards || cards.length === 0) return;
  
  const preloadCount = Math.min(count, cards.length);
  
  // โหลดใน background (ไม่รอผลลัพธ์)
  for (let i = 0; i < preloadCount; i++) {
    const card = cards[i];
    
    if (card?.image_front_url) {
      const img1 = new Image();
      img1.src = optimizeImageUrl(card.image_front_url);
    }
    
    if (card?.image_back_url) {
      const img2 = new Image();
      img2.src = optimizeImageUrl(card.image_back_url);
    }
  }
};

