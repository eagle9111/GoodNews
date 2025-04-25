import * as React from 'react';
import { 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View, 
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

// Enable RTL layout for Arabic
I18nManager.forceRTL(true);

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Handle submission of sign-up form
  const onSignUpPress = async () => {
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

    if (password.length < 8) {
      setError('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل');
      return;
    }
    
    setError('');
    setIsSubmitting(true);

    try {
      await signUp.create({
        emailAddress,
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err) {
      setError(err.errors?.[0]?.message || 'فشل التسجيل');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle submission of verification form
  const onVerifyPress = async () => {
    if (!isLoaded) return;
    
    if (!code.trim()) {
      setError('الرجاء إدخال رمز التحقق');
      return;
    }
    
    setError('');
    setIsSubmitting(true);

    try {
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (signUpAttempt.status === 'complete') {
        await setActive({ session: signUpAttempt.createdSessionId });
        router.replace('(tabs)/');
      } else {
        setError('فشل التحقق. الرجاء المحاولة مرة أخرى');
      }
    } catch (err) {
      setError(err.errors?.[0]?.message || 'فشل التحقق');
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
              {pendingVerification ? 'تحقق من بريدك الإلكتروني' : 'إنشاء حساب جديد'}
            </Text>
          </View>

          {error !== '' && (
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 6, marginBottom: 24 }}>
              <Text style={{ color: '#ef4444', textAlign: 'center', fontFamily: 'Tajawal-Regular' }}>{error}</Text>
            </View>
          )}

          {pendingVerification ? (
            <View>
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <Ionicons name="mail-outline" size={48} color="#4CAF50" />
                <Text style={{ color: '#333', fontSize: 18, fontWeight: 'bold', marginTop: 16, fontFamily: 'Tajawal-Bold' }}>تحقق من بريدك الوارد</Text>
                <Text style={{ color: '#666', textAlign: 'center', marginTop: 8, fontFamily: 'Tajawal-Regular' }}>
                  لقد أرسلنا رمز التحقق إلى {emailAddress}
                </Text>
              </View>

              <TextInput
                value={code}
                placeholder="أدخل رمز التحقق"
                placeholderTextColor="#999"
                onChangeText={setCode}
                keyboardType="number-pad"
                style={{
                  backgroundColor: '#f9f9f9',
                  color: '#333',
                  padding: 16,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: '#e1e1e1',
                  marginBottom: 24,
                  fontSize: 16,
                  letterSpacing: 2,
                  textAlign: 'center',
                  fontFamily: 'Tajawal-Regular'
                }}
              />

              <TouchableOpacity
                onPress={onVerifyPress}
                disabled={isSubmitting}
                style={{
                  backgroundColor: isSubmitting ? '#7CB342' : '#4CAF50',
                  paddingVertical: 14,
                  borderRadius: 6,
                  marginBottom: 16
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16, fontFamily: 'Tajawal-Bold' }}>
                    تحقق من البريد
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPendingVerification(false)}
                style={{ paddingVertical: 12 }}
              >
                <Text style={{ color: '#666', textAlign: 'center', fontFamily: 'Tajawal-Regular' }}>
                  العودة إلى التسجيل
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={{ color: '#333', fontSize: 16, marginBottom: 6, fontFamily: 'Tajawal-Medium', textAlign: 'right' }}>معلوماتك</Text>

              <View style={{ flexDirection: 'row', marginBottom: 8, gap: 8 }}>
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="الاسم الثاني (اختياري)"
                  placeholderTextColor="#999"
                  style={{
                    flex: 1,
                    backgroundColor: '#f9f9f9',
                    color: '#333',
                    padding: 16,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: '#e1e1e1',
                    textAlign: 'right',
                    fontFamily: 'Tajawal-Regular'
                  }}
                />
                
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="الاسم الأول (اختياري)"
                  placeholderTextColor="#999"
                  style={{
                    flex: 1,
                    backgroundColor: '#f9f9f9',
                    color: '#333',
                    padding: 16,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: '#e1e1e1',
                    textAlign: 'right',
                    fontFamily: 'Tajawal-Regular'
                  }}
                />
              </View>

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
                placeholder="كلمة المرور (8 أحرف على الأقل)"
                placeholderTextColor="#999"
                secureTextEntry={true}
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

              <TouchableOpacity
                onPress={onSignUpPress}
                disabled={isSubmitting}
                style={{
                  backgroundColor: isSubmitting ? '#7CB342' : '#4CAF50',
                  paddingVertical: 14,
                  borderRadius: 6,
                  marginBottom: 24
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16, fontFamily: 'Tajawal-Bold' }}>
                    إنشاء حساب
                  </Text>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 }}>
                <Link href="/(auth)/sign-in" asChild>
                  <Text style={{ color: '#4CAF50', fontWeight: 'bold', fontFamily: 'Tajawal-Bold' }}>تسجيل الدخول</Text>
                </Link>
                <Text style={{ color: '#666', fontFamily: 'Tajawal-Regular' }}> لديك حساب بالفعل؟ </Text>
              </View>
              
              {/* Legal */}
              <Text style={{ color: '#888', fontSize: 12, textAlign: 'center', marginTop: 32, fontFamily: 'Tajawal-Regular' }}>
                بإنشاء حساب، فإنك توافق على شروط الخدمة وسياسة الخصوصية الخاصة بنا
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}