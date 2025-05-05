import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Image } from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import * as EmailValidator from 'email-validator';
import { Ionicons } from '@expo/vector-icons';


export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const errors = [];
    if (!firstName.trim()) errors.push('الاسم الأول مطلوب');
    if (!lastName.trim()) errors.push('الاسم الأخير مطلوب');
    if (!EmailValidator.validate(email)) errors.push('بريد إلكتروني غير صحيح');
    if (password.length < 6) errors.push('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    
    if (errors.length > 0) {
      Alert.alert('خطأ', errors.join('\n'));
      return false;
    }
    return true;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
          emailRedirectTo: 'your-app-scheme://'
        }
      });

      if (error) throw error;

      Alert.alert(
        'تم التسجيل بنجاح',
        'تم إرسال رابط التحقق إلى بريدك الإلكتروني. يرجى التحقق قبل تسجيل الدخول.',
        [
          { text: 'حسناً', onPress: () => router.replace('/(auth)/sign-in') }
        ]
      );
    } catch (error) {
      Alert.alert('خطأ', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-600 px-6 pt-12">
     <TouchableOpacity 
        onPress={() => router.back()} 
        className="absolute top-4 left-4 z-10 p-2"
      >
        <Ionicons name="arrow-back" size={28} color="white" />
      </TouchableOpacity>
      <Image 
        source={require('../../assets/images/icon.png')}
        className="w-24 h-24 mb-8 self-center"
        resizeMode="contain"
      />

      <Text className="text-3xl font-bold text-gray-900 text-right mb-8">
        إنشاء حساب جديد
      </Text>

      <View className="bg-white rounded-2xl p-6 shadow">
        <TextInput
          className="bg-gray-50 rounded-lg p-4 text-right text-gray-900 border border-gray-200 mb-4"
          placeholder="الاسم الأول"
          placeholderTextColor="#6b7280"
          value={firstName}
          onChangeText={setFirstName}
        />

        <TextInput
          className="bg-gray-50 rounded-lg p-4 text-right text-gray-900 border border-gray-200 mb-4"
          placeholder="الاسم الأخير"
          placeholderTextColor="#6b7280"
          value={lastName}
          onChangeText={setLastName}
        />

        <TextInput
          className="bg-gray-50 rounded-lg p-4 text-right text-gray-900 border border-gray-200 mb-4"
          placeholder="البريد الإلكتروني"
          placeholderTextColor="#6b7280"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          className="bg-gray-50 rounded-lg p-4 text-right text-gray-900 border border-gray-200 mb-6"
          placeholder="كلمة المرور"
          placeholderTextColor="#6b7280"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          className={`bg-gray-500 rounded-lg p-4 ${loading ? 'opacity-50' : ''} shadow-lg`}
          disabled={loading}
          onPress={handleSignUp}
        >
          <Text className="text-white text-center font-medium text-lg">
            {loading ? 'جاري التسجيل...' : 'تسجيل الحساب'}
          </Text>
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="  text-sm">لديك حساب بالفعل؟ </Text>
          <Link href="/(auth)/sign-in" className="text-blue-500 font-medium text-sm">
            تسجيل الدخول
          </Link>
        </View>
      </View>
    </View>
  );
}
