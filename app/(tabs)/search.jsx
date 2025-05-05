import { 
  View, 
  Text, 
  TextInput, 
  FlatList,
  ActivityIndicator,
  Image, 
  Share,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useEffect, useState, useCallback, memo, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../API';
import { supabase } from '../../lib/supabase';
import debounce from 'lodash.debounce';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';

// Memoized article item component for better performance
const ArticleItem = memo(({ item, likedArticles, onLike, onShare }) => {
  return (
    <View className="bg-white rounded-lg shadow-md p-4 mb-4">
      {item.image_url && (
        <Image 
          source={{ uri: item.image_url }} 
          className="w-full h-48 rounded-lg mb-3" 
          resizeMode="cover"
        />
      )}
      <Text className="text-lg font-bold text-gray-900 mb-1 text-right">{item.title}</Text>
      <Text className="text-sm text-gray-500 mb-2 text-right">
        {new Date(item.pubDate).toLocaleDateString('ar-EG')}
      </Text>
      <Text className="text-gray-700 mb-3 text-right" numberOfLines={3}>
        {item.description}
      </Text>
      <View className="flex-row justify-end space-x-4">
        <TouchableOpacity onPress={() => onLike(item._id)} className="p-2">
          <Ionicons
            name={likedArticles[item._id] ? "heart" : "heart-outline"}
            size={20}
            color={likedArticles[item._id] ? "red" : "#666"}
          />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => onShare(item)} 
          className="p-2"
        >
          <Ionicons name="share-social-outline" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const SearchScreen = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likedArticles, setLikedArticles] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [user, setUser] = useState(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const router = useRouter();
  
  // Track if likes have been fetched to avoid duplicate requests
  const likesRef = useRef({
    hasFetched: false,
    isFetching: false
  });

  useFocusEffect(
    useCallback(() => {
      const fetchSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setIsSignedIn(true);
          // Only fetch likes if not already fetching/fetched
          if (!likesRef.current.hasFetched && !likesRef.current.isFetching) {
            fetchUserLikes(session.user.email);
          }
        } else {
          setUser(null);
          setIsSignedIn(false);
        }
      };

      fetchSession();

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          setUser(session.user);
          setIsSignedIn(true);
          // Reset likes fetch status on new sign in
          if (event === 'SIGNED_IN') {
            likesRef.current.hasFetched = false;
            fetchUserLikes(session.user.email);
          }
        } else {
          setUser(null);
          setIsSignedIn(false);
          // Clear likes on sign out
          if (event === 'SIGNED_OUT') {
            setLikedArticles({});
            likesRef.current.hasFetched = false;
          }
        }
      });

      return () => subscription?.unsubscribe();
    }, [])
  );

  // Stable search function that doesn't recreate on re-renders
  const performSearch = useCallback(async (query, pageNum, append = false) => {
    if (!query.trim()) {
      setResults([]);
      setPage(1);
      setHasMore(false);
      return;
    }
    
    try {
      append ? setLoadingMore(true) : setLoading(true);
      
      const params = new URLSearchParams({
        q: query,
        page: pageNum,
        limit: 15
      });
      
      const res = await fetch(`${API_URL}/api/search?${params}`);
      const data = await res.json();
      
      setResults(prev => append ? [...prev, ...data.news] : data.news);
      setHasMore(data.pagination.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error("Search error:", err);
      Alert.alert("خطأ", "فشل البحث");
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, []);

  // Create a stable debounced search that won't recreate unnecessarily
  const debouncedSearch = useCallback(
    debounce((query) => {
      performSearch(query, 1);
    }, 500),
    [performSearch]
  );

  // Handle search term changes
  useEffect(() => {
    if (searchTerm.trim()) {
      debouncedSearch(searchTerm);
    } else {
      setResults([]);
      setPage(1);
      setHasMore(false);
    }
  }, [searchTerm, debouncedSearch]);

  const fetchUserLikes = async (email) => {
    if (!email || likesRef.current.isFetching) return;
    
    try {
      likesRef.current.isFetching = true;
      const res = await fetch(`${API_URL}/api/posts/likes?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      
      const likesMap = {};
      data.forEach(like => {
        likesMap[like.postId] = true;
      });
      
      setLikedArticles(likesMap);
      likesRef.current.hasFetched = true;
    } catch (err) {
      console.error("فشل جلب الإعجابات:", err);
    } finally {
      likesRef.current.isFetching = false;
    }
  };

  const handleLike = useCallback(async (postId) => {
    if (!isSignedIn) {
      Alert.alert("مطلوب تسجيل دخول", "يجب تسجيل الدخول للإعجاب بالمقالات", [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تسجيل الدخول', onPress: () => router.push('/(auth)/sign-in') }
      ]);
      return;
    }
    
    try {
      const wasLiked = likedArticles[postId];
      // Optimistic update
      setLikedArticles(prev => ({ ...prev, [postId]: !wasLiked }));
      
      await fetch(`${API_URL}/api/posts/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          email: user.email
        }),
      });
    } catch (err) {
      // Revert on error
      setLikedArticles(prev => ({ ...prev, [postId]: !prev[postId] }));
      Alert.alert("خطأ", "فشل الإعجاب بالمقال");
    }
  }, [isSignedIn, likedArticles, user, router]);

  const handleShare = useCallback(async (article) => {
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
  }, []);

  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore && searchTerm.trim()) {
      performSearch(searchTerm, page + 1, true);
    }
  }, [hasMore, loadingMore, searchTerm, page, performSearch]);

  const renderItem = useCallback(({ item }) => (
    <ArticleItem 
      item={item} 
      likedArticles={likedArticles} 
      onLike={handleLike} 
      onShare={handleShare}
    />
  ), [likedArticles, handleLike, handleShare]);

  const keyExtractor = useCallback((item) => item._id, []);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View className="py-4">
        <ActivityIndicator size="small" color="#0000ff" />
      </View>
    );
  }, [loadingMore]);

  const renderEmpty = useCallback(() => (
    <Text className="text-center mt-8 text-gray-500 text-lg">
      {searchTerm ? "لا توجد نتائج" : "أدخل كلمة البحث"}
    </Text>
  ), [searchTerm]);

  return (
    <View className="flex-1 bg-gray-100 p-4">
      {/* Search Input */}
      <TextInput
        className="bg-white rounded-lg p-4 mb-4 text-right shadow-sm border border-gray-200"
        placeholder="ابحث عن الأخبار..."
        placeholderTextColor="#999"
        value={searchTerm}
        onChangeText={setSearchTerm}
        autoFocus
      />

      {loading ? (
        <ActivityIndicator size="large" className="mt-8" />
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          initialNumToRender={5}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </View>
  );
};

export default SearchScreen;