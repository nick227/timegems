const GITHUB_RETURN_KEY = 'githubReturnTo'

function githubInstallUrl(returnTo?: string) {
  const appName = import.meta.env.VITE_GITHUB_APP_NAME || 'timegems-dev'
  const url = new URL(`https://github.com/apps/${appName}/installations/new`)
  if (returnTo) url.searchParams.set('state', returnTo)
  return url.toString()
}

export { GITHUB_RETURN_KEY, githubInstallUrl }
