<template>
  <div class="cek-order-container">
    <h3>Cek Status Order Customer</h3>
    
    <div class="input-group">
      <input 
        v-model="kodeCustomer" 
        placeholder="Masukkan Kode Customer..." 
        @keyup.enter="periksaOrder"
      />
      <button :disabled="loading" @click="periksaOrder">
        {{ loading ? 'Checking...' : 'Cek Status' }}
      </button>
    </div>

    <div v-if="statusMessage" :class="['result-box', isExists ? 'exists' : 'clear']">
      <p>{{ statusMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import api from '@/api/axios';

const kodeCustomer = ref('');
const isExists = ref(false);
const loading = ref(false);
const statusMessage = ref('');

const periksaOrder = async () => {
  if (!kodeCustomer.value) return;

  loading.value = true;
  statusMessage.value = '';
  
  try {
    // Sesuai index.php (ReflectionClass) dan TransaksiController.php
    const response = await api.get('/v1/index.php', {
      params: {
        controller: 'transaksi',
        action: 'cekorder',
        // Mengirim object customer karena PHP membacanya sebagai array $customer
        customer: {
          KodeCustomer: kodeCustomer.value
        },
        env: 'development'
      }
    });

    // Menyesuaikan response: array("is_exists" => true/false)
    isExists.value = response.data.is_exists;
    
    if (isExists.value) {
      statusMessage.value = "⚠️ Customer ini sudah melakukan order hari ini.";
    } else {
      statusMessage.value = "✅ Customer belum diorder. Silahkan lanjut ke transaksi.";
    }
  } catch (error) {
    console.error("Error CekOrder:", error);
    statusMessage.value = "❌ Gagal memeriksa status. Pastikan koneksi VPN aktif.";
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.cek-order-container { padding: 20px; }
.input-group { display: flex; gap: 10px; margin-bottom: 20px; }
input { flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
button { padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 4px; }
button:disabled { background: #95a5a6; }

.result-box { padding: 15px; border-radius: 4px; font-weight: bold; }
.exists { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
.clear { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
</style>