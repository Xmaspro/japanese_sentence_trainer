import sys
import os
from PIL import Image

def remove_checkerboard(image_path, output_path):
    if not os.path.exists(image_path):
        print(f"File not found: {image_path}")
        return

    img = Image.open(image_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()

    # Define helper to check if a color is a checkerboard color
    # Checkerboard colors are usually desaturated (R ~ G ~ B) and very bright (> 150)
    # The grid pattern has alternating white (#FFFFFF) and light grey (around #E6E6E6 or #CCCCCC)
    def is_checkerboard_color(color):
        r, g, b, a = color
        # Check if it's bright and desaturated
        is_bright = (r > 150 and g > 150 and b > 150)
        is_gray = (abs(r - g) < 20 and abs(g - b) < 20 and abs(r - b) < 20)
        return is_bright and is_gray

    # We will create a transparency mask (L mode: 255 is opaque, 0 is transparent)
    mask = Image.new("L", (width, height), 255)
    
    # Collect seeds along the border of the image
    seeds = []
    for x in range(width):
        if is_checkerboard_color(pixels[x, 0]):
            seeds.append((x, 0))
        if is_checkerboard_color(pixels[x, height - 1]):
            seeds.append((x, height - 1))
    for y in range(height):
        if is_checkerboard_color(pixels[0, y]):
            seeds.append((0, y))
        if is_checkerboard_color(pixels[width - 1, y]):
            seeds.append((width - 1, y))

    # Add the 4 corners as guaranteed seeds
    for pt in [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]:
        seeds.append(pt)

    # Perform BFS flood fill to mark background pixels
    visited = set()
    queue = list(set(seeds))
    
    while queue:
        cx, cy = queue.pop(0)
        if (cx, cy) in visited:
            continue
        visited.add((cx, cy))
        
        # Make this pixel transparent in the mask
        mask.putpixel((cx, cy), 0)

        # Check 4-connected neighbors
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < width and 0 <= ny < height:
                if (nx, ny) not in visited:
                    ncol = pixels[nx, ny]
                    if is_checkerboard_color(ncol):
                        queue.append((nx, ny))

    # Soften the edges slightly by blurring the mask slightly or just applying it
    # We will just put the mask into the alpha channel directly for crisp transparent edges
    img.putalpha(mask)
    
    # Save the resulting image
    img.save(output_path, "PNG")
    print(f"Saved transparent image to: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python remove_checkerboard.py input.png output.png")
    else:
        remove_checkerboard(sys.argv[1], sys.argv[2])
