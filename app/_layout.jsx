import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { Slot } from 'expo-router'

// Get the Clerk public API URL from environment variables
const clerkFrontendApi = process.env.EXPO_PUBLIC_CLERK_FRONTEND_API;

export default function RootLayout() {
  return (
    <ClerkProvider 
      frontendApi={clerkFrontendApi} 
      tokenCache={tokenCache}
    >
      <Slot />
    </ClerkProvider>
  )
}
