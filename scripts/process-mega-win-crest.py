import os
from PIL import Image, ImageEnhance

src_path = r'C:\Users\Mee\.gemini\antigravity\brain\09707229-94c2-42d2-b606-17d81e0f3f06\mega_win_crest_1793515630217.jpg'
dest_webp = r'public\assets\neon\mega_win_royal_gold.webp'
dest_png = r'public\assets\neon\mega_win_royal_gold.png'
dest_artifact = r'C:\Users\Mee\.gemini\antigravity\brain\09707229-94c2-42d2-b606-17d81e0f3f06\mega_win_crest.webp'

print(f"Loading generated source: {src_path}")
img = Image.open(src_path).convert('RGB')

# 1. Color Enhancement: Rich 24K gold, vivid cyan electric lightning, blazing amber fire
enhancer_col = ImageEnhance.Color(img)
img = enhancer_col.enhance(1.24)

enhancer_con = ImageEnhance.Contrast(img)
img = enhancer_con.enhance(1.14)

enhancer_bri = ImageEnhance.Brightness(img)
img = enhancer_bri.enhance(1.06)

# 2. Convert to RGBA and perform clean smooth alpha matting on dark background
rgba = img.convert('RGBA')
datas = list(rgba.getdata())

new_data = []
for item in datas:
    r, g, b, a = item
    mx = max(r, g, b)
    if mx < 16:
        # Transparent background
        new_data.append((0, 0, 0, 0))
    elif mx < 42:
        # Smooth anti-aliased edge glow transition
        alpha = int(255 * ((mx - 16) / (42 - 16)))
        new_data.append((r, g, b, alpha))
    else:
        new_data.append((r, g, b, 255))

rgba.putdata(new_data)

# 3. Crop slightly to tight bounding box with 10px breathing room
bbox = rgba.getbbox()
if bbox:
    left = max(0, bbox[0] - 10)
    top = max(0, bbox[1] - 10)
    right = min(rgba.width, bbox[2] + 10)
    bottom = min(rgba.height, bbox[3] + 10)
    rgba = rgba.crop((left, top, right, bottom))

print(f"Cropped to content: {rgba.size}")

# 4. Save to target files
os.makedirs(os.path.dirname(dest_webp), exist_ok=True)
rgba.save(dest_webp, format='WEBP', quality=95, method=6)
print(f"Saved: {dest_webp} ({os.path.getsize(dest_webp)} bytes)")

rgba.save(dest_png, format='PNG', optimize=True)
print(f"Saved: {dest_png} ({os.path.getsize(dest_png)} bytes)")

rgba.save(dest_artifact, format='WEBP', quality=95, method=6)
print(f"Saved: {dest_artifact} ({os.path.getsize(dest_artifact)} bytes)")

print("Processing complete!")
