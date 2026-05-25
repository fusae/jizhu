#!/usr/bin/env python3
"""Generate app icon for tieji — green rounded rect with 'T' mark."""
import struct, zlib

def png_chunk(ctype, data):
    c = ctype + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

def create_icon(size, br, bg, bb):
    raw = b''
    for y in range(size):
        raw += b'\x00'  # filter byte
        for x in range(size):
            raw += pixel(x, y, size, br, bg, bb)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = png_chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    idat = png_chunk(b'IDAT', zlib.compress(raw))
    iend = png_chunk(b'IEND', b'')
    return header + ihdr + idat + iend

def pixel(x, y, s, br, bg, bb):
    m = s * 0.12
    r = s * 0.16
    in_rect = True
    if x < m or x > s - m or y < m or y > s - m:
        in_rect = False
        corners = [(m+r, m+r), (s-m-r, m+r), (m+r, s-m-r), (s-m-r, s-m-r)]
        for cx, cy in corners:
            if ((x-cx)**2 + (y-cy)**2) < r**2:
                in_rect = True; break
    if not in_rect:
        return bytes([245, 245, 240])

    # 'T' letter
    tx, ty = s/2, s*0.36
    tw = s*0.17
    th = s*0.32
    st = max(2, int(s*0.06))
    if abs(y - ty) < st and abs(x - tx) < tw:
        return bytes([255, 255, 255])
    if abs(x - tx) < st and y > ty - st and y < ty + th:
        return bytes([255, 255, 255])

    # Red dot
    dx, dy = s*0.73, s*0.27
    dr = s*0.07
    if ((x-dx)**2 + (y-dy)**2) < dr**2:
        return bytes([235, 87, 87])

    return bytes([br, bg, bb])

# Generate all sizes
assets = '/Users/jamesyu/Projects/task-reminder/assets'
for size in [1024, 512, 256, 128, 64, 32, 16]:
    png = create_icon(size, 31, 79, 58)
    with open(f'{assets}/icon-{size}.png', 'wb') as f:
        f.write(png)

# Main icon (1024)
import shutil
shutil.copy(f'{assets}/icon-1024.png', f'{assets}/icon.png')

# Tray icons
png16 = create_icon(16, 31, 79, 58)
with open(f'{assets}/tray-icon.png', 'wb') as f:
    f.write(png16)
png16t = create_icon(16, 0, 0, 0)
with open(f'{assets}/tray-iconTemplate.png', 'wb') as f:
    f.write(png16t)

# Windows ICO (256x256 PNG)
shutil.copy(f'{assets}/icon-256.png', f'{assets}/icon.ico')

print('All icons generated')
