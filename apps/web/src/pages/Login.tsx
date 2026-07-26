import { GoogleLoginButton } from '@/components/GoogleLoginButton'
import { Card, CardContent } from '@/components/ui/Card'

// Google is the only auth method — there is no separate register page.
// A first-time Google sign-in creates the account automatically.
export function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">TimeGems</h1>
          <p className="text-sm text-muted-foreground">Continue with Google to start tracking work.</p>
        </div>
        <Card>
          <CardContent className="py-6">
            <GoogleLoginButton />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
