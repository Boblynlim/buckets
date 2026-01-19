# How to Deploy the App to GitHub Pages (Instead of Docs)

## Why You're Seeing Docs Instead of the App

GitHub Pages is currently serving your repository's root directory, which contains all your `.md` documentation files. To deploy the actual **app**, you need to:

1. Set up Convex backend
2. Build the web app
3. Configure GitHub Pages to serve the `dist/` folder

---

## Option 1: Quick Fix - Manual Deployment (Requires Convex Setup)

### Step 1: Set Up Convex Backend

The app requires Convex backend to be initialized first:

```bash
# Install Convex CLI globally
npm install -g convex

# Initialize Convex (you'll need to create a free account)
npx convex dev
```

This will:
- Prompt you to login/create a Convex account (free)
- Generate API files in `convex/_generated/`
- Give you a deployment URL like `https://xxx.convex.cloud`

**Keep this terminal running** while you complete the next steps.

### Step 2: Configure Environment Variables

Create a `.env.local` file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Convex URL:

```env
CONVEX_URL=https://your-deployment.convex.cloud
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Step 3: Build the Web App

```bash
npm run build:web
```

This creates a `dist/` folder with your built app.

### Step 4: Deploy to GitHub Pages

You have two options:

#### Option A: Use GitHub Actions (Automated - Recommended)

1. Get your Convex deploy key:
   ```bash
   npx convex deploy --preview-create
   ```
   Copy the deploy key shown.

2. Add it to GitHub Secrets:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `CONVEX_DEPLOY_KEY`
   - Value: Paste your deploy key

3. Push to trigger deployment:
   ```bash
   git add .
   git commit -m "Add GitHub Pages deployment workflow"
   git push origin main
   ```

4. Enable GitHub Pages:
   - Go to Settings → Pages
   - Source: GitHub Actions

Your app will now auto-deploy on every push to main!

#### Option B: Manual Deployment with gh-pages Branch

```bash
# Install gh-pages package
npm install -D gh-pages

# Deploy dist folder to gh-pages branch
npx gh-pages -d dist
```

Then configure GitHub Pages:
- Go to Settings → Pages
- Source: Deploy from a branch
- Branch: `gh-pages` / root

---

## Option 2: Use Vercel or Netlify (Easiest - Recommended)

**⚠️ Important**: GitHub Pages has limitations with Convex apps. **Vercel or Netlify are much easier** because they handle Convex integration automatically.

### Deploy to Vercel (30 seconds)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Then add environment variables in the Vercel dashboard:
- `CONVEX_URL`: Your Convex deployment URL
- `ANTHROPIC_API_KEY`: Your API key

### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod --dir=dist
```

Add the same environment variables in Netlify dashboard.

---

## Comparison: GitHub Pages vs Vercel/Netlify

| Feature | GitHub Pages | Vercel/Netlify |
|---------|--------------|----------------|
| **Setup complexity** | High (manual Convex setup) | Low (automatic) |
| **Environment variables** | Requires secrets + workflow | Simple dashboard |
| **Convex integration** | Manual setup required | Automatic |
| **Build on deploy** | Yes (with Actions) | Yes (automatic) |
| **Custom domain** | Yes | Yes (easier setup) |
| **Preview deploys** | No | Yes |
| **Rollbacks** | Manual | One-click |

**Recommendation**: Use Vercel for the easiest experience.

---

## Current GitHub Pages Configuration

If you want to see what GitHub Pages is currently serving:

1. Go to your repo → Settings → Pages
2. You'll see the source configuration

To check what's being served, look at the URL structure:
- `https://username.github.io/buckets/` - Your GitHub Pages site
- Currently showing docs because there's no proper build deployed

---

## Files Created

I've created:
- `.github/workflows/deploy-gh-pages.yml` - Automated deployment workflow
- This guide (`GITHUB_PAGES_FIX.md`)

---

## Quick Commands Reference

```bash
# Set up Convex (one-time)
npx convex dev

# Build the app
npm run build:web

# Manual GitHub Pages deploy
npx gh-pages -d dist

# Deploy to Vercel (easiest)
vercel --prod

# Deploy to Netlify
netlify deploy --prod --dir=dist
```

---

## Troubleshooting

### "Module not found: convex/_generated/api"
- You need to run `npx convex dev` first
- Make sure it's still running in a separate terminal
- The generated files should appear in `convex/_generated/`

### GitHub Pages still showing docs
- Check Settings → Pages for the correct source
- If using gh-pages branch, make sure it's selected
- Wait a few minutes for deployment to complete
- Clear your browser cache

### Build fails with environment variable errors
- Make sure `.env.local` exists with `CONVEX_URL`
- For GitHub Actions, add `CONVEX_DEPLOY_KEY` secret
- For Vercel/Netlify, add variables in dashboard

---

## My Recommendation

**Use Vercel** - it's the easiest path forward:

1. Run `npx convex dev` once to set up your backend
2. Get your Convex URL
3. Run `vercel --prod`
4. Add environment variables in Vercel dashboard
5. Done! Your app is live and will auto-deploy on git push

GitHub Pages works but requires more setup and maintenance.
