import app from './app.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server backend đang chạy tại http://localhost:${PORT}`);
});
