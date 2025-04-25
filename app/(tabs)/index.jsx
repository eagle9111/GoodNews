import { 
  View, 
  Text, 
  Image, 
  Pressable, 
  Linking, 
  ScrollView, 
  ActivityIndicator, 
  Share, 
  RefreshControl, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  Button,
  Alert 
} from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../API';
import { useAuth , useUser} from '@clerk/clerk-expo';

const Index = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likedArticles, setLikedArticles] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [topStories, setTopStories] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [currentPostId, setCurrentPostId] = useState(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [likesCounts, setLikesCounts] = useState({});
  const [commentsCounts, setCommentsCounts] = useState({});
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const MAX_LINES = 4;

const handleChangeText = (text) => {
  const lines = text.split('\n');
  if (lines.length <= MAX_LINES) {
    setCommentText(text);
  }
};


  useEffect(() => {
    const fetchCounts = async () => {
      const newLikesCounts = {};
      const newCommentsCounts = {};

      await Promise.all(
        articles.map(async (article) => {
          try {
            const likesRes = await fetch(`${API_URL}/api/posts/likes/count/${article._id}`);
            const likesData = await likesRes.json();
            newLikesCounts[article._id] = likesData.count;

            const commentsRes = await fetch(`${API_URL}/api/posts/comments/count/${article._id}`);
            const commentsData = await commentsRes.json();
            newCommentsCounts[article._id] = commentsData.count;
          } catch (err) {
            console.error("خطأ في جلب البيانات:", err);
          }
        })
      );

      setLikesCounts(prev => ({ ...prev, ...newLikesCounts }));
      setCommentsCounts(prev => ({ ...prev, ...newCommentsCounts }));
    };

    if (articles.length > 0) {
      fetchCounts();
    }
  }, [articles]);

  const fetchNews = async (pageNum = 1, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const res = await fetch(`${API_URL}/api/news?page=${pageNum}&limit=15`);
      const data = await res.json();

      if (pageNum === 1) {
        setArticles(data.news);
        setTopStories(data.news.slice(0, 5));
      } else {
        setArticles(prev => [...prev, ...data.news]);
      }

      setTotalPages(data.pagination.totalPages);
      setPage(pageNum);
    } catch (err) {
      Alert.alert("خطأ", "فشل تحميل الأخبار");
      console.error('فشل تحميل الأخبار:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const fetchUserLikes = async () => {
    try {
      const email = user?.primaryEmailAddress?.emailAddress;
      if (!email) return;
      
      const res = await fetch(`${API_URL}/api/posts/likes?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      const likesMap = {};
      data.forEach(like => {
        likesMap[like.postId] = true;
      });
      setLikedArticles(likesMap);
    } catch (err) {
      console.error("فشل جلب الإعجابات:", err);
    }
  };

  const fetchComments = async (postId) => {
    setLoadingComments(true);
    try {
      const res = await fetch(`${API_URL}/api/posts/comments/${postId}`);
      const data = await res.json();
      
      // Separate user comments and others
      const userEmail = user?.primaryEmailAddress?.emailAddress;
      const userComments = data.filter(c => c.email === userEmail)
                             .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const otherComments = data.filter(c => c.email !== userEmail)
                              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setComments([...userComments, ...otherComments]);
    } catch (err) {
      Alert.alert("خطأ", "فشل تحميل التعليقات");
      console.error('فشل تحميل التعليقات:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    fetchNews();
    if (isSignedIn) {
      fetchUserLikes();
    }
  }, [isSignedIn]);

  const onRefresh = () => {
    fetchNews(1, true);
    if (isSignedIn) {
      fetchUserLikes();
    }
  };

  const loadMore = () => {
    if (page < totalPages && !loadingMore) {
      fetchNews(page + 1);
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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ar-EG', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const handleLike = async (articleId) => {
    if (!isSignedIn) {
      return Alert.alert("مطلوب تسجيل دخول", "يجب تسجيل الدخول للإعجاب بالخبر. الرجاء الذهاب لصفحة الملف الشخصي.");
    }
    try {
      const wasLiked = likedArticles[articleId];
      setLikedArticles(prev => ({ ...prev, [articleId]: !wasLiked }));
      setLikesCounts(prev => ({
        ...prev,
        [articleId]: wasLiked ? prev[articleId] - 1 : prev[articleId] + 1
      }));
  
      const response = await fetch(`${API_URL}/api/posts/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: articleId,
          email: user?.primaryEmailAddress?.emailAddress,
        }),
      });
  
      if (!response.ok) throw new Error('فشل الإعجاب بالخبر');
      
      const likesRes = await fetch(`${API_URL}/api/posts/likes/count/${articleId}`);
      const likesData = await likesRes.json();
      setLikesCounts(prev => ({ ...prev, [articleId]: likesData.count }));
      
    } catch (err) {
      setLikedArticles(prev => ({ ...prev, [articleId]: !prev[articleId] }));
      setLikesCounts(prev => ({
        ...prev,
        [articleId]: prev[articleId] + (likedArticles[articleId] ? 1 : -1)
      }));
      Alert.alert("خطأ", "فشل الإعجاب بالخبر");
    }
  };

  const handleComment = (postId) => {
    setCurrentPostId(postId);
    fetchComments(postId);
    setShowCommentModal(true);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    
    const tempComment = {
      _id: `temp-${Date.now()}`,
      postId: currentPostId,
      email: user?.primaryEmailAddress?.emailAddress,
      fullName: user?.firstName + ' ' + user?.lastName || 'مجهول',
      content: commentText,
      createdAt: new Date().toISOString(),
      isTemp: true
    };
  
    setComments(prev => [tempComment, ...prev]);
    setCommentText('');
  
    try {
      const res = await fetch(`${API_URL}/api/posts/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: currentPostId,
          email: user?.primaryEmailAddress?.emailAddress,
          fullName: user?.firstName + ' ' + user?.lastName || 'مجهول', // Send fullName
          content: commentText,
        }),
      });
  
      if (!res.ok) throw new Error('فشل إضافة التعليق');
      
      const newComment = await res.json();
      setComments(prev => [
        newComment,
        ...prev.filter(c => c._id !== tempComment._id)
      ]);
  
      setCommentsCounts(prev => ({
        ...prev,
        [currentPostId]: (prev[currentPostId] || 0) + 1
      }));
      
    } catch (err) {
      setComments(prev => prev.filter(c => c._id !== tempComment._id));
      Alert.alert("خطأ", "فشل إضافة التعليق");
    }
  };

  const handleDeleteComment = (commentId) => {
    Alert.alert(
      "حذف التعليق",
      "هل أنت متأكد من رغبتك في حذف هذا التعليق؟",
      [
        {
          text: "إلغاء",
          style: "cancel",
        },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/posts/comment/${commentId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email }),
              });

              if (!response.ok) throw new Error('فشل حذف التعليق');

              setComments(prev => prev.filter(comment => comment._id !== commentId));

              const countRes = await fetch(`${API_URL}/api/posts/comments/count/${currentPostId}`);
              const countData = await countRes.json();
              setCommentsCounts(prev => ({
                ...prev,
                [currentPostId]: countData.count
              }));
            } catch (err) {
              Alert.alert("خطأ", "فشل حذف التعليق");
            }
          }
        }
      ]
    );
  };

  const handleShare = async (article) => {
    try {
      const message = `اقرأ هذا الخبر: ${article.title}\n\n${article.description}\n\nالرابط: ${article.link}`;
      await Share.share({
        message: message,
        url: article.link,
        title: article.title,
      });
    } catch (error) {
      Alert.alert("خطأ", "فشل المشاركة");
      console.error('خطأ في المشاركة:', error);
    }
  };

  const renderArticleCard = (item, isCarousel = false) => (
    <Pressable
      onPress={() => openInBrowser(item.link)}
      className={`bg-white rounded-lg ${isCarousel ? 'shadow-md ml-4' : 'shadow-sm mx-4 my-2'}`}
      style={[isCarousel && { width: 300 }, { direction: 'rtl' }]}
    >
      {item.image_url && (
        <Image
          source={{ uri: item.image_url }}
          className="w-full h-40 rounded-t-lg"
          resizeMode="cover"
        />
      )}
      <View className="p-4">
        <Text className="text-lg font-bold mb-1 text-right" numberOfLines={2}>
          {item.title}
        </Text>
        <Text className="text-xs text-gray-500 mb-2 text-right">
          {item.pubDate && formatDate(item.pubDate)}
          {item.creator?.length > 0 && (
            <Text> • بواسطة {item.creator.join('، ')}</Text>
          )}
        </Text>
        <Text className="text-sm text-gray-600 mb-3 text-right" numberOfLines={4}>
          {item.description || 'لا يوجد وصف متوفر.'}
        </Text>

        <View className="flex-row justify-between border-t border-gray-100 pt-3">
          <Pressable 
            onPress={() => handleLike(item._id)} 
            className="flex-row items-center"
          >
            <Ionicons
              name={likedArticles[item._id] ? "heart" : "heart-outline"}
              size={20}
              color={likedArticles[item._id] ? "red" : "gray"}
            />
            <Text className="text-gray-500 ml-1">
              {likesCounts[item._id] || 0}
            </Text>
          </Pressable>

          <Pressable 
            onPress={() => handleComment(item._id)} 
            className="flex-row items-center"
          >
            <Ionicons name="chatbubble-outline" size={20} color="gray" />
            <Text className="text-gray-500 ml-1">
              {commentsCounts[item._id] || 0}
            </Text>
          </Pressable>

          <Pressable 
            onPress={() => handleShare(item)} 
            className="flex-row items-center"
          >
            <Ionicons name="share-social-outline" size={20} color="gray" />
            <Text className="text-gray-500 ml-1">مشاركة</Text>
          </Pressable>
        </View>

        {item.video_url && (
          <View className="flex-row items-center mt-2 justify-end">
            <Text className="text-xs text-red-500 ml-1">يحتوي على فيديو</Text>
            <View className="w-2 h-2 rounded-full bg-red-500" />
          </View>
        )}
      </View>
    </Pressable>
  );

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#3B82F6']}
          tintColor="#3B82F6"
        />
      }
    >
      <View className="bg-white pt-12 pb-6 px-6 shadow-lg rounded-b-xl">
        <Text className="text-4xl font-extrabold text-gray-900 text-right">أخبار جيدة</Text>
        <Text className="text-blue-500 text-sm mt-1 text-right">ابق على اطلاع بآخر الأخبار</Text>
      </View>

      {topStories.length > 0 && (
        <View className="mb-6">
          <Text className="text-xl font-bold px-6 py-3 text-right">أهم الأخبار</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="pr-4"
            contentContainerStyle={{ paddingLeft: 16 }}
          >
            {topStories.map((item, index) => (
              <View key={`${item._id || item.title}-${index}`}>
                {renderArticleCard(item, true)}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View className="mb-6">
        {articles.length > 5 && (
          <Text className="text-xl font-bold px-6 py-3 text-right">المزيد من الأخبار</Text>
        )}
        {articles.slice(5).map((item, index) => (
          <View key={`${item._id || item.title}-${index}`} className="mb-3">
            {renderArticleCard(item)}
          </View>
        ))}
      </View>

      {page < totalPages && (
        <View className="items-center mb-6">
          <TouchableOpacity
            onPress={loadMore}
            disabled={loadingMore}
            className="bg-blue-500 px-6 py-3 rounded-full flex-row items-center justify-center"
          >
            {loadingMore ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold">تحميل المزيد</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {page === totalPages && articles.length > 0 && (
        <View className="items-center py-6">
          <Text className="text-gray-500">تم تحميل جميع الأخبار</Text>
        </View>
      )}

      {!loading && articles.length === 0 && (
        <View className="flex-1 items-center justify-center px-6 py-10">
          <Text className="text-lg text-gray-500 text-center">
            لا توجد أخبار متاحة حالياً. الرجاء المحاولة لاحقاً.
          </Text>
        </View>
      )}

      <Modal
        visible={showCommentModal}
        onRequestClose={() => setShowCommentModal(false)}
        animationType="slide"
      >
        <View className="flex-1 bg-gray-100 p-6" style={{ direction: 'rtl' }}>
          <View className="flex-row justify-between items-center mb-4">
            <Pressable onPress={() => setShowCommentModal(false)}>
              <Ionicons name="close" size={24} color="gray" />
            </Pressable>
            <Text className="text-lg font-bold">التعليقات</Text>
          </View>

          {loadingComments ? (
            <ActivityIndicator size="large" className="my-4" />
          ) : comments.length > 0 ? (
            <ScrollView className="flex-1 mb-4">
             {comments.map((comment) => (
  <View 
    key={comment._id}
    className="flex-row justify-between items-center mb-4 p-4 bg-white rounded-lg"
  >
    {/* Put the delete icon on the left side */}
    {(comment.email === user?.primaryEmailAddress?.emailAddress) && (
      <Pressable 
        onPress={() => !comment.isTemp && handleDeleteComment(comment._id)}
        disabled={comment.isTemp}
      >
        <Ionicons 
          name="trash-outline" 
          size={20} 
          color={comment.isTemp ? "gray" : "red"} 
        />
      </Pressable>
    )}
    
    {/* Comment content on the right side */}
    <View className="flex-1 mr-2">
      {comment.isTemp && <ActivityIndicator size="small" className="mb-1" />}
      <Text className="text-gray-800 text-right">{comment.content}</Text>
      <Text className="text-xs text-gray-500 mt-1 text-right">
        {formatDate(comment.createdAt)} • {comment.fullName}
      </Text>
    </View>
  </View>
))}
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-gray-500">لا توجد تعليقات بعد</Text>
            </View>
          )}

          {isSignedIn && (
            <View className="mt-auto">
              <TextInput
                value={commentText}
                onChangeText={handleChangeText}
                placeholder="أضف تعليقاً..."
                className="bg-white p-4 rounded-lg mb-4 shadow-sm text-right"
                
                textAlignVertical="top"
                maxLength={70}

                multiline={true}
              />
              <Button 
                title="نشر التعليق" 
                onPress={handleSubmitComment} 
                disabled={!commentText.trim()}
              />
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
};

export default Index;