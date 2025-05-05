import { 
  View, 
  Text, 
  Image, 
  Pressable, 
  Linking, 
  ActivityIndicator, 
  Share, 
  RefreshControl, 
  Modal, 
  TextInput, 
  Button,
  Alert,
  FlatList
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../API';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from 'expo-router';

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
  const [user, setUser] = useState(null);
  const MAX_LINES = 4;

  // Fetch data when screen is focused or auth state changes
  useFocusEffect(
    useCallback(() => {
      const fetchSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          fetchCommentedNews(session.user.email);
          fetchUserLikes(session.user.email);
        }
      };

      fetchSession();

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchCommentedNews(session.user.email);
          fetchUserLikes(session.user.email);
        } else {
          setUser(null);
          setArticles([]);
        }
      });

      return () => subscription?.unsubscribe();
    }, [])
  );

  const handleChangeText = (text) => {
    const lines = text.split('\n');
    if (lines.length <= MAX_LINES) {
      setCommentText(text);
    }
  };

  // Format date helper function
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

  // Fetch counts in parallel for better performance
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
        } catch (err) {
          console.error("Error fetching counts:", err);
        }
      })
    );

    setLikesCounts(newLikesCounts);
    setCommentsCounts(newCommentsCounts);
  };

  const fetchCommentedNews = async (email) => {
    if (!email) return;
    
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/profile/commented-posts/${encodeURIComponent(email)}`);
      const data = await res.json();
      
      // Pre-process articles for faster rendering
      const processedArticles = data.map(article => ({
        ...article,
        formattedDate: formatDate(article.pubDate),
        description: article.description || 'No description available.'
      }));
      
      setArticles(processedArticles);
      fetchCounts(processedArticles);
    } catch (err) {
      Alert.alert("Error", "Failed to load commented news");
      console.error('Failed to load commented news:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserLikes = async (email) => {
    if (!email) return;
    
    try {
      const res = await fetch(`${API_URL}/api/posts/likes?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      const likesMap = data.reduce((acc, like) => {
        acc[like.postId] = true;
        return acc;
      }, {});
      setLikedArticles(likesMap);
    } catch (err) {
      console.error("Failed to fetch likes:", err);
    }
  };

  const fetchComments = async (postId) => {
    setLoadingComments(true);
    try {
      const res = await fetch(`${API_URL}/api/posts/comments/${postId}`);
      const data = await res.json();
      
      // Sort comments - user's comments first, then by date
      const userEmail = user?.email;
      const userComments = data.filter(c => c.email === userEmail)
                             .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const otherComments = data.filter(c => c.email !== userEmail)
                              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setComments([...userComments, ...otherComments]);
    } catch (err) {
      Alert.alert("Error", "Failed to load comments");
      console.error('Failed to load comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (user?.email) {
      fetchCommentedNews(user.email);
      fetchUserLikes(user.email);
    } else {
      setRefreshing(false);
    }
  }, [user]);

  const handleLike = async (articleId) => {
    if (!user) {
      return Alert.alert("Login Required", "You must be logged in to like news");
    }
    
    try {
      const wasLiked = likedArticles[articleId];
      
      // Optimistic UI update
      setLikedArticles(prev => ({ ...prev, [articleId]: !wasLiked }));
      setLikesCounts(prev => ({
        ...prev,
        [articleId]: wasLiked ? (prev[articleId] || 1) - 1 : (prev[articleId] || 0) + 1
      }));

      const response = await fetch(`${API_URL}/api/posts/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: articleId,
          email: user.email,
        }),
      });

      if (!response.ok) throw new Error('Failed to like post');
      
      // Update with actual server count
      const likesRes = await fetch(`${API_URL}/api/posts/likes/count/${articleId}`);
      const likesData = await likesRes.json();
      setLikesCounts(prev => ({ ...prev, [articleId]: likesData.count }));
      
    } catch (err) {
      // Revert optimistic update on error
      setLikedArticles(prev => ({ ...prev, [articleId]: !prev[articleId] }));
      setLikesCounts(prev => ({
        ...prev,
        [articleId]: prev[articleId] + (likedArticles[articleId] ? 1 : -1)
      }));
      Alert.alert("Error", "Failed to update like status");
    }
  };

  const handleOpenComment = (postId) => {
    setCurrentPostId(postId);
    fetchComments(postId);
    setShowCommentModal(true);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    
    // Create temp comment for optimistic UI
    const tempComment = {
      _id: `temp-${Date.now()}`,
      postId: currentPostId,
      email: user?.email,
      fullName: user?.user_metadata?.full_name || 'Anonymous',
      content: commentText,
      createdAt: new Date().toISOString(),
      isTemp: true
    };
  
    // Optimistic update
    setComments(prev => [tempComment, ...prev]);
    setCommentText('');
  
    try {
      const res = await fetch(`${API_URL}/api/posts/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: currentPostId,
          email: user.email,
          fullName: user.user_metadata?.full_name || 'Anonymous',
          content: commentText,
        }),
      });

      if (!res.ok) throw new Error('Failed to add comment');
      
      const newComment = await res.json();
      
      // Replace temp comment with actual comment
      setComments(prev => [
        newComment,
        ...prev.filter(c => c._id !== tempComment._id)
      ]);

      // Update comment count
      setCommentsCounts(prev => ({
        ...prev,
        [currentPostId]: (prev[currentPostId] || 0) + 1
      }));
      
    } catch (err) {
      // Remove temp comment on error
      setComments(prev => prev.filter(c => c._id !== tempComment._id));
      Alert.alert("Error", "Failed to add comment");
    }
  };

  const handleDeleteComment = (commentId) => {
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/posts/comment/${commentId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email }),
              });

              if (!response.ok) throw new Error('Failed to delete comment');

              setComments(prev => prev.filter(comment => comment._id !== commentId));

              // Update comment count
              const countRes = await fetch(`${API_URL}/api/posts/comments/count/${currentPostId}`);
              const countData = await countRes.json();
              setCommentsCounts(prev => ({
                ...prev,
                [currentPostId]: countData.count
              }));

              fetchCommentedNews(user.email);
            } catch (err) {
              Alert.alert("Error", "Failed to delete comment");
            }
          }
        }
      ]
    );
  };

  const handleShare = async (article) => {
    try {
      const message = `Read this news: ${article.title}\n\n${article.description}\n\nLink: ${article.link}`;
      await Share.share({
        message: message,
        url: article.link,
        title: article.title,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to share");
      console.error('Sharing error:', error);
    }
  };

  // Comment item component
  const CommentItem = ({ comment }) => (
    <View 
      className="mb-4 p-4 bg-white rounded-lg shadow-sm"
      style={{ direction: 'rtl' }}
    >
      <View className="flex-row justify-between items-center">
        <View className="flex-1 mr-2">
          {comment.isTemp && <ActivityIndicator size="small" className="mb-1" />}
          <Text className="text-gray-800 text-right">{comment.content}</Text>
          <Text className="text-xs text-gray-500 mt-1 text-right">
            {formatDate(comment.createdAt)} • {comment.fullName}
          </Text>
        </View>
        
        {(comment.email === user?.email) && (
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
      </View>
    </View>
  );

  // Render a single article card
  const renderArticleCard = ({ item }) => (
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
          // Add priority loading and caching for better performance
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
          {item.creator?.length > 0 && (
            <Text> • By {item.creator.join('، ')}</Text>
          )}
        </Text>
        <Text className="text-sm text-gray-600 mb-3 text-right" numberOfLines={4}>
          {item.description}
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
            onPress={() => handleOpenComment(item._id)} 
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
            <Text className="text-gray-500 ml-1">Share</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white pt-12 pb-6 px-6 shadow-lg rounded-b-xl">
        <Text className="text-4xl font-extrabold text-gray-900 text-right">التعليقات المفضلة</Text>
        <Text className="text-blue-500 text-sm mt-1 text-right">الأخبار المعلق عليها</Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : articles.length > 0 ? (
        <FlatList
          data={articles}
          renderItem={renderArticleCard}
          keyExtractor={item => item._id}
          initialNumToRender={5}
          maxToRenderPerBatch={10}
          windowSize={10}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3B82F6']}
              tintColor="#3B82F6"
            />
          }
        />
      ) : (
        <View className="flex-1 items-center justify-center px-6 py-10">
          <Ionicons name="chatbubble-ellipses-outline" size={64} color="#ccc" />
          <Text className="text-lg text-gray-500 text-center mt-4">
           لم تقم بالتعليق على أي أخبار بعد.
          </Text>
        </View>
      )}

      <Modal
        visible={showCommentModal}
        onRequestClose={() => setShowCommentModal(false)}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl max-h-3/4">
            <View className="flex-row justify-between items-center py-3 px-6 border-b border-gray-200">
              <Pressable onPress={() => setShowCommentModal(false)}>
                <Ionicons name="close" size={24} color="gray" />
              </Pressable>
              <Text className="text-lg font-bold">التعليقات</Text>
            </View>

            {loadingComments ? (
              <ActivityIndicator size="large" color="#3B82F6" className="py-8" />
            ) : comments.length > 0 ? (
              <FlatList
                data={comments}
                renderItem={({ item }) => <CommentItem comment={item} />}
                keyExtractor={item => item._id}
                contentContainerStyle={{ padding: 16 }}
                style={{ maxHeight: 300 }}
                initialNumToRender={10}
                showsVerticalScrollIndicator={true}
              />
            ) : (
              <View className="flex-1 items-center justify-center py-8">
                <Ionicons name="chatbubbles-outline" size={40} color="#ccc" />
                <Text className="text-gray-500 mt-2">لا يوجد تعليقات</Text>
              </View>
            )}

            {user && (
              <View className="p-3 border-t border-gray-200 bg-gray-50">
                <TextInput
                  value={commentText}
                  onChangeText={handleChangeText}
                  placeholder="Add a comment..."
                  className="bg-white p-4 rounded-lg mb-4 shadow-sm text-right"
                  multiline
                  textAlignVertical="top"
                  maxLength={70}
                  style={{ height: 80 }}
                />
                <Pressable 
                  onPress={handleSubmitComment} 
                  disabled={!commentText.trim()}
                  className={`p-3 rounded-lg ${commentText.trim() ? 'bg-blue-500' : 'bg-gray-300'}`}
                >
                  <Text className="text-white text-center font-bold">Post Comment</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CommentedNewsByUser;