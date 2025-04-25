import { View, Text, Image, Pressable, Modal, TextInput, Alert, ScrollView, ActivityIndicator, FlatList, RefreshControl , Linking } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { API_URL } from '../../API';

const Profile = () => {
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const [modalVisible, setModalVisible] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);
  const [likedPosts, setLikedPosts] = useState([]);
  const [commentedPosts, setCommentedPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();

  // Request media library permissions on mount
  useEffect(() => {
    const getPermissions = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Permission to access media library is required!');
      }
    };
    getPermissions();
  }, []);

  // Fetch user's liked and commented posts
  useEffect(() => {
    if (isSignedIn && user?.primaryEmailAddress?.emailAddress) {
      fetchUserPosts();
    }
  }, [isSignedIn, user]);

  const fetchUserPosts = async () => {
    const email = user.primaryEmailAddress.emailAddress;
    setLoadingPosts(true);
    
    try {
      // Fetch liked posts
      const likedRes = await fetch(`${API_URL}/api/profile/liked-posts/${encodeURIComponent(email)}`);
      const likedData = await likedRes.json();
      setLikedPosts(likedData.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)));
      
      // Fetch commented posts
      const commentedRes = await fetch(`${API_URL}/api/profile/commented-posts/${encodeURIComponent(email)}`);
      const commentedData = await commentedRes.json();
      setCommentedPosts(commentedData.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)));
    } catch (err) {
      Alert.alert('Error', 'Failed to load your posts');
      console.error(err);
    } finally {
      setLoadingPosts(false);
    }
  };

  const openEditModal = () => setModalVisible(true);

  const handleSaveProfile = async () => {
    try {
      await user?.update({ firstName, lastName });
      Alert.alert('نجاح', 'تم تحديث معلومات الملف الشخصي');
      setModalVisible(false);
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحديث الملف الشخصي');
    }
  };

  const updateProfileImage = async () => {
    setIsUpdatingImage(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64 = result.assets[0].base64;
        const mimeType = result.assets[0].mimeType;

        const image = `data:${mimeType};base64,${base64}`;

        await user?.setProfileImage({
          file: image,
        });

        Alert.alert('نجاح', 'تم تحديث صورة الملف الشخصي');
      }
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحديث صورة الملف الشخصي');
    } finally {
      setIsUpdatingImage(false);
    }
  };
  const openInBrowser = (url) => {
    if (url) {
      Linking.openURL(url).catch(err => {
        Alert.alert("خطأ", "تعذر فتح الرابط");
        console.error('فشل فتح الرابط:', err);
      });
    }
  };

  const renderHorizontalPost = ({ item }) => (
    <Pressable 
      onPress={() => openInBrowser(item.link)}
      className="w-48 mr-3 bg-white rounded-lg shadow-sm"
    >
      {item.image_url && (
        <Image 
          source={{ uri: item.image_url }} 
          className="w-full h-32 rounded-t-lg"
          resizeMode="cover"
        />
      )}
      <View className="p-2">
        <Text className="font-semibold text-sm text-right" numberOfLines={2}>
          {item.title}
        </Text>
        <Text className="text-xs text-gray-500 mt-1 text-right">
          {new Date(item.pubDate).toLocaleDateString()}
        </Text>
      </View>
    </Pressable>
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchUserPosts();
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      
    {isSignedIn ? (
      <ScrollView 
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      >
          {/* Profile Header */}
          <View className="bg-gray-100 p-6 items-center border-b border-gray-200">
            <View className="relative mb-4">
              {isUpdatingImage ? (
                <View className="w-24 h-24 rounded-full bg-gray-300 justify-center items-center">
                  <ActivityIndicator color="#4CAF50" />
                </View>
              ) : (
                <Image
                  source={{ uri: user?.imageUrl }}
                  className="w-24 h-24 rounded-full border-4 border-green-500"
                />
              )}
              <Pressable
                className="absolute bottom-0 right-0 bg-green-500 p-2 rounded-full"
                onPress={updateProfileImage}
                disabled={isUpdatingImage}
              >
                <Ionicons name="camera" size={16} color="white" />
              </Pressable>
            </View>
            <Text className="text-xl font-bold text-gray-800">{user?.fullName || 'المستخدم'}</Text>
            <Text className="text-gray-600">{user?.primaryEmailAddress?.emailAddress}</Text>
            <Text className="text-gray-500 mt-2">تاريخ الإنشاء: {new Date(user?.createdAt).toLocaleDateString()}</Text>
            <Text className="text-gray-500">آخر تسجيل دخول: {new Date(user?.lastSignInAt).toLocaleDateString()}</Text>
            <View className="flex-row space-x-4 mt-4">
              <Pressable
                className="bg-green-500 px-6 py-2 rounded-full"
                onPress={openEditModal}
              >
                <Text className="text-white font-semibold">تعديل الملف</Text>
              </Pressable>
              <Pressable
                className="border border-red-500 px-6 py-2 rounded-full"
                onPress={() => signOut()}
              >
                <Text className="text-red-500 font-semibold">تسجيل الخروج</Text>
              </Pressable>
            </View>
          </View>

          {/* Liked Posts Section */}
          <View className="mt-6 px-4">
          <View className="flex-row justify-between items-center mb-3">
  <Text className="text-lg font-bold text-right">الأخبار المحفوظة</Text>
  {likedPosts.length >= 1 && (
    <Pressable onPress={() => router.push('../liked_news')}>
      <Text className="text-green-500 text-sm">عرض الكل ({likedPosts.length})</Text>
    </Pressable>
  )}
</View>

            {loadingPosts ? (
              <ActivityIndicator size="small" className="my-2" />
            ) : likedPosts.length > 0 ? (
              <FlatList
                horizontal
                data={likedPosts.slice(0, 5)}
                renderItem={renderHorizontalPost}
                keyExtractor={item => item._id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 4 }}
              />
            ) : (
              <View className="items-center py-4 bg-gray-50 rounded-lg">
                <Ionicons name="heart-outline" size={32} color="#ccc" />
                <Text className="text-gray-500 mt-2">لا توجد أخبار محفوظة</Text>
              </View>
            )}
          </View>

          {/* Commented Posts Section */}
          <View className="mt-6 px-4 mb-8">
          <View className="flex-row justify-between items-center mb-3">
  <Text className="text-lg font-bold text-right">الأخبار المعلقة عليها</Text>
  {commentedPosts.length >= 1 && (
    <Pressable onPress={() => router.push('../commented_news')}>
      <Text className="text-green-500 text-sm">عرض الكل ({commentedPosts.length})</Text>
    </Pressable>
  )}
</View>

            {loadingPosts ? (
              <ActivityIndicator size="small" className="my-2" />
            ) : commentedPosts.length > 0 ? (
              <FlatList
                horizontal
                data={commentedPosts.slice(0, 5)}
                renderItem={renderHorizontalPost}
                keyExtractor={item => item._id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 4 }}
              />
            ) : (
              <View className="items-center py-4 bg-gray-50 rounded-lg">
                <Ionicons name="chatbubble-outline" size={32} color="#ccc" />
                <Text className="text-gray-500 mt-2">لا توجد تعليقات</Text>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 justify-center items-center p-6">
          <Ionicons name="newspaper-outline" size={64} color="#4CAF50" className="mb-4" />
          <Text className="text-center text-lg text-gray-800 mb-6">سجل الدخول لعرض ملفك الشخصي والأخبار المحفوظة والمزيد.</Text>
          <View className="flex-row space-x-4">
            <Pressable className="bg-green-500 px-6 py-3 rounded-full" onPress={() => {router.push('/(auth)/sign-up')}}>
              <Text className="text-white font-semibold">إنشاء حساب</Text>
            </Pressable>
            <Pressable className="border border-green-500 px-6 py-3 rounded-full" onPress={() => {router.push('/(auth)/sign-in')}}>
              <Text className="text-green-500 font-semibold">تسجيل الدخول</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white p-6 rounded-lg w-11/12 max-w-md">
            <Text className="text-center text-xl font-bold text-gray-800 mb-6">تعديل الملف الشخصي</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              className="bg-gray-100 border border-gray-300 p-3 rounded-lg mb-4 text-right"
              placeholder="الاسم الأول"
            />
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              className="bg-gray-100 border border-gray-300 p-3 rounded-lg mb-4 text-right"
              placeholder="الاسم الأخير"
            />
            <Pressable
              className="bg-green-500 px-6 py-2 rounded-full"
              onPress={handleSaveProfile}
            >
              <Text className="text-white font-semibold">حفظ التعديلات</Text>
            </Pressable>
            <Pressable
              className="mt-4 bg-gray-300 px-6 py-2 rounded-full"
              onPress={() => setModalVisible(false)}
            >
              <Text className="text-gray-700 font-semibold">إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Profile;