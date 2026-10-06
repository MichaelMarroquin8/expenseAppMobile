import * as AppleAuthentication from 'expo-apple-authentication';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { FacebookAuthProvider, GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { firebaseAuth } from '../../backend/firebase';
import { Screen } from '../../components/ui';
import { useAppTheme } from '../../core/theme/ThemeProvider';
import { useAuth } from './AuthProvider';

WebBrowser.maybeCompleteAuthSession();

export function AuthScreen() {
  const { theme } = useAppTheme();
  const { signInEmail, signUpEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

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
    if (!firebaseAuth) return;
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

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>Iniciar sesión</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Sincroniza tus finanzas entre Android y iOS.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Correo"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña"
          secureTextEntry
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />

        {error ? <Text style={[styles.error, { color: theme.warning }]}>{error}</Text> : null}

        <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => signInEmail(email, password).catch(() => setError('Credenciales inválidas.'))}>
          <Text style={styles.buttonText}>Entrar con correo</Text>
        </Pressable>
        <Pressable style={[styles.button, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]} onPress={() => signUpEmail(email, password).catch(() => setError('No se pudo crear la cuenta.'))}>
          <Text style={[styles.buttonText, { color: theme.text }]}>Crear cuenta</Text>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
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
