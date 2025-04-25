// app/(profile)/commented-news.jsx
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
  import { API_URL } from '../API';
  import { useAuth, useUser } from '@clerk/clerk-expo';
  
  const CommentedNewsByUser = () => {
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
  
    const fetchCommentedNews = async () => {
      try {
        setLoading(true);
        const email = user?.primaryEmailAddress?.emailAddress;
        if (!email) return;
  
        const res = await fetch(`${API_URL}/api/profile/commented-posts/${encodeURIComponent(email)}`);
        const data = await res.json();
        setArticles(data);
      } catch (err) {
        Alert.alert("خطأ", "فشل تحميل الأخبار المعلّق عليها");
        console.error('فشل تحميل الأخبار المعلّق عليها:', err);
      } finally {
        setLoading(false);
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
      if (isSignedIn) {
        fetchCommentedNews();
        fetchUserLikes();
      }
    }, [isSignedIn]);
  
    const onRefresh = () => {
      fetchCommentedNews();
      if (isSignedIn) {
        fetchUserLikes();
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
        return Alert.alert("مطلوب تسجيل دخول", "يجب تسجيل الدخول للإعجاب بالخبر");
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
        Alert.alert("خطأ", "فشل تعديل حالة الإعجاب");
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
            fullName: user?.firstName + ' ' + user?.lastName || 'مجهول',
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
  
                // Refresh commented posts list
                fetchCommentedNews();
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
  
    const renderArticleCard = (item) => (
      <Pressable
        onPress={() => Linking.openURL(item.link)}
        className="bg-white rounded-lg shadow-sm mx-4 my-2"
        style={{ direction: 'rtl' }}
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
          <Text className="text-4xl font-extrabold text-gray-900 text-right">الأخبار المعلّق عليها</Text>
          <Text className="text-blue-500 text-sm mt-1 text-right">الأخبار التي قمت بالتعليق عليها</Text>
        </View>
  
        {loading ? (
          <ActivityIndicator size="large" className="my-8" />
        ) : articles.length > 0 ? (
          <View className="mb-6">
            {articles.map((item, index) => (
              <View key={`${item._id}-${index}`} className="mb-3">
                {renderArticleCard(item)}
              </View>
            ))}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center px-6 py-10">
            <Text className="text-lg text-gray-500 text-center">
              لم تقم بالتعليق على أي أخبار حتى الآن
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
                  multiline
                  textAlignVertical="top"
                  maxLength={70}
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
  
  export default CommentedNewsByUser;