<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/services/api'; // Menggunakan service API yang mengarah ke backend Anda
import { generateWatermarkedImage } from '@/utils/watermark.js';

// Inisialisasi
const route = useRoute();
const router = useRouter();

// State untuk data dan UI
const story = ref(null);
const paid = ref(false); // State untuk status pembayaran dari backend
const isLoading = ref(true);
const isWatermarking = ref(false);
const errorMsg = ref('');
const watermarkedPhotoUrl = ref('');

// Fungsi untuk mengambil data dari backend Anda
const fetchStoryDetail = async () => {
  isLoading.value = true;
  errorMsg.value = '';
  try {
    const storyId = route.params.id;
    // Memanggil endpoint di backend Anda
    const response = await api.get(`/stories/${storyId}`);

    if (!response.data.error) {
      story.value = response.data.story;
      paid.value = response.data.paid; // Simpan status pembayaran

      // Hanya jalankan proses watermark jika user BELUM membayar
      if (!paid.value) {
        isWatermarking.value = true;
        watermarkedPhotoUrl.value = await generateWatermarkedImage(story.value.photoUrl);
        isWatermarking.value = false;
      }
    } else {
      errorMsg.value = response.data.message;
    }
  } catch (error) {
    console.error('Failed to fetch story detail:', error);
    errorMsg.value = 'Gagal memuat detail cerita. Pastikan server backend Anda berjalan.';
  } finally {
    isLoading.value = false;
  }
};

const handlePayment = async () => {
  try {
    const response = await api.post('/payment/initiate', {
      storyId: story.value.id,
      storyName: story.value.name,
      amount: 10000, 
    });
    
    const token = response.data.token;
    
    window.snap.pay(token, {
      onSuccess: function(result){
        alert("Pembayaran berhasil!"); 
        console.log(result);
        paid.value = true; 
      },
      onPending: function(result){
        alert("Menunggu pembayaran Anda!"); console.log(result);
      },
      onError: function(result){
        alert("Pembayaran gagal!"); console.log(result);
      },
      onClose: function(){
        alert('Anda menutup popup tanpa menyelesaikan pembayaran.');
      }
    });

  } catch (error) {
    console.error('Payment initiation failed:', error);
    alert('Gagal memulai pembayaran.');
  }
};

// Fungsi untuk mengunduh gambar ASLI (setelah bayar)
const downloadOriginalImage = async () => {
  if (!story.value?.photoUrl) return;
  try {
    const response = await fetch(story.value.photoUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fotoyou-${story.value.id}.png`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download failed:', error);
    alert('Gagal mengunduh gambar.');
  }
};

// Helper untuk format tanggal
const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString('id-ID', options);
};

// Jalankan fetch data saat komponen dimuat
onMounted(() => {
  fetchStoryDetail();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="container p-4 mx-auto md:p-8">
      <button @click="router.back()" class="mb-6 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">
        &larr; Kembali
      </button>

      <div v-if="isLoading" class="text-center py-10">
        <p class="text-lg text-gray-500 animate-pulse">Loading Story...</p>
      </div>

      <div v-else-if="errorMsg" class="p-4 text-center text-red-700 bg-red-100 rounded-lg">
        <p>{{ errorMsg }}</p>
      </div>

      <div v-else-if="story" class="overflow-hidden bg-white rounded-lg shadow-xl">
        <div class="md:flex">
          <div class="md:w-1/2 bg-gray-200 flex items-center justify-center">
            <p v-if="isWatermarking" class="text-gray-500 animate-pulse">Menambahkan copyright...</p>
            <img v-else class="object-cover w-full h-64 md:h-full" 
                 :src="paid ? story.photoUrl : watermarkedPhotoUrl" 
                 :alt="story.name">
          </div>
          
          <div class="p-6 md:w-1/2 flex flex-col">
            <h1 class="text-3xl font-bold text-gray-900">{{ story.name }}</h1>
            <p class="mt-1 text-sm text-gray-500">
              Dibuat pada: {{ formatDate(story.createdAt) }}
            </p>
            <p class="mt-4 text-base text-gray-700 flex-grow">
              {{ story.description }}
            </p>
            <div class="mt-6">
               <button v-if="paid" @click="downloadOriginalImage" class="w-full px-6 py-3 font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700">
                 Download Gambar Asli
               </button>
               <button v-else @click="handlePayment" class="w-full px-6 py-3 font-semibold text-white bg-green-600 rounded-md shadow-sm hover:bg-green-700">
                 Bayar untuk Hapus Watermark
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>