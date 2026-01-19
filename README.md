# Buckets - Budget Tracking App

A beautiful, intuitive budget tracking app built with React Native that helps you organize your spending with customizable buckets and AI-powered insights.

## Features

### ✅ Implemented
- **Budget Buckets**: Create and manage spending buckets with fixed amounts or percentages
- **Expense Tracking**: Log expenses with notes and happiness ratings
- **Real-time Sync**: Powered by Convex for instant updates across devices
- **Monthly Allocation**: View spending by month with calendar picker
- **Low Balance Alerts**: Get notified when buckets are running low
- **Bucket Details**: Detailed transaction history for each bucket
- **Web & Mobile**: Works on iOS, Android, and Web

### 🚧 Coming Soon
- **Income Management**: Track multiple income sources
- **AI Chat Assistant**: Get spending advice from Claude AI
- **Recurring Expenses**: Set up auto-tracking for bills
- **Analytics Dashboard**: Visualize spending patterns
- **Happiness Insights**: Correlate purchases with happiness ratings

## Tech Stack

- **Frontend**: React Native + TypeScript
- **Web**: React Native Web with Webpack
- **Backend**: Convex (real-time database)
- **AI**: Claude API (Anthropic)
- **Icons**: Lucide React
- **Fonts**: Merchant Copy (monospace)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- For mobile: React Native development environment ([setup guide](https://reactnative.dev/docs/environment-setup))
- For iOS: Xcode and CocoaPods
- For Android: Android Studio

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd Buckets
   npm install
   ```

2. **Set up Convex** (Required for backend):

   Follow the detailed guide in [CONVEX_SETUP.md](./CONVEX_SETUP.md)

   Quick start:
   ```bash
   npx convex dev
   ```

   This will:
   - Create a Convex account (free)
   - Initialize your deployment
   - Generate API types
   - Give you a deployment URL

3. **Configure environment**:
   ```bash
   cp .env.example .env.local
   ```

   Add your Convex URL to `.env.local`:
   ```
   CONVEX_URL=https://your-deployment.convex.cloud
   ```

4. **Install iOS dependencies** (iOS only):
   ```bash
   bundle install
   bundle exec pod install
   ```

### Running the App

#### Web
```bash
npm start
```
Open http://localhost:3000 in your browser

#### iOS
```bash
npm run ios
```

#### Android
```bash
npm run android
```

## Project Structure

```
Buckets/
├── src/
│   ├── screens/           # Main app screens
│   │   ├── BucketsOverview.web.tsx    # Bucket list with month picker
│   │   ├── BucketDetail.web.tsx       # Transaction history
│   │   ├── AddBucket.tsx              # Create new bucket
│   │   ├── AddExpense.tsx             # Log expense
│   │   ├── ChatScreen.tsx             # AI chat (coming soon)
│   │   └── Settings.tsx               # App settings
│   ├── components/        # Reusable components
│   │   └── BucketCard.tsx            # Bucket list item
│   ├── lib/
│   │   └── convex.ts                 # Convex client setup
│   └── types/            # TypeScript types
├── convex/               # Backend (Convex)
│   ├── schema.ts         # Database schema
│   ├── buckets.ts        # Bucket CRUD operations
│   ├── expenses.ts       # Expense tracking
│   ├── users.ts          # User management
│   ├── income.ts         # Income tracking (coming soon)
│   └── _generated/       # Auto-generated (don't edit)
├── App.web.tsx          # Web app entry point
└── public/              # Web assets
```

## Backend (Convex)

The app uses Convex for real-time backend functionality. All screens are already wired up to Convex:

### Database Schema
- **users**: User accounts
- **buckets**: Budget buckets with allocation tracking
- **expenses**: Expense records with happiness ratings
- **income**: Income sources (coming soon)
- **recurringExpenses**: Recurring expense templates (coming soon)

### API Functions

All functions are in the `convex/` directory:

**Buckets** (`convex/buckets.ts`):
- `create`: Create a new bucket
- `getByUser`: Get all buckets for a user
- `updateBalance`: Update bucket balance
- `update`: Update bucket details
- `remove`: Soft delete a bucket

**Expenses** (`convex/expenses.ts`):
- `create`: Log an expense (auto-updates bucket balance)
- `getByUser`: Get user's expense history
- `getByBucket`: Get expenses for a specific bucket
- `update`: Update an expense
- `remove`: Delete an expense (refunds bucket)

**Users** (`convex/users.ts`):
- `create`: Create a new user
- `get`: Get user by ID
- `update`: Update user details
- `getCurrentUser`: Get current demo user
- `initDemoUser`: Initialize demo account

## Development

### Available Scripts

- `npm start` - Start web dev server
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator
- `npm run lint` - Run ESLint
- `npm run typescript` - Type check

### Environment Variables

Create `.env.local` with:

```bash
# Convex Backend
CONVEX_URL=https://your-deployment.convex.cloud

# AI Chat (optional - for future feature)
ANTHROPIC_API_KEY=your_api_key_here
```

### Adding New Features

1. Define data schema in `convex/schema.ts`
2. Create API functions in `convex/*.ts`
3. Run `npx convex dev` to regenerate types
4. Import from `convex/_generated/api` in React components
5. Use `useQuery` for reads, `useMutation` for writes

Example:
```typescript
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';

// In your component
const buckets = useQuery(api.buckets.getByUser, { userId });
const createBucket = useMutation(api.buckets.create);
```

## Design

The app uses a clean, modern design with:
- **Merchant Copy** monospace font for a unique financial aesthetic
- **Lucide icons** for consistent, crisp iconography
- **Blue primary color** (#4747FF) with high contrast
- **Minimal shadows** and rounded corners
- **Apple-inspired** month picker and navigation

## Troubleshooting

### Convex Errors
If you see "Module not found: convex/_generated/api":
1. Make sure `npx convex dev` is running
2. Check that `.env.local` has your `CONVEX_URL`
3. Restart your dev server

### iOS Build Issues
```bash
cd ios
bundle exec pod install --repo-update
cd ..
npm run ios
```

### Android Build Issues
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Web Hot Reload Not Working
```bash
# Clear cache and restart
rm -rf node_modules/.cache
npm start
```

## Contributing

This is a personal project, but suggestions are welcome! Feel free to:
- Report bugs via GitHub issues
- Suggest features
- Submit pull requests

## License

MIT

## Acknowledgments

- Built with [React Native](https://reactnative.dev)
- Backend by [Convex](https://convex.dev)
- AI by [Anthropic Claude](https://anthropic.com)
- Icons by [Lucide](https://lucide.dev)
