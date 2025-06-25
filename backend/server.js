require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const midtransClient = require('midtrans-client');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// --- KONEKSI DATABASE ---
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 

  if (token == null) return res.sendStatus(401); 

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); 
    req.user = user; 
    next(); 
  });
};




app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ error: true, message: 'Please provide name, email, and a password with at least 8 characters.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );
    res.status(201).json({ error: false, message: 'User Created' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: true, message: 'Email already exists.' });
    }
    res.status(500).json({ error: true, message: 'Internal Server Error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: true, message: 'Please provide email and password.' });
  }
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: true, message: 'Invalid credentials.' });
    }
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: true, message: 'Invalid credentials.' });
    }
    const token = jwt.sign(
      { userId: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      error: false,
      message: 'success',
      loginResult: { userId: user.id, name: user.name, token: token },
    });
  } catch (error) {
    res.status(500).json({ error: true, message: 'Internal Server Error' });
  }
});

// --- Endpoint Stories (Terproteksi) ---
app.get('/api/stories', authenticateToken, async (req, res) => {
  const userId = req.user.userId; // Dapatkan ID user yang sedang login dari token

  try {
    const { page, size } = req.query;
    const response = await axios.get('https://story-api.dicoding.dev/v1/stories', {
      params: { page, size },
      headers: { Authorization: `Bearer ${process.env.DICODING_API_TOKEN}` } 
    });

    if (response.data.error) {
        return res.status(500).json(response.data);
    }

    const stories = response.data.listStory;
    if (stories.length === 0) {
        return res.json({ error: false, message: 'Stories fetched successfully', listStory: [] });
    }

    const storyIds = stories.map(story => story.id);

    const [purchaseResult] = await pool.query(
      `SELECT story_id FROM purchases WHERE user_id = ? AND status = ? AND story_id IN (?)`,
      [userId, 'SUCCESS', storyIds]
    );
    
    const paidStoryIds = new Set(purchaseResult.map(p => p.story_id));

    const storiesWithPaymentStatus = stories.map(story => ({
      ...story, // Salin semua properti asli dari cerita
      paid: paidStoryIds.has(story.id) // Tambahkan properti 'paid': true jika ID-nya ada di Set, jika tidak, false
    }));
    
    res.json({
        error: false,
        message: 'Stories fetched successfully',
        listStory: storiesWithPaymentStatus
    });

  } catch (error) {
    console.error('Error fetching stories with payment status:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: true, message: 'Gagal mengambil cerita dari API Dicoding.' });
  }
});
  
  app.get('/api/stories/:id', authenticateToken, async (req, res) => {
    const { id: storyId } = req.params;
    const userId = req.user.userId;
  
    try {
      const storyResponse = await axios.get(`https://story-api.dicoding.dev/v1/stories/${storyId}`, {
          headers: { 
            Authorization: `Bearer ${process.env.DICODING_API_TOKEN}`
          }
      });
      if (storyResponse.data.error) return res.status(404).json(storyResponse.data);
      
      const story = storyResponse.data.story;
  
      const [purchaseResult] = await pool.query(
        'SELECT * FROM purchases WHERE user_id = ? AND story_id = ? AND status = ?',
        [userId, storyId, 'SUCCESS']
      );
  
      const hasPaid = purchaseResult.length > 0;
      res.json({ error: false, message: 'Story fetched', story, paid: hasPaid });
    } catch (error) {
      console.error('Error fetching detail from Dicoding API:', error.response ? error.response.data : error.message);
      res.status(500).json({ error: true, message: 'Internal Server Error' });
    }
  });
  
app.post('/api/payment/initiate', authenticateToken, async (req, res) => {
    const { storyId, storyName, amount } = req.body;
    const { userId, name, email } = req.user; 

    try {
        const orderId = `FOTOYOU-${storyId}-${Date.now()}`;
        
        await pool.query(
            `INSERT INTO purchases (user_id, story_id, midtrans_order_id, status, amount) VALUES (?, ?, ?, ?, ?)`,
            [userId, storyId, orderId, 'PENDING', amount]
        );
        
        const parameter = {
            transaction_details: { order_id: orderId, gross_amount: amount },
            item_details: [{ id: storyId, price: amount, quantity: 1, name: `Unlock Watermark: ${storyName}`}],
            customer_details: { first_name: name, email: email },
             "notification_url": `${process.env.NGROK_PUBLIC_URL}/api/payment/notification`
            
        };

        const transactionToken = await snap.createTransactionToken(parameter);
        res.json({ token: transactionToken });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: true, message: 'You have already initiated payment for this story.' });
        }
        res.status(500).json({ error: true, message: 'Failed to initiate payment.' });
    }
});

app.post('/api/payment/notification', async (req, res) => {
    try {
        const statusResponse = await snap.transaction.notification(req.body);
        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        let newStatus = 'PENDING';
        if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
            if (fraudStatus == 'accept') {
                newStatus = 'SUCCESS';
            }
        } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
            newStatus = 'FAILED';
        }

        await pool.query(
            'UPDATE purchases SET status = ? WHERE midtrans_order_id = ?',
            [newStatus, orderId]
        );
        res.sendStatus(200);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});


// Menjalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});