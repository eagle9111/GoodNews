import { View, Text, Pressable, Modal, TextInput, Alert, ScrollView, ActivityIndicator, Image, RefreshControl, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { API_URL } from '../../API';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

const Profile = () => {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [likedPosts, setLikedPosts] = useState([]);
  const [commentedPosts, setCommentedPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [firstNameError, setFirstNameError] = useState('');

  // Auth state management
  useFocusEffect(
    useCallback(() => {
      const fetchSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setIsSignedIn(true);
          setFirstName(session.user.user_metadata?.first_name || '');
          setLastName(session.user.user_metadata?.last_name || '');
          setProfileImage(session.user.user_metadata?.avatar_url || null);
          fetchUserPosts(session.user.email);
        } else {
          setUser(null);
          setIsSignedIn(false);
        }
      };

      fetchSession();
    }, [])
  );

  // Fetch user's liked and commented posts
  const fetchUserPosts = async (email) => {
    if (!email) return;
    
    setLoadingPosts(true);
    try {
      const likedRes = await fetch(`${API_URL}/api/profile/liked-posts/${encodeURIComponent(email)}`);
      if (likedRes.ok) {
        const likedData = await likedRes.json();
        const processedLiked = likedData.map(post => ({
          ...post,
          uniqueId: `liked-${post.id || Math.random().toString(36).substr(2, 12)}-${Date.now()}`
        }));
        setLikedPosts(processedLiked.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)));
      }
      
      const commentedRes = await fetch(`${API_URL}/api/profile/commented-posts/${encodeURIComponent(email)}`);
      if (commentedRes.ok) {
        const commentedData = await commentedRes.json();
        const processedCommented = commentedData.map(post => ({
          ...post,
          uniqueId: `commented-${post.id || Math.random().toString(36).substr(2, 12)}-${Date.now()}`
        }));
        setCommentedPosts(processedCommented.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)));
      }
    } catch (err) {
      console.error(err);
      Alert.alert('خطأ', 'فشل تحميل المنشورات');
    } finally {
      setLoadingPosts(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (user?.email) {
      fetchUserPosts(user.email);
    } else {
      setRefreshing(false);
    }
  }, [user]);

  const validateForm = () => {
    let isValid = true;
    
    if (!firstName.trim()) {
      setFirstNameError('الاسم الأول مطلوب');
      isValid = false;
    } else {
      setFirstNameError('');
    }
    
    return isValid;
  };

  const handleSaveProfile = async () => {
    if (!validateForm()) return;
    
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          avatar_url: profileImage
        }
      });

      if (error) throw error;

      Alert.alert('نجاح', 'تم تحديث الملف الشخصي');
      setModalVisible(false);
      setUser(prev => ({ 
        ...prev, 
        user_metadata: { 
          ...prev.user_metadata, 
          first_name: firstName.trim(), 
          last_name: lastName.trim(),
          avatar_url: profileImage
        }
      }));
    } catch (error) {
      console.error(error);
      Alert.alert('خطأ', 'فشل تحديث الملف الشخصي');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد من رغبتك في تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { 
          text: 'تسجيل الخروج', 
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
              Alert.alert('خطأ', 'فشل تسجيل الخروج');
              return;
            }
            setIsSignedIn(false);
            setUser(null);
            router.replace('/');
          }
        }
      ]
    );
  };

  const pickImage = async () => {
    // Request permission to access the image library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('خطأ', 'نحتاج إذن للوصول إلى معرض الصور');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('خطأ', 'فشل اختيار الصورة');
    }
  };

  const uploadProfileImage = async (uri) => {
    if (!user) return;
    
    setImageUploadLoading(true);
    try {
      // Prepare file for upload
      const fileExt = uri.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      // Convert image to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        setProfileImage(urlData.publicUrl);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('خطأ', 'فشل رفع الصورة');
    } finally {
      setImageUploadLoading(false);
    }
  };

  const PostItem = ({ item }) => {
    return (
      <Pressable 
        className="bg-white rounded-lg shadow-sm mr-4 w-64"
        onPress={() => router.push(`/post/${item.id}`)}
      >
        {item.imageUrl ? (
          <Image 
            source={{ uri: item.imageUrl }} 
            className="w-full h-32 rounded-t-lg" 
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-32 bg-gray-200 rounded-t-lg flex items-center justify-center">
            <Ionicons name="newspaper-outline" size={32} color="#666" />
          </View>
        )}
        <View className="p-3">
          <Text className="text-base font-semibold mb-2" numberOfLines={2}>{item.title}</Text>
          <Text className="text-xs text-gray-500">
            {new Date(item.pubDate).toLocaleDateString('ar')}
          </Text>
        </View>
      </Pressable>
    );
  };

  const HorizontalPostList = ({ title, data, emptyMessage, navigateTo }) => (
    <View className="mt-4 mb-6">
      <View className="flex-row justify-between items-center px-4 mb-2">
        <Text className="text-lg font-bold">{title}</Text>
        <Pressable onPress={() => router.push(navigateTo)}>
          <Text className="text-green-700 font-medium">عرض الكل</Text>
        </Pressable>
      </View>
      
      {loadingPosts ? (
        <ActivityIndicator size="large" color="#2e7d32" className="my-4" />
      ) : data.length > 0 ? (
        <FlatList
          horizontal
          data={data}
          renderItem={({ item }) => <PostItem item={item} />}
          keyExtractor={item => item.uniqueId}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      ) : (
        <Text className="text-gray-500 text-center my-4 px-4">{emptyMessage}</Text>
      )}
    </View>
  );

  if (!isSignedIn) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-lg mb-4">يرجى تسجيل الدخول لعرض الملف الشخصي</Text>
        <Pressable 
          className="bg-green-700 px-6 py-3 rounded-full"
          onPress={() => router.push('../(auth)/sign-in')}
        >
          <Text className="text-white text-base font-medium">تسجيل الدخول</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white w-11/12 rounded-xl p-6">
            <Text className="text-xl font-bold text-center mb-4">تعديل الملف الشخصي</Text>
            
        
            <View className="mb-4">
              <Text className="text-sm font-medium mb-1">الاسم الأول *</Text>
              <TextInput
                className={`border rounded-lg p-3 ${firstNameError ? 'border-red-500' : 'border-gray-200'}`}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="الاسم الأول"
                placeholderTextColor="#999"
              />
              {firstNameError && <Text className="text-red-500 text-xs mt-1">{firstNameError}</Text>}
            </View>
            
            <View className="mb-6">
              <Text className="text-sm font-medium mb-1">الاسم الأخير (اختياري)</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-3"
                value={lastName}
                onChangeText={setLastName}
                placeholder="الاسم الأخير"
                placeholderTextColor="#999"
              />
            </View>
            
            <View className="flex-row justify-between">
              <Pressable 
                className="bg-gray-100 flex-1 mr-2 py-3 rounded-lg"
                onPress={() => setModalVisible(false)}
              >
                <Text className="text-center text-gray-700 font-medium">إلغاء</Text>
              </Pressable>
              <Pressable 
                className="bg-green-700 flex-1 ml-2 py-3 rounded-lg"
                onPress={handleSaveProfile}
              >
                <Text className="text-center text-white font-medium">حفظ</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Profile Header */}
      <View className="bg-white p-6 shadow-sm">
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center">
            {profileImage ? (
              <Image 
                source={{ uri: profileImage }} 
                className="w-16 h-16 rounded-full" 
              />
            ) : (
              <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center">
                <Ionicons name="person" size={32} color="#2e7d32" />
              </View>
            )}
            <View className="ml-4">
              <Text className="text-xl font-bold">{firstName} {lastName}</Text>
              <Text className="text-gray-500 text-sm">{user?.email}</Text>
            </View>
          </View>
        </View>
        
        <View className="flex-row justify-between mt-2">
          <Pressable 
            className="bg-green-700 flex-1 flex-row items-center justify-center mr-2 py-2 rounded-lg"
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="pencil" size={18} color="white" />
            <Text className="text-white font-medium mr-1">تعديل الملف</Text>
          </Pressable>
          
          <Pressable 
            className="bg-red-500 flex-1 flex-row items-center justify-center ml-2 py-2 rounded-lg"
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={18} color="white" />
            <Text className="text-white font-medium mr-1">تسجيل الخروج</Text>
          </Pressable>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        className="flex-1"
      >
        {/* Liked Posts Section */}
        <HorizontalPostList 
          title="المنشورات المفضلة"
          data={likedPosts}
          emptyMessage="لا توجد منشورات مفضلة"
          navigateTo="../liked_news"
        />

        {/* Commented Posts Section */}
        <HorizontalPostList 
          title="المنشورات المعلق عليها"
          data={commentedPosts}
          emptyMessage="لا توجد منشورات معلق عليها"
          navigateTo="../commented_news"
        />
      </ScrollView>
    </View>
  );
};

export default Profile;