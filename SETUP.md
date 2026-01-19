# Buckets App Setup Guide

This guide will help you set up and run the Buckets budgeting app on your local machine.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- iOS: Xcode and CocoaPods (for iOS development)
- Android: Android Studio and JDK (for Android development)
- Anthropic API key (for Claude integration)
- Convex account (free tier available)

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory by copying the example:

```bash
cp .env.example .env
```

Then edit `.env` and add your keys:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CONVEX_URL=your_convex_deployment_url_here
```

**Getting your Anthropic API key:**
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key

### 3. Set Up Convex Backend

First, log in to Convex:

```bash
npx convex login
```

Then initialize your Convex development deployment:

```bash
npx convex dev
```

This will:
- Create a new Convex project (or link to existing)
- Generate the `_generated` folder with type definitions
- Give you a deployment URL to add to your `.env` file
- Start watching for changes to your Convex functions

**Important:** Copy the deployment URL from the output and add it to your `.env` file as `CONVEX_URL`.

### 4. iOS Setup (macOS only)

Install CocoaPods dependencies:

```bash
cd ios
bundle install
bundle exec pod install
cd ..
```

### 5. Run the App

**For iOS:**
```bash
npm run ios
# or
npx react-native run-ios
```

**For Android:**
```bash
npm run android
# or
npx react-native run-android
```

## Project Structure

```
Buckets/
├── convex/                    # Convex backend functions and schema
│   ├── schema.ts             # Database schema definitions
│   ├── users.ts              # User-related functions
│   ├── buckets.ts            # Bucket management functions
│   ├── expenses.ts           # Expense tracking functions
│   ├── income.ts             # Income distribution functions
│   └── recurringExpenses.ts  # Recurring expense functions
├── src/
│   ├── components/           # Reusable UI components
│   ├── screens/              # Screen components
│   ├── navigation/           # Navigation configuration
│   ├── services/             # External service integrations
│   │   └── claudeService.ts  # Claude AI integration
│   ├── hooks/                # Custom React hooks
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── App.tsx                   # Main app component
└── index.js                  # Entry point

```

## Development Workflow

### Running Convex in Development

Keep Convex running in a separate terminal:

```bash
npx convex dev
```

This watches for changes to your Convex functions and automatically deploys them.

### Using Convex Dashboard

View and manage your data:

```bash
npx convex dashboard
```

### Deploying Convex to Production

When ready to deploy:

```bash
npx convex deploy
```

Update your production app's `CONVEX_URL` to the production deployment URL.

## Common Issues

### Convex Types Not Found

If you see TypeScript errors about missing Convex types:

1. Make sure `npx convex dev` is running
2. Check that `convex/_generated` folder exists
3. Restart your TypeScript server in your IDE

### Environment Variables Not Loading

1. Restart Metro bundler after changing `.env`:
   ```bash
   npm start -- --reset-cache
   ```

2. For iOS, rebuild the app after changing environment variables

### CocoaPods Issues (iOS)

If you encounter pod installation issues:

```bash
cd ios
pod deintegrate
bundle exec pod install
cd ..
```

## Next Steps

1. **Set up authentication**: Add user authentication using Convex Auth or your preferred method
2. **Build screens**: Start implementing the UI screens (Buckets Overview, Add Expense, etc.)
3. **Add notifications**: Implement push notifications for low balance alerts
4. **Test Claude integration**: Create the chat interface for Claude interactions

## Resources

- [React Native Documentation](https://reactnative.dev/)
- [Convex Documentation](https://docs.convex.dev/)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [React Navigation Documentation](https://reactnavigation.org/)

## Support

For issues specific to:
- **React Native**: Check [React Native troubleshooting](https://reactnative.dev/docs/troubleshooting)
- **Convex**: Visit [Convex Discord](https://convex.dev/community)
- **Claude API**: See [Anthropic support](https://support.anthropic.com/)
