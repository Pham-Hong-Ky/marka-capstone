import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Marka Express API is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

export default app;
