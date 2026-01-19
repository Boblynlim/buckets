# Convex Setup Guide

This app uses Convex as the backend database. Follow these steps to get it running:

## 1. Initialize Convex

Run the following command in your terminal:

```bash
npx convex dev
```

This will:
- Prompt you to login to your Convex account (create one if needed - it's free)
- Create a new Convex deployment
- Generate the API types in `convex/_generated/`
- Give you a deployment URL

## 2. Configure Environment Variables

After running `npx convex dev`, copy the deployment URL and create a `.env.local` file:

```bash
# Copy from .env.example
cp .env.example .env.local
```

Then edit `.env.local` and add your Convex deployment URL:

```
CONVEX_URL=https://your-deployment.convex.cloud
```

## 3. (Optional) Add Anthropic API Key

For the AI chat feature, you'll need an Anthropic API key:

```
ANTHROPIC_API_KEY=your_api_key_here
```

Get your API key from: https://console.anthropic.com/

## 4. Start the Development Server

After Convex is initialized, start your web dev server:

```bash
npm start
```

The app will now connect to your Convex backend and all features will work!

## What's Already Set Up

The following Convex backend features are already implemented:

### Database Schema
- **users**: User accounts
- **buckets**: Budget buckets with allocation and balance tracking
- **expenses**: Expense tracking with happiness ratings
- **income**: Income tracking
- **recurringExpenses**: Recurring expense templates
- **claudeConversations**: AI chat history

### API Functions
- **buckets**: create, getByUser, updateBalance, update, remove
- **expenses**: create, getByUser, getByBucket, update, remove
- **users**: create, get, update, getCurrentUser, initDemoUser
- **income**: create, getByUser, update, remove

All frontend components are already wired up to use these functions!

## Troubleshooting

If you see errors about missing `convex/_generated/api`:
- Make sure `npx convex dev` is running in a separate terminal
- Check that the generated files exist in `convex/_generated/`
- Restart your dev server after Convex generates the files
