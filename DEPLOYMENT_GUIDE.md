# Buckets PWA - Deployment Guide

## Summary of Changes

### Security (Phase 1) - COMPLETED ✓
- **Fixed .env.example**: Replaced real API key with placeholder `your_anthropic_api_key_here`
- **Verified .gitignore**: Confirmed `.env`, `.env.local`, `.convex/`, and `convex/_generated/` are properly excluded
- **Ready for git**: Safe to commit and share repository publicly

### PWA Configuration (Phase 2) - COMPLETED ✓

#### Created Files:
1. **public/manifest.json** - PWA manifest with:
   - App name: "Buckets - Personal Budgeting"
   - Theme colors matching your app design (#4747FF blue, #F5F3F0 cream)
   - Standalone display mode for full-screen experience
   - Portrait orientation
   - App shortcuts for quick actions

2. **public/icons/** - App icons:
   - icon-192x192.svg
   - icon-512x512.svg
   - apple-touch-icon.svg (for iOS)
   - favicon.svg

3. **public/service-worker.js** - Offline support with:
   - Cache-first strategy for static assets
   - Network-first strategy for Convex API calls
   - Automatic cache management and updates

4. **src/serviceWorkerRegistration.ts** - Service worker registration logic

#### Modified Files:
1. **public/index.html** - Added:
   - PWA manifest link
   - Theme color meta tag
   - iOS PWA support meta tags
   - Apple touch icon
   - Favicon

2. **App.web.tsx** - Added service worker registration on app load

3. **webpack.config.js** - Enhanced with:
   - Production mode support
   - CopyWebpackPlugin for PWA assets
   - Content hashing for cache busting
   - Auto-clean dist folder

4. **package.json** - Updated build:web script with NODE_ENV=production

### Build & Test (Phase 3) - COMPLETED ✓
- Production bundle built successfully in `dist/` folder
- All PWA assets copied correctly
- Local test server running at http://localhost:3000

---

## Next Steps: Deploy & Install

### Option A: Deploy to Vercel (Recommended - Free)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

4. **Set Environment Variables** (in Vercel dashboard):
   - Go to your project settings
   - Add environment variables:
     - `CONVEX_URL`: Your Convex deployment URL
     - `ANTHROPIC_API_KEY`: Your actual Anthropic API key
   - Redeploy after adding variables

### Option B: Deploy to Netlify

1. **Using Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod --dir=dist
   ```

2. **Or drag & drop**:
   - Go to https://app.netlify.com/drop
   - Drag the `dist/` folder to the upload area

3. **Set Environment Variables** (in Netlify dashboard):
   - Go to Site settings → Environment variables
   - Add the same variables as Vercel

### Option C: GitHub Pages

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Add PWA support and deployment configuration"
   git push origin main
   ```

2. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Deploy from branch
   - Branch: main, folder: /dist
   - Save

3. **Note**: GitHub Pages doesn't support environment variables. You'll need to build locally with your environment variables, then push the dist folder.

---

## Install on iPhone

Once deployed, follow these steps to install Buckets as a native-like app:

1. **Open Safari** on your iPhone (must be Safari, not Chrome)

2. **Navigate to your deployed URL**:
   - Vercel: https://your-app-name.vercel.app
   - Netlify: https://your-app-name.netlify.app
   - GitHub Pages: https://username.github.io/buckets

3. **Add to Home Screen**:
   - Tap the Share button (square with arrow pointing up)
   - Scroll down and tap "Add to Home Screen"
   - Edit the name if desired (default: "Buckets")
   - Tap "Add"

4. **Launch the App**:
   - Find the Buckets icon on your home screen
   - Tap to open in full-screen mode
   - It will look and feel like a native app!

---

## PWA Features Enabled

Your Buckets app now has:

- **Installable**: Can be added to iPhone home screen
- **Full-screen**: Runs without Safari UI
- **Offline-capable**: Service worker caches assets
- **Fast loading**: Cached resources load instantly
- **Auto-updates**: New versions detected automatically
- **Native feel**: Launch animation, splash screen, theme colors

---

## Local Testing

The local server is currently running at http://localhost:3000

To test PWA features:
1. Open http://localhost:3000 in your browser
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to Application tab
4. Check:
   - Manifest section shows your app info
   - Service Workers section shows registered worker
   - Cache Storage shows cached assets

To stop the local server:
```bash
kill $(lsof -ti:3000)
```

---

## Important Security Notes

### For Development:
- Your actual API keys are in `.env.local` (gitignored)
- `.env.example` has placeholders only (safe to commit)

### For Production:
- API keys are currently bundled in the JavaScript (visible in browser)
- For better security, consider creating a backend API proxy:
  - Create a simple Express/Vercel serverless function
  - Store API keys server-side
  - Client calls your API, which calls Anthropic
  - This keeps keys truly secret

### Sharing on Git:
1. **Before committing**, verify:
   ```bash
   git status
   # .env.local should NOT appear
   # .env.example should appear (with placeholder)
   ```

2. **Safe to commit**:
   - .env.example (placeholder only)
   - All PWA assets
   - Source code

3. **Never commit**:
   - .env or .env.local (real keys)
   - node_modules/
   - dist/ (build artifacts)
   - .convex/ (Convex generated files)

---

## Troubleshooting

### Service Worker Not Registering
- Ensure you're using HTTPS (or localhost)
- Check browser console for errors
- Verify service-worker.js is accessible at root URL

### App Not Installing on iPhone
- Must use Safari (not Chrome/Firefox)
- Check manifest.json is valid (use Chrome DevTools)
- Ensure all required fields in manifest are present

### Environment Variables Not Working
- Rebuild after changing .env.local: `npm run build:web`
- In hosting platforms, redeploy after adding variables
- Remember: client-side apps bundle env vars at build time

### Offline Mode Not Working
- Check Service Worker is registered in DevTools
- Verify caches are populated (Application → Cache Storage)
- Hard refresh (Cmd+Shift+R) to clear old caches

---

## Build Commands Reference

```bash
# Development server with hot reload
npm run web

# Production build
npm run build:web

# Test production build locally
npx serve dist -l 3000

# Deploy to Vercel
vercel --prod

# Deploy to Netlify
netlify deploy --prod --dir=dist
```

---

## File Structure

```
Buckets/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── service-worker.js      # Service worker
│   ├── index.html             # HTML template (with PWA meta tags)
│   ├── icons/                 # App icons
│   │   ├── icon-192x192.svg
│   │   ├── icon-512x512.svg
│   │   ├── apple-touch-icon.svg
│   │   └── favicon.svg
│   └── fonts/                 # Web fonts
├── src/
│   └── serviceWorkerRegistration.ts  # SW registration logic
├── dist/                      # Production build output (gitignored)
├── .env.local                 # Real API keys (gitignored)
├── .env.example               # Template with placeholders (committed)
└── webpack.config.js          # Webpack config with PWA support
```

---

## Success! 🎉

Your Buckets app is now a fully-featured Progressive Web App, ready to deploy and install on your iPhone like a native app. No App Store submission needed!

**What's Next?**
1. Choose a hosting platform (Vercel recommended)
2. Deploy your app
3. Install on your iPhone
4. Start budgeting on the go!

**Need Help?**
- Check the troubleshooting section above
- Review browser console for errors
- Test locally first before deploying
