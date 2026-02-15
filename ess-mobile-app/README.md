# WiseDrive ESS Mobile App

React Native mobile application for Employee Self-Service.

## Features

- 🔐 **Authentication** - Secure login with device registration and single-device policy
- 🏠 **Dashboard** - Quick overview of leave balance, attendance, and quick actions
- 📅 **Leave Management** - Apply for leave, view history, track status
- 💰 **Payslips** - View and download monthly payslips
- 📄 **Documents** - View uploaded documents and completion status
- 🔔 **Notifications** - Push notifications and in-app alerts
- 👤 **Profile** - View personal info, bank details, salary summary
- ⚙️ **Settings** - Notification preferences and quiet hours

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator (Mac only) or Android Emulator
- Expo Go app on your physical device (for testing)

### Installation

1. **Clone and navigate to the app directory:**
   ```bash
   cd /app/ess-mobile-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure API URL:**
   
   Edit `src/services/config.ts` and set `API_BASE_URL` to your ESS API server:
   ```typescript
   // For local development:
   export const API_BASE_URL = 'http://YOUR_LOCAL_IP:8002';
   
   // For production:
   export const API_BASE_URL = 'https://api.wisedrive.com';
   ```

4. **Start the development server:**
   ```bash
   npx expo start
   ```

5. **Run on device/simulator:**
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go app on your phone

## Project Structure

```
ess-mobile-app/
├── App.tsx                     # Main app entry
├── app.json                    # Expo configuration
├── package.json                # Dependencies
└── src/
    ├── context/
    │   ├── AuthContext.tsx     # Authentication state
    │   └── NotificationContext.tsx
    ├── navigation/
    │   ├── RootNavigator.tsx   # Auth flow
    │   ├── AuthNavigator.tsx   # Login screens
    │   └── MainNavigator.tsx   # Tab navigation
    ├── screens/
    │   ├── LoginScreen.tsx
    │   ├── HomeScreen.tsx      # Dashboard
    │   ├── LeaveScreen.tsx
    │   ├── LeaveApplyScreen.tsx
    │   ├── LeaveDetailScreen.tsx
    │   ├── ApprovalsScreen.tsx
    │   ├── PayslipsScreen.tsx
    │   ├── PayslipDetailScreen.tsx
    │   ├── DocumentsScreen.tsx
    │   ├── NotificationsScreen.tsx
    │   ├── ProfileScreen.tsx
    │   └── SettingsScreen.tsx
    └── services/
        ├── config.ts           # API configuration
        ├── api.ts              # API client
        └── notifications.ts    # Push notifications
```

## API Configuration

The app connects to the WiseDrive ESS API. Ensure the API server is running:

- **Development:** `http://localhost:8002`
- **Preview:** `https://your-preview-url/ess/v1`

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| CEO | kalyan@wisedrive.com | password123 |
| HR Manager | hr@wisedrive.com | password123 |
| Sales Exec | salesexec1.in@wisedrive.com | password123 |

## Push Notifications

The app supports push notifications via Expo's notification system.

### Setup

1. **Get Expo Push Token:**
   - The app automatically registers for push notifications on login
   - Token is sent to the backend and stored

2. **Configure FCM (Optional):**
   - Add `google-services.json` for Android
   - Add APNS certificates for iOS

### Testing Push

From the CRM, navigate to **HR → Notification Configuration** to:
- Send test notifications
- Send announcements
- Configure triggers

## Building for Production

### Using EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

### Standalone Builds

Refer to [Expo Building Standalone Apps](https://docs.expo.dev/classic/building-standalone-apps/) for detailed instructions.

## Troubleshooting

### API Connection Issues
- Ensure ESS API is running on the correct port (8002)
- Check CORS configuration allows the mobile app
- Verify network connectivity (use physical IP, not localhost)

### Push Notification Issues
- Ensure device has granted notification permissions
- Check if running on physical device (emulators have limited support)
- Verify push token is registered with backend

### Authentication Issues
- Clear app data and try again
- Check if user exists in database
- Verify password is correct

## Development Notes

- Hot reload is enabled by default
- Use `expo start --clear` to clear cache if needed
- Check console for API errors

## License

Proprietary - WiseDrive Technologies Pvt Ltd
