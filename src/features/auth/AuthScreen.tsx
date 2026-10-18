import * as AppleAuthentication from 'expo-apple-authentication';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { FacebookAuthProvider, GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { firebaseAuth } from '../../backend/firebase';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { useAuth } from './AuthProvider';

WebBrowser.maybeCompleteAuthSession();

const authErrorMessage = (error: unknown, creating: boolean): string => {
  const code =
    error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
  const raw = error instanceof Error ? error.message : '';
  if (code === 'auth/not-configured' || raw.includes('auth/not-configured')) {
    return 'El inicio de sesión no está disponible en esta compilación.';
  }
  if (
    code === 'auth/admin-restricted-operation' ||
    code === 'auth/operation-not-allowed' ||
    raw.includes('ADMIN_ONLY_OPERATION') ||
    raw.includes('OPERATION_NOT_ALLOWED')
  ) {
    return 'Firebase tiene desactivado el registro por correo. Actívalo en Authentication → Sign-in method → Email/Password.';
  }
  if (code === 'auth/email-already-in-use') return 'Ese correo ya tiene una cuenta. Entra con él.';
  if (code === 'auth/invalid-email') return 'El correo no es válido.';
  if (code === 'auth/weak-password') return 'La contraseña debe tener al menos 6 caracteres.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Correo o contraseña incorrectos.';
  }
  if (code === 'auth/network-request-failed') return 'Sin conexión. Revisa la red e inténtalo de nuevo.';
  if (code === 'auth/too-many-requests') return 'Demasiados intentos. Espera un momento.';
  return creating ? 'No se pudo crear la cuenta.' : 'No se pudo entrar.';
};

export function AuthForm() {
  const { theme } = useAppTheme();
  const { signInEmail, signUpEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  const [facebookRequest, facebookResponse, promptFacebook] = Facebook.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? '',
  });

  useEffect(() => {
    const run = async () => {
      if (!googleResponse || googleResponse.type !== 'success' || !firebaseAuth) return;
      const idToken = googleResponse.authentication?.idToken;
      if (!idToken) return;
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(firebaseAuth, credential);
    };
    run().catch(() => setError('No se pudo iniciar con Google.'));
  }, [googleResponse]);

  useEffect(() => {
    const run = async () => {
      if (!facebookResponse || facebookResponse.type !== 'success' || !firebaseAuth) return;
      const accessToken = facebookResponse.authentication?.accessToken;
      if (!accessToken) return;
      const credential = FacebookAuthProvider.credential(accessToken);
      await signInWithCredential(firebaseAuth, credential);
    };
    run().catch(() => setError('No se pudo iniciar con Facebook.'));
  }, [facebookResponse]);

  const signInApple = async () => {
    if (!firebaseAuth) {
      setError('El inicio de sesión no está disponible en esta compilación.');
      return;
    }
    try {
      const result = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!result.identityToken) return;
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: result.identityToken,
      });
      await signInWithCredential(firebaseAuth, credential);
    } catch {
      setError('No se pudo iniciar con Apple.');
    }
  };

  const submitEmail = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Escribe el correo y la contraseña.');
      return;
    }
    if (mode === 'signup') {
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') await signUpEmail(trimmedEmail, password);
      else await signInEmail(trimmedEmail, password);
    } catch (submitError) {
      setError(authErrorMessage(submitError, mode === 'signup'));
    } finally {
      setBusy(false);
    }
  };

  return (
      <View style={styles.container}>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {mode === 'signup'
            ? 'Crea una cuenta para guardar tus finanzas en la nube.'
            : 'Entra para sincronizar tus finanzas entre dispositivos.'}
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Correo"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña"
          secureTextEntry
          editable={!busy}
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
        {mode === 'signup' ? (
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirmar contraseña"
            secureTextEntry
            editable={!busy}
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
        ) : null}

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <Pressable
          disabled={busy}
          style={[styles.button, { backgroundColor: theme.primary }, busy && styles.buttonBusy]}
          onPress={() => void submitEmail()}
        >
          <Text style={styles.buttonText}>
            {busy ? 'Espera…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar con correo'}
          </Text>
        </Pressable>
        <Pressable
          disabled={busy}
          style={[styles.button, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
          onPress={() => {
            setMode((current) => (current === 'login' ? 'signup' : 'login'));
            setError(null);
            setConfirmPassword('');
          }}
        >
          <Text style={[styles.buttonText, { color: theme.text }]}>
            {mode === 'signup' ? 'Ya tengo cuenta' : 'Crear cuenta'}
          </Text>
        </Pressable>

        <View style={styles.socialRow}>
          <Pressable
            disabled={!googleRequest}
            style={[styles.socialButton, { borderColor: theme.border }]}
            onPress={() => promptGoogle()}
          >
            <Text style={[styles.socialText, { color: theme.text }]}>Google</Text>
          </Pressable>
          <Pressable
            disabled={!facebookRequest}
            style={[styles.socialButton, { borderColor: theme.border }]}
            onPress={() => promptFacebook()}
          >
            <Text style={[styles.socialText, { color: theme.text }]}>Facebook</Text>
          </Pressable>
          {Platform.OS === 'ios' ? (
            <Pressable style={[styles.socialButton, { borderColor: theme.border }]} onPress={signInApple}>
              <Text style={[styles.socialText, { color: theme.text }]}>Apple</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  subtitle: {
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  button: {
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 10,
  },
  buttonBusy: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  socialButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  socialText: {
    fontWeight: '600',
  },
  error: {
    marginBottom: 8,
    fontSize: 12,
  },
});
