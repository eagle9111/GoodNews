import {
  View,
  Text,
  Pressable,
  Linking,
  Image,
  ScrollView,
  ActivityIndicator,
  Share,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  FlatList
} from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../API';
import { supabase } from '../lib/supabase';
import { useFocusEffect, router } from 'expo-router';

const LikedNewsByUser = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likedArticles, setLikedArticles] = useState({});
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [currentPostId, setCurrentPostId] = useState(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [likesCounts, setLikesCounts] = useState({});
  const [commentsCounts, setCommentsCounts] = useState({});
  const [user, setUser] = useState(null);
  const MAX_LINES = 4;

  // Fetch data when screen is focused or auth state changes
  useFocusEffect(
    useCallback(() => {
      const fetchSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          fetchLikedNews(session.user.email);
          fetchUserLikes(session.user.email);
        }
      };

      fetchSession();

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchLikedNews(session.user.email);
          fetchUserLikes(session.user.email);
        } else {
          setUser(null);
          setArticles([]);
        }
      });

      return () => subscription?.unsubscribe();
    }, [])
  );

  // Fetch liked news articles
  const fetchLikedNews = async (email) => {
    if (!email) return;
    
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/profile/liked-posts/${encodeURIComponent(email)}`);
      const data = await res.json();
      
      // Pre-process articles for faster rendering
      const processedArticles = data.map(article => ({
        ...article,
        formattedDate: new Date(article.pubDate).toLocaleDateString('ar-EG', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
        description: article.description || 'لا يوجد وصف متاح.'
      }));
      
      setArticles(processedArticles);
      fetchCounts(processedArticles);
    } catch (error) {
      console.error(error);
      Alert.alert("خطأ", "فشل تحميل الأخبار المفضلة");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch user likes for all articles
  const fetchUserLikes = async (email) => {
    try {
      const res = await fetch(`${API_URL}/api/posts/likes?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      const likesMap = data.reduce((acc, like) => {
        acc[like.postId] = true;
        return acc;
      }, {});
      setLikedArticles(likesMap);
    } catch (error) {
      console.error("فشل جلب الإعجابات:", error);
    }
  };

  // Fetch like and comment counts in parallel
  const fetchCounts = async (articlesList) => {
    const newLikesCounts = {};
    const newCommentsCounts = {};

    await Promise.all(
      articlesList.map(async (article) => {
        try {
          const [likesRes, commentsRes] = await Promise.all([
            fetch(`${API_URL}/api/posts/likes/count/${article._id}`),
            fetch(`${API_URL}/api/posts/comments/count/${article._id}`)
          ]);

          const likesData = await likesRes.json();
          const commentsData = await commentsRes.json();

          newLikesCounts[article._id] = likesData.count;
          newCommentsCounts[article._id] = commentsData.count;
        } catch (error) {
          console.error("خطأ في جلب الإعجابات أو التعليقات:", error);
        }
      })
    );

    setLikesCounts(newLikesCounts);
    setCommentsCounts(newCommentsCounts);
  };

  // Open article in browser
  const openInBrowser = async (url) => {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    } else {
      Alert.alert('خطأ', 'لا يمكن فتح الرابط');
    }
  };

  // Like/unlike an article
  const handleLike = async (postId) => {
    if (!user) {
      return Alert.alert("تسجيل الدخول مطلوب", "يرجى تسجيل الدخول للإعجاب بالأخبار", [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تسجيل الدخول', onPress: () => router.push('/(auth)/sign-in') }
      ]);
    }

    const wasLiked = likedArticles[postId];
    
    // Optimistic UI update
    setLikedArticles(prev => ({ ...prev, [postId]: !wasLiked }));
    setLikesCounts(prev => ({
      ...prev,
      [postId]: wasLiked ? (prev[postId] || 1) - 1 : (prev[postId] || 0) + 1
    }));

    // Remove article from list if unliked
    if (wasLiked) {
      setArticles(prev => prev.filter(article => article._id !== postId));
    }

    try {
      await fetch(`${API_URL}/api/posts/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, email: user.email })
      });

      // Update like count with actual value from server
      const likesRes = await fetch(`${API_URL}/api/posts/likes/count/${postId}`);
      const likesData = await likesRes.json();
      setLikesCounts(prev => ({ ...prev, [postId]: likesData.count }));
    } catch (error) {
      // Revert optimistic update on error
      setLikedArticles(prev => ({ ...prev, [postId]: wasLiked }));
      Alert.alert("خطأ", "فشل تحديث الإعجاب");
    }
  };

  // Fetch comments for a post
  const fetchComments = async (postId) => {
    setLoadingComments(true);
    try {
      const res = await fetch(`${API_URL}/api/posts/comments/${postId}`);
      const data = await res.json();
      
      // Sort comments - user's comments first, then by date
      const sortedComments = [
        ...data.filter(c => c.email === user?.email),
        ...data.filter(c => c.email !== user?.email)
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setComments(sortedComments);
    } catch (error) {
      console.error(error);
      Alert.alert("خطأ", "فشل تحميل التعليقات");
    } finally {
      setLoadingComments(false);
    }
  };

  // Add a new comment
  const handleComment = async () => {
    if (!commentText.trim()) return;

    // Create temporary comment for optimistic UI update
    const tempComment = {
      _id: `temp-${Date.now()}`,
      postId: currentPostId,
      email: user.email,
      fullName: `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'مستخدم',
      content: commentText,
      createdAt: new Date().toISOString(),
      isTemp: true
    };

    // Optimistic UI update
    setComments(prev => [tempComment, ...prev]);
    setCommentText('');

    try {
      const res = await fetch(`${API_URL}/api/posts/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: currentPostId,
          email: user.email,
          content: tempComment.content,
          fullName: tempComment.fullName
        })
      });

      const newComment = await res.json();
      
      // Replace temp comment with actual one from server
      setComments(prev => [newComment, ...prev.filter(c => c._id !== tempComment._id)]);
      
      // Update comment count
      setCommentsCounts(prev => ({
        ...prev,
        [currentPostId]: (prev[currentPostId] || 0) + 1
      }));
    } catch (error) {
      // Remove temp comment on error
      setComments(prev => prev.filter(c => c._id !== tempComment._id));
      Alert.alert("خطأ", "فشل في إضافة التعليق");
    }
  };

  // Render a single article card
  const renderArticleCard = ({ item }) => (
    <View className="mb-4 mx-4">
      <Pressable
        onPress={() => openInBrowser(item.link)}
        className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100"
      >
        {item.image_url && (
          <Image
            source={{ uri: item.image_url }}
            className="w-full h-48"
            resizeMode="cover"
            // Add loading priority and caching for faster loading
            loadingPriority="high"
            cachePolicy="memory-disk"
          />
        )}
        <View className="p-4">
          <Text className="text-lg font-bold mb-1 text-right" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-xs text-gray-500 mb-2 text-right">
            {item.formattedDate}
          </Text>
          <Text className="text-sm text-gray-600 mb-3 text-right" numberOfLines={MAX_LINES}>
            {item.description}
          </Text>
          <View className="flex-row justify-between border-t border-gray-100 pt-3">
            <Pressable onPress={() => handleLike(item._id)} className="flex-row items-center">
              <Ionicons
                name={likedArticles[item._id] ? "heart" : "heart-outline"}
                size={20}
                color={likedArticles[item._id] ? "red" : "gray"}
              />
              <Text className="text-gray-500 mr-1">{likesCounts[item._id] || 0}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setCurrentPostId(item._id);
                fetchComments(item._id);
                setShowCommentModal(true);
              }}
              className="flex-row items-center"
            >
              <Ionicons name="chatbubble-outline" size={20} color="gray" />
              <Text className="text-gray-500 mr-1">{commentsCounts[item._id] || 0}</Text>
            </Pressable>
            <Pressable
              onPress={() => Share.share({ message: `${item.title}\n${item.link}` })}
              className="flex-row items-center"
            >
              <Ionicons name="share-social-outline" size={20} color="gray" />
              <Text className="text-gray-500 mr-1">مشاركة</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  );

  // Comments section component
  const CommentItem = ({ comment }) => (
    <View className="border-b border-gray-100 py-3">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-xs text-gray-400">
          {new Date(comment.createdAt).toLocaleTimeString('ar-EG', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
        <Text className="font-bold text-right">{comment.fullName}</Text>
      </View>
      <Text className="text-right text-gray-700">{comment.content}</Text>
    </View>
  );

  // Main render
  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-12 pb-6 px-6 shadow-sm mb-2">
        <View className="flex-row justify-between items-center">
          <Pressable onPress={() => router.back()} className="p-2">
            <Ionicons name="arrow-back" size={24} color="#333" />
          </Pressable>
          <Text className="text-2xl font-bold text-gray-900">الأخبار المفضلة</Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2e7d32" />
        </View>
      ) : articles.length > 0 ? (
        <FlatList
          data={articles}
          renderItem={renderArticleCard}
          keyExtractor={item => item._id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                user?.email && fetchLikedNews(user.email);
              }}
              colors={['#2e7d32']}
              tintColor="#2e7d32"
            />
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                user?.email && fetchLikedNews(user.email);
              }}
              colors={['#2e7d32']}
              tintColor="#2e7d32"
            />
          }
        >
          <Ionicons name="heart-dislike-outline" size={64} color="#ccc" />
          <Text className="text-lg text-gray-500 text-center mt-4 px-6">
            {user ? "لم تقم بإعجاب أي مقالات بعد" : "سجل الدخول لعرض المقالات المعجبة"}
          </Text>
          {!user && (
            <Pressable 
              className="mt-6 bg-green-700 px-8 py-3 rounded-full"
              onPress={() => router.push('/(auth)/sign-in')}
            >
              <Text className="text-white font-medium">تسجيل الدخول</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* Comments Modal */}
      <Modal
        visible={showCommentModal}
        animationType="slide"
        onRequestClose={() => setShowCommentModal(false)}
        transparent={true}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl max-h-3/4">
            <View className="py-3 px-6 border-b border-gray-200 flex-row justify-between items-center">
              <Pressable onPress={() => setShowCommentModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </Pressable>
              <Text className="font-bold text-lg">التعليقات</Text>
            </View>
            
            {/* Comments List */}
            <ScrollView className="px-6 py-3" style={{ maxHeight: 300 }}>
              {loadingComments ? (
                <ActivityIndicator size="large" color="#2e7d32" className="py-8" />
              ) : comments.length > 0 ? (
                comments.map(comment => (
                  <CommentItem key={comment._id} comment={comment} />
                ))
              ) : (
                <View className="py-8 items-center">
                  <Ionicons name="chatbubbles-outline" size={40} color="#ccc" />
                  <Text className="text-gray-500 mt-2 text-center">لا توجد تعليقات بعد، كن أول من يعلق!</Text>
                </View>
              )}
            </ScrollView>
            
            {/* Comment Input */}
            {user ? (
              <View className="p-3 border-t border-gray-200 bg-gray-50">
                <View className="flex-row">
                  <TextInput
                    placeholder="اكتب تعليقك هنا..."
                    value={commentText}
                    onChangeText={setCommentText}
                    className="flex-1 border border-gray-300 bg-white p-3 rounded-lg"
                    multiline
                    textAlignVertical="top"
                    style={{ height: 80, textAlign: 'right' }}
                  />
                </View>
                <Pressable 
                  onPress={handleComment} 
                  className={`mt-2 p-3 rounded-lg ${commentText.trim() ? 'bg-green-700' : 'bg-gray-300'}`}
                  disabled={!commentText.trim()}
                >
                  <Text className="text-white text-center font-bold">إرسال التعليق</Text>
                </Pressable>
              </View>
            ) : (
              <View className="p-4 border-t border-gray-200 items-center">
                <Text className="text-gray-600 mb-2">يجب تسجيل الدخول للتعليق</Text>
                <Pressable 
                  className="bg-green-700 px-6 py-2 rounded-full"
                  onPress={() => {
                    setShowCommentModal(false);
                    router.push('/(auth)/sign-in');
                  }}
                >
                  <Text className="text-white font-medium">تسجيل الدخول</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default LikedNewsByUser;