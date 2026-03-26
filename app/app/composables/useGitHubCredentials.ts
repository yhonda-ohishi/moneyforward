const GITHUB_USERNAME_KEY = 'dencho:github:username'
const GITHUB_PASSWORD_KEY = 'dencho:github:password'

export const useGitHubCredentials = () => {
  const getCredentials = () => {
    if (import.meta.client) {
      return {
        username: localStorage.getItem(GITHUB_USERNAME_KEY) || '',
        password: localStorage.getItem(GITHUB_PASSWORD_KEY) || ''
      }
    }
    return { username: '', password: '' }
  }

  const saveCredentials = (username: string, password: string) => {
    if (import.meta.client) {
      localStorage.setItem(GITHUB_USERNAME_KEY, username)
      localStorage.setItem(GITHUB_PASSWORD_KEY, password)
    }
  }

  const clearCredentials = () => {
    if (import.meta.client) {
      localStorage.removeItem(GITHUB_USERNAME_KEY)
      localStorage.removeItem(GITHUB_PASSWORD_KEY)
    }
  }

  return {
    getCredentials,
    saveCredentials,
    clearCredentials
  }
}
