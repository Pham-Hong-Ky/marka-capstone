import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import env from './config/env.js';
import swaggerSpec from './config/swagger.js';
import requestId from './middlewares/requestId.js';
import enforceHttps from './middlewares/enforceHttps.js';
import errorHandler from './middlewares/error.js';
import apiLimiter from './middlewares/rateLimiter.js';
import v1Routes from './routes/index.js';
import { NotFoundError } from './utils/errors/index.js';
import { morganStream } from './utils/logger.js';

const app = express();

if (env.NODE_ENV === 'production') {
  // Chạy sau reverse proxy (Nginx/Render/Heroku): đọc đúng x-forwarded-proto và IP client.
  app.set('trust proxy', 1);
  // Ép HTTPS: token/refresh cookie chỉ nên truyền qua kênh mã hoá TLS. Helmet đã gửi HSTS.
  app.use(enforceHttps);
}

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestId);

if (env.NODE_ENV !== 'test') {
  morgan.token('req-id', (req: Request) => req.id || '-');
  const morganFormat =
    env.NODE_ENV === 'development'
      ? ':method :url :status :response-time ms - [Req: :req-id]'
      : ':remote-addr - :req-id ":method :url" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms';

  app.use(morgan(morganFormat, { stream: morganStream }));
}

app.use('/api/', apiLimiter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/v1', v1Routes);

app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError(`Đường dẫn ${req.originalUrl} không tồn tại`));
});

app.use(errorHandler);

export default app;
