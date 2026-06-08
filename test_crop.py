import urllib.request
from PIL import Image
import io

def get_borders(url):
    req = urllib.request.urlopen(url)
    img = Image.open(io.BytesIO(req.read())).convert('RGB')
    w, h = img.size
    
    # find top border
    top = 0
    for y in range(h):
        row = [img.getpixel((x, y)) for x in range(w//2, w//2 + 10)]
        if any(c != (255, 255, 255) for c in row):
            top = y
            break
            
    # find bottom border
    bottom = h
    for y in range(h-1, -1, -1):
        row = [img.getpixel((x, y)) for x in range(w//2, w//2 + 10)]
        if any(c != (255, 255, 255) for c in row):
            bottom = y
            break
            
    print(f"{url} -> Top margin: {top}, Bottom margin: {h - bottom - 1}")

get_borders("https://ocean.weather.gov/UA/OPC_PAC.gif")
get_borders("https://ocean.weather.gov/UA/Pac_Tropics.gif")
