import { GemBank } from '@/features/gems'

// The "Gems" tab of the combined Settings page (see ../SettingsRoute.tsx) --
// split out from the Account tab into its own destination since gem
// balances are a big enough part of the product to deserve their own tab,
// not a buried section on someone's profile.
export function GemsTab() {
  return <GemBank />
}
