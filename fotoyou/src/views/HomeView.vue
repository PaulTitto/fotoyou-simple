<script setup>
import { ref, onMounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
// 1. Impor fungsi watermark
import { generateWatermarkedImage } from '@/utils/watermark.js';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const stories = ref([]);
const isLoading = ref(true);
const errorMsg = ref('');
const currentPage = ref(1);
const storiesPerPage = ref(9);

const applyWatermarks = async (storiesArray) => {
  const processedStoriesPromises = storiesArray.map(story => {
    if (story.paid) {
      return Promise.resolve(story);
    } else {
      return generateWatermarkedImage(story.photoUrl).then(watermarkedUrl => ({
        ...story,
        photoUrl: watermarkedUrl,
      }));
    }
  });
  return Promise.all(processedStoriesPromises);
};


const fetchStories = async () => {
  isLoading.value = true;
  errorMsg.value = '';
  try {
    const response = await api.get('/stories', {
      params: {
        page: currentPage.value,
        size: storiesPerPage.value,
      },
    });
    if (!response.data.error) {
      const watermarkedData = await applyWatermarks(response.data.listStory);
      stories.value = watermarkedData;
    } else {
      errorMsg.value = response.data.message;
    }
  } catch (error) {
    console.error('Failed to fetch stories:', error);
    if (error.response && error.response.status === 401) {
       errorMsg.value = 'Sesi Anda telah berakhir. Silakan logout dan login kembali.';
    } else {
       errorMsg.value = 'Gagal memuat cerita. Silakan coba lagi nanti.';
    }
  } finally {
    isLoading.value = false;
  }
};

const hasNextPage = computed(() => stories.value.length === storiesPerPage.value);
const hasPrevPage = computed(() => currentPage.value > 1);

const nextPage = () => {
  if (hasNextPage.value) {
    currentPage.value++;
    fetchStories();
    window.scrollTo(0, 0);
  }
};

const prevPage = () => {
  if (hasPrevPage.value) {
    currentPage.value--;
    fetchStories();
    window.scrollTo(0, 0);
  }
};

onMounted(() => {
  fetchStories();
});
</script>

<template>
  <div>
    <nav class="sticky top-0 z-50 bg-white shadow-md">
      <div class="container px-6 py-3 mx-auto">
        <div class="flex items-center justify-between">
          <div class="text-xl font-semibold text-gray-700">
            <RouterLink to="/" class="text-2xl font-bold text-gray-800 lg:text-3xl hover:text-gray-700">FotoYou</RouterLink>
          </div>
          <div class="flex items-center">
             <span class="hidden mr-4 text-gray-800 sm:block">Welcome, {{ authStore.user?.name }}</span>
             <button @click="authStore.logout()" class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                Logout
            </button>
          </div>
        </div>
      </div>
    </nav>

    <main class="container p-6 mx-auto">
      <div v-if="isLoading" class="flex items-center justify-center h-64">
        <p class="text-lg text-gray-500">Loading stories...</p>
      </div>
      <div v-if="errorMsg && !isLoading" class="p-4 my-4 text-center text-red-700 bg-red-100 rounded-lg">
        <p>{{ errorMsg }}</p>
      </div>

      <div v-if="!isLoading && stories.length > 0" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <RouterLink 
          v-for="story in stories" 
          :key="story.id" 
          :to="{ name: 'StoryDetail', params: { id: story.id } }"
          class="block overflow-hidden bg-white rounded-lg shadow-lg group hover:shadow-xl transition-all duration-300"
        >
          <div class="relative">
            <img 
              class="object-cover w-full h-64 transition-transform duration-300 group-hover:scale-110" 
              :src="story.photoUrl" 
              :alt="story.name"
            >
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
            <div class="absolute bottom-0 p-4">
              <h2 class="text-xl font-bold text-white">{{ story.name }}</h2>
              <p class="text-sm text-gray-200 truncate">{{ story.description }}</p>
            </div>
          </div>
        </RouterLink>
      </div>
      
       <div v-if="!isLoading && stories.length === 0 && !errorMsg" class="flex items-center justify-center h-64">
        <p class="text-lg text-gray-500">No stories found.</p>
      </div>

      <div v-if="!isLoading && (hasPrevPage || hasNextPage)" class="flex justify-center mt-8">
        <button @click="prevPage" :disabled="!hasPrevPage"
          class="inline-flex items-center px-4 py-2 mx-1 text-white bg-indigo-600 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
          &laquo; Previous
        </button>
        <span class="self-center px-4 font-medium text-gray-700">Page {{ currentPage }}</span>
        <button @click="nextPage" :disabled="!hasNextPage"
          class="inline-flex items-center px-4 py-2 mx-1 text-white bg-indigo-600 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
          Next &raquo;
        </button>
      </div>
    </main>
  </div>
</template>