import swaggerJSDoc from 'swagger-jsdoc';
import env from './env.js';

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tài liệu API Nền tảng Marka AI',
      version: '1.0.0',
      description: 'Tài liệu chi tiết các cổng API cho hệ thống Marka Platform',
    },
    servers: [{ url: `http://localhost:${env.PORT}/api/v1` }],
  },
  apis: ['./src/routes/*.js', './src/modules/**/*.js'],
});

export default swaggerSpec;
