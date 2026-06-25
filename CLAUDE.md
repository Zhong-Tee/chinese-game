# Project Notes

## Communication
- ตอบกลับผู้ใช้เป็นภาษาไทยทุกครั้ง (Always respond to the user in Thai.)

## Dev environment
- Platform: Windows. ใน `.claude/launch.json` ให้รัน vite ผ่าน `node` ตรงๆ (runtimeExecutable: `node`, runtimeArgs: `["node_modules/vite/bin/vite.js"]`) เพราะ `npm` จะเจอ `spawn npm ENOENT` และ `npm.cmd` จะเจอ `spawn EINVAL` (Node เวอร์ชันใหม่ห้าม spawn `.cmd` ตรงๆ โดยไม่ผ่าน shell).
