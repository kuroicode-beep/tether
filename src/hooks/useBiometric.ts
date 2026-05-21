import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser'

const CRED_KEY = 'tether_webauthn_cred'

function randomBase64URL(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export function useBiometric() {
  const isSupported = () => browserSupportsWebAuthn()
  const isRegistered = () => !!localStorage.getItem(CRED_KEY)

  const register = async (): Promise<boolean> => {
    try {
      const result = await startRegistration({
        optionsJSON: {
          challenge: randomBase64URL(32),
          rp: { name: 'Tether', id: window.location.hostname },
          user: {
            id: randomBase64URL(16),
            name: 'tether@local',
            displayName: 'Tether User',
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        },
      })
      localStorage.setItem(CRED_KEY, JSON.stringify({ id: result.id }))
      return true
    } catch {
      return false
    }
  }

  const authenticate = async (): Promise<boolean> => {
    try {
      const stored = localStorage.getItem(CRED_KEY)
      if (!stored) return false
      const { id } = JSON.parse(stored) as { id: string }
      await startAuthentication({
        optionsJSON: {
          challenge: randomBase64URL(32),
          rpId: window.location.hostname,
          allowCredentials: [{ id, type: 'public-key' }],
          userVerification: 'required',
          timeout: 60000,
        },
      })
      return true
    } catch {
      return false
    }
  }

  const unregister = () => localStorage.removeItem(CRED_KEY)

  return { isSupported, isRegistered, register, authenticate, unregister }
}
