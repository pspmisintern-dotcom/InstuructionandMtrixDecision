# Logo Configuration

## Adding Your Logo

To use your Plasma Spray logo instead of the default placeholder:

1. **Replace the logo file:**
   - Save your logo image as `logo.png` in this directory: `/public/images/logo.png`
   - Supported formats: PNG (recommended), SVG, JPG
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
- The logo area has a border-radius of 8px (rounded corners)
- Dark mode support: Background adjusts automatically

## Next Steps

1. Prepare your logo image (PNG format, 200x200px minimum)
2. Place it as `logo.png` in `/public/images/`
3. Restart the development server
4. The logo will appear throughout the application!

---

**Current Status:** Using default factory emoji as placeholder
