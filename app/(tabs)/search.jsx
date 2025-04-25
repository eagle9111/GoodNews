import { 
  View, 
  Text, 
  TextInput, 
  ScrollView, 
  ActivityIndicator,
  Image, 
  Share,
  TouchableOpacity,
  Alert,
  Platform
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../API';
import { useAuth, useUser } from '@clerk/clerk-expo';
import debounce from 'lodash.debounce';

const SearchScreen = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [likedArticles, setLikedArticles] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const debouncedSearch = useCallback(
    debounce((query, pageNum) => {
      performSearch(query, pageNum);
    }, 500),
    []
  );

  useEffect(() => {
    if (searchTerm.trim()) {
      debouncedSearch(searchTerm, 1);
    } else {
      setResults([]);
      setPage(1);
      setHasMore(false);
    }
  }, [searchTerm]);

  const performSearch = async (query, pageNum) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        q: query,
        page: pageNum,
        limit: 15
      });
      
      const res = await fetch(`${API_URL}/api/search?${params}`);
      const data = await res.json();
      
      setResults(prev => pageNum === 1 ? data.news : [...prev, ...data.news]);
      setHasMore(data.pagination.hasMore);
      setPage(pageNum);
    } catch (err) {
      Alert.alert("Error", "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId) => {
    if (!isSignedIn) {
      Alert.alert("Login Required", "Please login to like articles");
      return;
    }
    try {
      const wasLiked = likedArticles[postId];
      setLikedArticles(prev => ({ ...prev, [postId]: !wasLiked }));
      
      await fetch(`${API_URL}/api/posts/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          email: user.primaryEmailAddress.emailAddress
        }),
      });
    } catch (err) {
      setLikedArticles(prev => ({ ...prev, [postId]: !prev[postId] }));
      Alert.alert("Error", "Failed to like article");
    }
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
      ) : results.length > 0 ? (
        <ScrollView className="flex-1">
          {results.map((item) => (
            <View className="bg-white rounded-lg shadow-md p-4 mb-4" key={item._id}>
              {item.image_url && (
                <Image 
                  source={{ uri: item.image_url }} 
                  className="w-full h-48 rounded-lg mb-3" 
                  resizeMode="cover"
                />
              )}
              <Text className="text-lg font-bold text-gray-900 mb-1 text-right">{item.title}</Text>
              <Text className="text-sm text-gray-500 mb-2 text-right">
                {new Date(item.pubDate).toLocaleDateString()}
              </Text>
              <Text className="text-gray-700 mb-3 text-right" numberOfLines={3}>
                {item.description}
              </Text>
              <View className="flex-row justify-end space-x-4">
                <TouchableOpacity onPress={() => handleLike(item._id)} className="p-2">
                  <Ionicons
                    name={likedArticles[item._id] ? "heart" : "heart-outline"}
                    size={20}
                    color={likedArticles[item._id] ? "red" : "#666"}
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => handleShare(item)} 
                  className="p-2"
                >
                  <Ionicons name="share-social-outline" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          
          {hasMore && (
            <TouchableOpacity
              className="bg-blue-500 rounded-lg p-4 my-4 items-center"
              onPress={() => performSearch(searchTerm, page + 1)}
            >
              <Text className="text-white font-medium"> تحميل المزيد</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <Text className="text-center mt-8 text-gray-500 text-lg">
          {searchTerm ? "لا توجد معلومات" : "أدخل كلمة البحث"}
        </Text>
      )}
    </View>
  );
};

export default SearchScreen;