# Logo Configuration

## Adding Your Logo

To use your Plasma Spray logo instead of the default placeholder:

1. **Replace the logo file:**
   - Save your logo image as `logo.svg` in this directory: `/frontend/public/images/logo.svg`
   - Supported formats: PNG, SVG, JPG
   - Recommended size: 200x200px or larger (will be scaled automatically)

2. **Logo placement:**
   The logo will appear in:
   - Top navigation bar (40x40px)
   - Login page (60x60px)
   - Page headers (where applicable)

3. **Automatic fallback:**
   - If the logo file is not found, the system will display the default industrial factory emoji (🏭)
   - The background color will remain the gradient blue theme

## Logo Component

The logo is managed by the `Logo` component at `/frontend/components/Logo.js`:
- `size="small"` → 40x40px (used in navigation)
- `size="large"` → 60x60px (used in login/headers)
- `showText={true}` → Displays "WI Manager" text beside logo
- `showText={false}` → Logo only

## Styling

- Background: Linear gradient from #2196F3 to #0D47A1 (Industrial Blue)
- The logo area is rendered as a circle (`border-radius: 50%`) with the image cropped to fill it (`object-fit: cover`)
- Dark mode support: Background adjusts automatically

## Next Steps

1. Prepare your logo image (SVG or PNG format, 200x200px minimum)
2. Place it as `logo.svg` in `/frontend/public/images/`
3. Restart the development server
4. The logo will appear throughout the application!

---

**Current Status:** Using custom SVG logo (thermal spray nozzle design)
