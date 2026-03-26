export default defineNuxtPlugin(() => {
  if (document.getElementById('google-identity-script')) return

  const script = document.createElement('script')
  script.id = 'google-identity-script'
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  document.head.appendChild(script)
})
