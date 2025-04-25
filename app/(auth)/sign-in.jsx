import * as React from 'react';
import { 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  I18nManager,
  Alert
} from 'react-native';
import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';

// Enable RTL layout for Arabic
I18nManager.forceRTL(true);

WebBrowser.maybeCompleteAuthSession();

// Error message mapping
const ERROR_MESSAGES = {
  'NOBRIDGE': 'مشكلة في الاتصال. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.',
  'OAUTH_ERROR': 'فشل تسجيل الدخول. يرجى المحاولة مرة أخرى أو استخدام طريقة أخرى.',
  'DEFAULT': 'حدث خطأ ما. يرجى المحاولة مرة أخرى لاحقًا.',
};

export default function SignInScreen() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const { startOAuthFlow: googleAuth } = useOAuth({ strategy: 'oauth_google' });

  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const getFriendlyErrorMessage = (error) => {
    if (error.includes('NOBRIDGE')) return ERROR_MESSAGES.NOBRIDGE;
    if (error.includes('OAUTH_ERROR')) return ERROR_MESSAGES.OAUTH_ERROR;
    return ERROR_MESSAGES.DEFAULT;
  };

  const handleSignIn = async () => {
    if (!isLoaded) return;
    
    // Validate inputs
    if (!emailAddress.trim()) {
      setError('الرجاء إدخال بريدك الإلكتروني');
      return;
    }
    
    if (!password) {
      setError('الرجاء إدخال كلمة المرور');
      return;
    }
    
    setError('');
    setIsSubmitting(true);

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });
      
      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace('(tabs)/');
      } else {
        setError('فشل تسجيل الدخول. الرجاء المحاولة مرة أخرى.');
      }
    } catch (err) {
      setError(err.errors?.[0]?.message || 'فشل تسجيل الدخول');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (!isLoaded) return;
    
    setError('');
    setIsSubmitting(true);
    
    try {
      const { createdSessionId, setActive } = await googleAuth();
      
      if (createdSessionId) {
        await setActive({ session: createdSessionId });
        router.replace('/(tabs)/');
      } else {
        throw new Error("OAUTH_ERROR: Authentication failed");
      }
    } catch (err) {
      console.error('OAuth error:', err);
      const friendlyError = getFriendlyErrorMessage(err.message);
      setError(friendlyError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#fff' }}
    >
      <StatusBar style="dark" translucent={false} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32 }}>
          {/* Logo and app name */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View style={{ backgroundColor: '#4CAF50', paddingHorizontal: 16, paddingVertical: 4, borderRadius: 4, marginBottom: 8 }}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 24, fontFamily: 'Tajawal-Bold' }}>أخبار الخير</Text>
            </View>
            <Text style={{ color: '#666', textAlign: 'center', fontFamily: 'Tajawal-Regular' }}>
              تسجيل الدخول إلى حسابك
            </Text>
          </View>

          {error !== '' && (
            <View style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              padding: 16,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.3)',
              marginBottom: 24,
              flexDirection: 'row',
              alignItems: 'center'
            }}>
              <Ionicons name="warning" size={20} color="#ef4444" style={{ marginLeft: 12 }} />
              <Text style={{ 
                color: '#ef4444', 
                flex: 1,
                fontSize: 15,
                lineHeight: 20,
                textAlign: 'right',
                fontFamily: 'Tajawal-Regular'
              }}>
                {error}
                {error === ERROR_MESSAGES.NOBRIDGE && (
                  <Text style={{ fontSize: 13, color: '#ef4444aa' }}>\n\nحاول التبديل بين WiFi وبيانات الجوال.</Text>
                )}
              </Text>
            </View>
          )}

          <View>
            <TextInput
              value={emailAddress}
              onChangeText={setEmailAddress}
              placeholder="البريد الإلكتروني"
              placeholderTextColor="#999"
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                backgroundColor: '#f9f9f9',
                color: '#333',
                padding: 16,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: '#e1e1e1',
                marginBottom: 8,
                textAlign: 'right',
                fontFamily: 'Tajawal-Regular'
              }}
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="كلمة المرور"
              placeholderTextColor="#999"
              secureTextEntry
              style={{
                backgroundColor: '#f9f9f9',
                color: '#333',
                padding: 16,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: '#e1e1e1',
                marginBottom: 24,
                textAlign: 'right',
                fontFamily: 'Tajawal-Regular'
              }}
            />
          </View>

          <TouchableOpacity
            onPress={handleSignIn}
            disabled={isSubmitting}
            style={{
              backgroundColor: isSubmitting ? '#7CB342' : '#4CAF50',
              paddingVertical: 12,
              borderRadius: 6,
              marginBottom: 24
            }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16, fontFamily: 'Tajawal-Bold' }}>
                تسجيل الدخول
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e1e1e1' }} />
            <Text style={{ color: '#666', paddingHorizontal: 16, fontFamily: 'Tajawal-Regular' }}>أو</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e1e1e1' }} />
          </View>

          {/* Google Sign In */}
          <TouchableOpacity
            onPress={handleGoogleAuth}
            disabled={isSubmitting}
            style={{
              backgroundColor: 'white',
              paddingVertical: 12,
              borderRadius: 6,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#e1e1e1',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            <Text style={{ color: '#333', fontWeight: 'bold', fontSize: 16, fontFamily: 'Tajawal-Bold' }}>
              المتابعة باستخدام جوجل
            </Text>
            <Ionicons name="logo-google" size={20} color="#333" style={{ marginLeft: 20 }} />
          </TouchableOpacity>
          
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 }}>
            <Link href="/(auth)/sign-up" asChild>
              <Text style={{ color: '#4CAF50', fontWeight: 'bold', fontFamily: 'Tajawal-Bold' }}>إنشاء حساب</Text>
            </Link>
            <Text style={{ color: '#666', fontFamily: 'Tajawal-Regular' }}> ليس لديك حساب؟ </Text>
          </View>
          
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}