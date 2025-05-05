import { View, Text, TextInput, TouchableOpacity, ScrollView, Linking, Alert, Modal, Pressable } from 'react-native';
import { useState } from 'react';

export default function SettingsScreen() {

  const [message, setMessage] = useState('');
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const YOUR_EMAIL = 'alhassan.khalilnew@gmail.com';

  const handleEmail = () => {

    if (!message.trim()) {
      Alert.alert('✍️ اكتب رسالة أولاً');
      return;
    }

    const subject = encodeURIComponent('رسالة من تطبيق الأخبار');
    const body = encodeURIComponent(`\n\n${message}`);
    Linking.openURL(`mailto:${YOUR_EMAIL}?subject=${subject}&body=${body}`).catch(() =>
      Alert.alert('لم يتم فتح تطبيق البريد')
    );
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 px-4 py-6">
      <Text className="text-2xl font-bold text-right mb-6 text-gray-800">⚙️ الإعدادات</Text>

      {/* User Profile Section */}
      <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <Text className="text-right font-semibold mb-2 text-gray-800">👤 حسابك</Text>
        
      </View>

      {/* App Info Section */}
      <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <Text className="text-right font-semibold mb-2 text-gray-800">ℹ️ معلومات التطبيق</Text>
        <Text className="text-right text-gray-600 text-sm leading-6">
          📰 الأخبار المعروضة يتم جلبها من منصة{' '}
          <Text className="text-blue-600 font-semibold">NewsData.io</Text>. نحن نخزن فقط العناوين والتواريخ ووصف قصير (3-4 أسطر) وصورة مصغرة.
        </Text>
      </View>

      {/* Privacy Section */}
      <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <TouchableOpacity onPress={() => setPrivacyModalVisible(true)}>
          <View className="flex-row justify-between items-center">
            <Text className="text-right font-semibold text-gray-800">🛡️ الخصوصية والأمان</Text>
            <Text className="text-blue-500">عرض السياسة</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Contact Section */}
      <View className="bg-white rounded-xl p-4 shadow-sm">
        <Text className="text-right font-semibold mb-2 text-gray-800">📩 تواصل معنا</Text>
        <Text className="text-right text-gray-600 text-sm mb-3">
          لديك استفسار أو اقتراح؟ نرحب بمراسلتك في أي وقت.
        </Text>
        <TextInput
          placeholder="اكتب رسالتك هنا..."
          className="bg-gray-100 rounded-lg p-3 h-28 text-right text-gray-800 mb-3"
          multiline
          value={message}
          onChangeText={setMessage}
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity
          onPress={handleEmail}
          className="bg-blue-600 p-3 rounded-xl"
          activeOpacity={0.8}
        >
          <Text className="text-white text-center font-bold text-base">إرسال عبر البريد</Text>
        </TouchableOpacity>
      </View>

   {/* Privacy Policy Modal */}
<Modal
  animationType="slide"
  transparent={true}
  visible={privacyModalVisible}
  onRequestClose={() => setPrivacyModalVisible(false)}
>
  <View className="flex-1 justify-end bg-black bg-opacity-50">
    <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-xl font-bold text-gray-800">سياسة الخصوصية</Text>
        <Pressable onPress={() => setPrivacyModalVisible(false)}>
          <Text className="text-blue-500 text-lg">تم</Text>
        </Pressable>
      </View>

      <ScrollView>
        <Text className="text-right text-gray-700 mb-4 leading-6">
          <Text className="font-bold">1. البيانات التي نجمعها:</Text>
          {"\n"}- نستخدم Supabase للتحقق من الهوية (البريد الإلكتروني فقط)
          {"\n"}- لا نجمع أو نخزن بيانات شخصية إضافية
          {"\n"}- نخزن مؤقتًا الأخبار (العنوان، التاريخ، وصف مختصر)
        </Text>

        <Text className="text-right text-gray-700 mb-4 leading-6">
          <Text className="font-bold">2. كيفية استخدام البيانات:</Text>
          {"\n"}- لتقديم الأخبار بشكل مخصص وفعال
          {"\n"}- لتحسين الأداء وتجربة المستخدم
          {"\n"}- لا نشارك أي بيانات مع جهات خارجية
        </Text>

        <Text className="text-right text-gray-700 mb-4 leading-6">
          <Text className="font-bold">3. حماية البيانات:</Text>
          {"\n"}- نستخدم بروتوكولات أمان وتشفير متقدمة
          {"\n"}- يتم تأمين البيانات بواسطة Supabase
          {"\n"}- حذف تلقائي للأخبار القديمة لتقليل التخزين
        </Text>

        <Text className="text-right text-gray-700 leading-6">
          <Text className="font-bold">4. الامتثال القانوني:</Text>
          {"\n"}- نلتزم بقوانين حماية البيانات في لبنان
          {"\n"}- لا نخزن النص الكامل للأخبار
          {"\n"}- نعرض روابط المصدر الرسمي دائمًا
        </Text>
      </ScrollView>
    </View>
  </View>
</Modal>

    </ScrollView>
  );
}